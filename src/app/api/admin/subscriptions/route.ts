import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

function computePlanDates(planTypeRaw: string | null | undefined): {
  planType: string;
  startsAtIso: string;
  expiresAtIso: string | null;
  badgeLabel: string;
} {
  const planType = (planTypeRaw || 'monthly').toLowerCase().trim();
  const now = new Date();
  let expiresAtIso: string | null = null;
  let badgeLabel = 'Verified Creator';

  if (planType === 'monthly') {
    expiresAtIso = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  } else if (planType === 'yearly') {
    expiresAtIso = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
  } else if (planType === 'lifetime_referral') {
    expiresAtIso = null;
    badgeLabel = 'Referral Legend';
  } else if (planType === 'lifetime') {
    expiresAtIso = null;
    badgeLabel = 'Lifetime Founding Creator';
  }

  return {
    planType,
    startsAtIso: now.toISOString(),
    expiresAtIso,
    badgeLabel,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || 'all'; // all, pending, active, cancelled

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      let statusFilter = '';
      const params: string[] = [];
      if (status !== 'all') {
        params.push(status);
        statusFilter = `WHERE s.status = $1`;
      }

      const sql = `
        SELECT 
          s.id,
          s.user_id,
          COALESCE(s.plan_type, s.plan) AS plan_type,
          COALESCE(s.plan_price, '$' || s.amount::text, '$0.00') AS plan_price,
          s.status,
          COALESCE(s.contact_phone, p.phone_number) AS contact_phone,
          s.notes,
          s.starts_at,
          s.expires_at,
          s.created_at,
          s.updated_at,
          p.username,
          p.first_name,
          p.last_name,
          p.email,
          p.avatar_url,
          COALESCE(p.is_verified, false) AS is_verified,
          p.referral_code,
          COALESCE(p.referral_count, 0) AS referral_count
        FROM public.subscriptions s
        LEFT JOIN public.profiles p ON s.user_id = p.id
        ${statusFilter}
        ORDER BY s.created_at DESC
        LIMIT 100
      `;

      const res = await pool.query(sql, params);
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        subscriptions: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS
    let query = supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        profiles:user_id (
          username, first_name, last_name, email, avatar_url, is_verified, referral_code, referral_count
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      source: 'supabase_https',
      subscriptions: data || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, subscriptionId, userId, notes } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing action or userId' },
        { status: 400 }
      );
    }

    const isApprove = action === 'APPROVE_SUBSCRIPTION';

    // Determine exact plan type from subscriptions table so starts_at and expires_at match plan duration
    let resolvedPlanType = 'monthly';
    const lookupOk = await tryDirectQuery(async (pool) => {
      const res = await pool.query(
        `SELECT COALESCE(NULLIF(plan_type, ''), NULLIF(plan, ''), 'monthly') AS plan_type
         FROM public.subscriptions
         WHERE user_id = $1 OR id::text = COALESCE($2, '')
         LIMIT 1`,
        [userId, subscriptionId || null]
      );
      if (res.rows[0]?.plan_type) {
        resolvedPlanType = String(res.rows[0].plan_type);
      }
      return true;
    });

    if (!lookupOk) {
      const { data: subLookup } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_type, plan')
        .eq('user_id', userId)
        .maybeSingle();
      const sRow = subLookup as Record<string, unknown> | null;
      if (sRow?.plan_type || sRow?.plan) {
        resolvedPlanType = String(sRow.plan_type || sRow.plan);
      }
    }

    const { planType, startsAtIso, expiresAtIso, badgeLabel } = computePlanDates(resolvedPlanType);

    // 1. Direct Postgres
    const directOk = await tryDirectQuery(async (pool) => {
      if (isApprove) {
        await pool.query(
          `UPDATE public.subscriptions
           SET status = 'active',
               is_active = true,
               plan_type = $2,
               plan = $2,
               starts_at = $3,
               expires_at = $4,
               notes = COALESCE(NULLIF($5, ''), notes),
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId, planType, startsAtIso, expiresAtIso, notes || '']
        );

        await pool.query(
          `INSERT INTO public.user_verifications (
             user_id, badge_type, status, is_active, plan_type, badge_label, verification_reason, verified_at, expires_at, updated_at
           ) VALUES ($1, 'blue_tick', 'verified', true, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             status = 'verified',
             is_active = true,
             plan_type = EXCLUDED.plan_type,
             badge_label = EXCLUDED.badge_label,
             verification_reason = EXCLUDED.verification_reason,
             verified_at = EXCLUDED.verified_at,
             expires_at = EXCLUDED.expires_at,
             updated_at = NOW()`,
          [
            userId,
            planType,
            badgeLabel,
            `Approved ZEV Blue Subscription (${planType})`,
            startsAtIso,
            expiresAtIso,
          ]
        );

        await pool.query(
          `UPDATE public.profiles
           SET is_verified = true,
               lifetime_blue_eligible = CASE WHEN $2 = 'lifetime_referral' THEN true ELSE lifetime_blue_eligible END,
               updated_at = NOW()
           WHERE id = $1`,
          [userId, planType]
        );

        try {
          await pool.query(
            `INSERT INTO public.user_notifications (user_id, title, message, notification_type, app_source, is_read, created_at)
             VALUES ($1, 'ZEV Blue Activated!', $2, 'verification', 'zev', false, NOW())`,
            [
              userId,
              expiresAtIso
                ? `Your ZEV Blue (${planType}) subscription has been approved and is active until ${new Date(expiresAtIso).toLocaleDateString()}.`
                : 'Your permanent Lifetime ZEV Blue Badge is now active on your profile!',
            ]
          );
        } catch {
          // ignore notification error
        }
      } else {
        await pool.query(
          `UPDATE public.subscriptions
           SET status = 'cancelled', is_active = false, updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
        await pool.query(
          `UPDATE public.user_verifications
           SET status = 'revoked', is_active = false, updated_at = NOW()
           WHERE user_id = $1 AND COALESCE(plan_type, '') NOT IN ('lifetime_referral')`,
          [userId]
        );
        await pool.query(
          `UPDATE public.profiles
           SET is_verified = false, updated_at = NOW()
           WHERE id = $1 AND COALESCE(lifetime_blue_eligible, false) = false`,
          [userId]
        );
      }

      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            auth.admin.name,
            isApprove ? 'APPROVE_SUBSCRIPTION' : 'REJECT_SUBSCRIPTION',
            userId,
            JSON.stringify({ planType, expiresAtIso, subscriptionId }),
          ]
        );
      } catch {
        // ignore audit log error
      }
      return true;
    });

    // 2. Supabase HTTPS Fallback ONLY if Direct PG unavailable
    if (!directOk) {
      if (isApprove) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            is_active: true,
            plan_type: planType,
            plan: planType,
            starts_at: startsAtIso,
            expires_at: expiresAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        await supabaseAdmin
          .from('user_verifications')
          .upsert(
            {
              user_id: userId,
              badge_type: 'blue_tick',
              status: 'verified',
              is_active: true,
              plan_type: planType,
              badge_label: badgeLabel,
              verification_reason: `Approved ZEV Blue Subscription (${planType})`,
              verified_at: startsAtIso,
              expires_at: expiresAtIso,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        await supabaseAdmin
          .from('profiles')
          .update({
            is_verified: true,
            ...(planType === 'lifetime_referral' ? { lifetime_blue_eligible: true } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: 'ZEV Blue Activated!',
          message: expiresAtIso
            ? `Your ZEV Blue (${planType}) subscription has been approved and is active until ${new Date(expiresAtIso).toLocaleDateString()}.`
            : 'Your permanent Lifetime ZEV Blue Badge is now active on your profile!',
          notification_type: 'verification',
          app_source: 'zev',
          is_read: false,
        });
      } else {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled', is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        await supabaseAdmin
          .from('user_verifications')
          .update({ status: 'revoked', is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .neq('plan_type', 'lifetime_referral');

        await supabaseAdmin
          .from('profiles')
          .update({ is_verified: false, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .eq('lifetime_blue_eligible', false);
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: isApprove ? 'APPROVE_SUBSCRIPTION' : 'REJECT_SUBSCRIPTION',
        target_user_id: userId,
        details: { planType, expiresAtIso, subscriptionId },
      });
    }

    if (isApprove) {
      void dispatchAdminPush({
        userId,
        title: 'ZEV Blue Activated!',
        body: expiresAtIso
          ? `Your ZEV Blue (${planType}) subscription has been approved and is active until ${new Date(expiresAtIso).toLocaleDateString()}.`
          : 'Your permanent Lifetime ZEV Blue Badge is now active on your profile!',
        notificationType: 'verification',
        deepLink: '/notifications',
      });
    }

    return NextResponse.json({
      success: true,
      planType,
      expiresAt: expiresAtIso,
      message: isApprove
        ? `Subscription (${planType}) approved and Blue Badge granted!`
        : 'Subscription rejected',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error modifying subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}

