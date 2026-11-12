import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'pending'; // pending, under_review, approved, rejected, all

  try {
    const directResult = await tryDirectQuery(async (pool) => {
      const values: string[] = [];
      let whereClause = '';
      if (status && status !== 'all') {
        values.push(status);
        whereClause = 'WHERE a.status = $1';
      }

      const [appealsRes, countsRes] = await Promise.all([
        pool.query(
          `
          SELECT
            a.id,
            a.user_id,
            a.restriction_id,
            a.reason,
            a.explanation,
            COALESCE(a.evidence_urls, ARRAY[]::text[]) AS evidence_urls,
            a.status,
            a.admin_response,
            a.reviewed_by,
            a.reviewed_at,
            a.created_at,
            a.updated_at,
            p.first_name,
            p.last_name,
            p.username,
            p.email,
            p.avatar_url,
            COALESCE(p.is_verified, false) AS is_verified,
            COALESCE(p.is_banned, false) AS is_banned,
            p.banned_until,
            p.ban_reason,
            COALESCE(p.is_restricted, false) AS is_restricted,
            p.restricted_until,
            p.restriction_reason,
            COALESCE(p.account_status, 'active') AS account_status,
            COALESCE(p.warning_count, 0)::int AS warning_count,
            ur.type AS restriction_type,
            ur.warning_level AS restriction_warning_level,
            ur.reason AS linked_restriction_reason,
            ur.details AS linked_restriction_details,
            ur.expires_at AS linked_restriction_expires_at,
            ur.status AS linked_restriction_status
          FROM public.appeals a
          LEFT JOIN public.profiles p ON p.id = a.user_id
          LEFT JOIN public.user_restrictions ur ON ur.id = a.restriction_id
          ${whereClause}
          ORDER BY
            CASE a.status
              WHEN 'pending' THEN 0
              WHEN 'under_review' THEN 1
              WHEN 'approved' THEN 2
              ELSE 3
            END,
            a.created_at DESC
          LIMIT 150
          `,
          values
        ),
        pool.query(`
          SELECT
            COUNT(*)::int AS all_count,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
            COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review_count,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count
          FROM public.appeals
        `),
      ]);

      const c = countsRes.rows[0] || {};
      return {
        appeals: appealsRes.rows,
        counts: {
          all: Number(c.all_count || 0),
          pending: Number(c.pending_count || 0),
          under_review: Number(c.under_review_count || 0),
          approved: Number(c.approved_count || 0),
          rejected: Number(c.rejected_count || 0),
        },
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
      });
    }

    // Fallback via Supabase HTTPS Service Role
    let q = supabaseAdmin
      .from('appeals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const [{ data: appealsData, error: appealsErr }, { data: allStatuses }] = await Promise.all([
      q,
      supabaseAdmin.from('appeals').select('status'),
    ]);
    if (appealsErr) throw appealsErr;

    const appealsList = (appealsData || []) as Array<Record<string, unknown>>;
    const userIds = Array.from(new Set(appealsList.map((a) => String(a.user_id)).filter(Boolean)));
    const restrictionIds = Array.from(
      new Set(appealsList.map((a) => (a.restriction_id ? String(a.restriction_id) : '')).filter(Boolean))
    );

    const [profsRes, restrsRes] = await Promise.all([
      userIds.length > 0
        ? supabaseAdmin
            .from('profiles')
            .select(
              'id, first_name, last_name, username, email, avatar_url, is_verified, is_banned, banned_until, ban_reason, is_restricted, restricted_until, restriction_reason, account_status, warning_count'
            )
            .in('id', userIds)
        : Promise.resolve({ data: [] }),
      restrictionIds.length > 0
        ? supabaseAdmin
            .from('user_restrictions')
            .select('id, type, warning_level, reason, details, expires_at, status')
            .in('id', restrictionIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profMap = new Map<string, Record<string, unknown>>(
      ((profsRes.data || []) as Array<Record<string, unknown>>).map((p) => [String(p.id), p])
    );
    const restrMap = new Map<string, Record<string, unknown>>(
      ((restrsRes.data || []) as Array<Record<string, unknown>>).map((r) => [String(r.id), r])
    );

    const formatted = appealsList.map((a) => {
      const p = profMap.get(String(a.user_id)) || {};
      const ur = a.restriction_id ? restrMap.get(String(a.restriction_id)) || {} : {};
      return {
        ...a,
        evidence_urls: Array.isArray(a.evidence_urls) ? a.evidence_urls : [],
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        username: p.username ?? null,
        email: p.email ?? null,
        avatar_url: p.avatar_url ?? null,
        is_verified: Boolean(p.is_verified),
        is_banned: Boolean(p.is_banned),
        banned_until: p.banned_until ?? null,
        ban_reason: p.ban_reason ?? null,
        is_restricted: Boolean(p.is_restricted),
        restricted_until: p.restricted_until ?? null,
        restriction_reason: p.restriction_reason ?? null,
        account_status: p.account_status ?? 'active',
        warning_count: Number(p.warning_count || 0),
        restriction_type: ur.type ?? null,
        restriction_warning_level: ur.warning_level ?? null,
        linked_restriction_reason: ur.reason ?? null,
        linked_restriction_details: ur.details ?? null,
        linked_restriction_expires_at: ur.expires_at ?? null,
        linked_restriction_status: ur.status ?? null,
      };
    });

    const statusRows = (allStatuses || []) as Array<{ status: string }>;
    const counts = {
      all: statusRows.length,
      pending: statusRows.filter((s) => s.status === 'pending').length,
      under_review: statusRows.filter((s) => s.status === 'under_review').length,
      approved: statusRows.filter((s) => s.status === 'approved').length,
      rejected: statusRows.filter((s) => s.status === 'rejected').length,
    };

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      appeals: formatted,
      counts,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching appeals:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch standing appeals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { appealId, action, adminResponse } = body as {
      appealId?: string;
      action?: string;
      adminResponse?: string;
    };

    if (!appealId || !action) {
      return NextResponse.json(
        { success: false, error: 'appealId and action are required' },
        { status: 400 }
      );
    }

    const normalizedAction = String(action).toUpperCase().trim();
    const statusMap: Record<string, 'under_review' | 'approved' | 'rejected'> = {
      UNDER_REVIEW: 'under_review',
      APPROVE: 'approved',
      REJECT: 'rejected',
    };
    const nextStatus = statusMap[normalizedAction];
    if (!nextStatus) {
      return NextResponse.json(
        { success: false, error: 'Invalid appeal action specified' },
        { status: 400 }
      );
    }

    const cleanedResponse = typeof adminResponse === 'string' ? adminResponse.trim() : '';
    const nowIso = new Date().toISOString();
    let targetUserId: string | null = null;
    let restrictionId: string | null = null;

    const directOk = await tryDirectQuery(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const appealRes = await client.query(
          `SELECT id, user_id, restriction_id, status, reason FROM public.appeals WHERE id = $1 LIMIT 1`,
          [appealId]
        );
        const appealRow = appealRes.rows[0];
        if (!appealRow) {
          throw new Error('Appeal record not found');
        }

        targetUserId = appealRow.user_id;
        restrictionId = appealRow.restriction_id || null;

        await client.query(
          `UPDATE public.appeals
           SET status = $1,
               admin_response = CASE WHEN $2 <> '' THEN $2 ELSE admin_response END,
               reviewed_by = $3,
               reviewed_at = NOW(),
               updated_at = NOW()
           WHERE id = $4`,
          [nextStatus, cleanedResponse, auth.admin.name, appealId]
        );

        if (nextStatus === 'approved' && targetUserId) {
          await client.query(
            `UPDATE auth.users SET banned_until = NULL WHERE id = $1`,
            [targetUserId]
          );

          await client.query(
            `UPDATE public.profiles
             SET is_banned = false,
                 banned_until = NULL,
                 ban_reason = NULL,
                 is_restricted = false,
                 restricted_until = NULL,
                 restriction_reason = NULL,
                 account_status = 'active',
                 updated_at = NOW()
             WHERE id = $1`,
            [targetUserId]
          );

          if (restrictionId) {
            await client.query(
              `UPDATE public.user_restrictions
               SET status = 'lifted'
               WHERE id = $1 OR (user_id = $2 AND status = 'active')`,
              [restrictionId, targetUserId]
            );
          } else {
            await client.query(
              `UPDATE public.user_restrictions
               SET status = 'lifted'
               WHERE user_id = $1 AND status = 'active'`,
              [targetUserId]
            );
          }
        }

        if (targetUserId) {
          const notifTitle =
            nextStatus === 'approved'
              ? 'Appeal Approved ✅'
              : nextStatus === 'under_review'
              ? 'Appeal Under Review 🔎'
              : 'Appeal Decision Update';
          const notifMessage =
            nextStatus === 'approved'
              ? cleanedResponse ||
                'Your standing appeal has been approved and full access to your ZEV account has been restored.'
              : nextStatus === 'under_review'
              ? cleanedResponse ||
                'Our Safety Team has marked your appeal as Under Review and is carefully evaluating your case.'
              : cleanedResponse ||
                'Your appeal was reviewed and could not be approved at this time. Please review ZEV Community Guidelines.';

          await client.query(
            `INSERT INTO public.user_notifications
             (user_id, title, message, notification_type, app_source, is_read, created_at)
             VALUES ($1, $2, $3, $4, 'zev', false, NOW())`,
            [
              targetUserId,
              notifTitle,
              notifMessage,
              nextStatus === 'approved' ? 'policy_resolved' : 'security_alert',
            ]
          );
          void dispatchAdminPush({
            userId: targetUserId,
            title: notifTitle,
            body: notifMessage,
            notificationType: nextStatus === 'approved' ? 'policy_resolved' : 'security_alert',
            deepLink: '/notifications',
          });
        }

        try {
          await client.query(
            `INSERT INTO public.admin_audit_logs
             (admin_id, action, target_user_id, target_resource_id, details, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              auth.admin.name,
              nextStatus === 'approved'
                ? 'APPROVE_APPEAL'
                : nextStatus === 'under_review'
                ? 'REVIEW_APPEAL'
                : 'REJECT_APPEAL',
              targetUserId,
              appealId,
              JSON.stringify({
                adminKeyName: auth.admin.name,
                restrictionId,
                adminResponse: cleanedResponse || null,
              }),
            ]
          );
        } catch {
          // ignore audit log error
        }

        await client.query('COMMIT');
        return true;
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    });

    // Ensure GoTrue ban state is also cleared when approved
    if (nextStatus === 'approved' && targetUserId) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: 'none',
        });
      } catch (e) {
        console.warn('GoTrue unban warning after appeal approval:', e);
      }
    }

    // Fallback via Supabase HTTPS Service Role ONLY if Direct Postgres is unavailable
    if (!directOk) {
      const { data: appealRow, error: lookupErr } = await supabaseAdmin
        .from('appeals')
        .select('id, user_id, restriction_id')
        .eq('id', appealId)
        .maybeSingle();

      if (lookupErr || !appealRow) {
        return NextResponse.json(
          { success: false, error: lookupErr?.message || 'Appeal record not found' },
          { status: 404 }
        );
      }

      targetUserId = String(appealRow.user_id);
      restrictionId = appealRow.restriction_id ? String(appealRow.restriction_id) : null;

      await supabaseAdmin
        .from('appeals')
        .update({
          status: nextStatus,
          ...(cleanedResponse ? { admin_response: cleanedResponse } : {}),
          reviewed_by: auth.admin.name,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', appealId);

      if (nextStatus === 'approved') {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: 'none',
        });
        await supabaseAdmin
          .from('profiles')
          .update({
            is_banned: false,
            banned_until: null,
            ban_reason: null,
            is_restricted: false,
            restricted_until: null,
            restriction_reason: null,
            account_status: 'active',
            updated_at: nowIso,
          })
          .eq('id', targetUserId);

        await supabaseAdmin
          .from('user_restrictions')
          .update({ status: 'lifted' })
          .eq('user_id', targetUserId)
          .eq('status', 'active');

        if (restrictionId) {
          await supabaseAdmin
            .from('user_restrictions')
            .update({ status: 'lifted' })
            .eq('id', restrictionId);
        }
      }

      const notifTitle =
        nextStatus === 'approved'
          ? 'Appeal Approved ✅'
          : nextStatus === 'under_review'
          ? 'Appeal Under Review 🔎'
          : 'Appeal Decision Update';
      const notifMessage =
        nextStatus === 'approved'
          ? cleanedResponse ||
            'Your standing appeal has been approved and full access to your ZEV account has been restored.'
          : nextStatus === 'under_review'
          ? cleanedResponse ||
            'Our Safety Team has marked your appeal as Under Review and is carefully evaluating your case.'
          : cleanedResponse ||
            'Your appeal was reviewed and could not be approved at this time. Please review ZEV Community Guidelines.';

      await supabaseAdmin.from('user_notifications').insert({
        user_id: targetUserId,
        title: notifTitle,
        message: notifMessage,
        notification_type: nextStatus === 'approved' ? 'policy_resolved' : 'security_alert',
        app_source: 'zev',
        is_read: false,
      });
      void dispatchAdminPush({
        userId: targetUserId,
        title: notifTitle,
        body: notifMessage,
        notificationType: nextStatus === 'approved' ? 'policy_resolved' : 'security_alert',
        deepLink: '/notifications',
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action:
          nextStatus === 'approved'
            ? 'APPROVE_APPEAL'
            : nextStatus === 'under_review'
            ? 'REVIEW_APPEAL'
            : 'REJECT_APPEAL',
        target_user_id: targetUserId,
        target_resource_id: appealId,
        details: {
          adminKeyName: auth.admin.name,
          restrictionId,
          adminResponse: cleanedResponse || null,
        },
        created_at: nowIso,
      });
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      message:
        nextStatus === 'approved'
          ? 'Appeal approved and account standing restored'
          : nextStatus === 'under_review'
          ? 'Appeal moved to Under Review'
          : 'Appeal marked as rejected',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error processing appeal action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update appeal' },
      { status: 500 }
    );
  }
}
