import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const directResult = await tryDirectQuery(async (pool) => {
      const [sessionsRes, trustedRes, logsRes, deletionsRes] = await Promise.all([
        pool.query(`
          SELECT s.*, p.username, p.first_name, p.last_name, p.email, p.avatar_url
          FROM public.user_sessions s
          LEFT JOIN public.profiles p ON p.id = s.user_id
          ORDER BY s.is_active DESC, s.started_at DESC
          LIMIT 150
        `),
        pool.query(`
          SELECT td.*, p.username, p.first_name, p.last_name, p.email
          FROM public.user_trusted_devices td
          LEFT JOIN public.profiles p ON p.id = td.user_id
          ORDER BY td.last_authenticated_at DESC NULLS LAST, td.created_at DESC
          LIMIT 100
        `),
        pool.query(`
          SELECT l.*, p.username, p.first_name, p.last_name, p.email
          FROM public.user_security_logs l
          LEFT JOIN public.profiles p ON p.id = l.user_id
          ORDER BY l.created_at DESC
          LIMIT 150
        `),
        pool.query(`
          SELECT ad.*, p.username, p.first_name, p.last_name, p.email
          FROM public.account_deletions ad
          LEFT JOIN public.profiles p ON p.id = ad.user_id
          ORDER BY ad.created_at DESC
          LIMIT 100
        `),
      ]);

      return {
        sessions: sessionsRes.rows,
        trustedDevices: trustedRes.rows,
        securityLogs: logsRes.rows,
        deletions: deletionsRes.rows,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
        kpis: {
          activeSessions: directResult.sessions.filter((s: { is_active: boolean }) => s.is_active).length,
          trustedDevices: directResult.trustedDevices.filter((d: { is_trusted: boolean }) => d.is_trusted).length,
          securityEvents: directResult.securityLogs.length,
          pendingDeletions: directResult.deletions.filter(
            (d: { status: string }) => d.status === 'pending' || d.status === 'requested'
          ).length,
        },
      });
    }

    // HTTPS fallback
    const [sessionsRes, trustedRes, logsRes, deletionsRes] = await Promise.all([
      supabaseAdmin.from('user_sessions').select('*').order('started_at', { ascending: false }).limit(150),
      supabaseAdmin.from('user_trusted_devices').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('user_security_logs').select('*').order('created_at', { ascending: false }).limit(150),
      supabaseAdmin.from('account_deletions').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (sessionsRes.error) throw sessionsRes.error;

    const rawSessions = (sessionsRes.data || []) as Array<Record<string, unknown>>;
    const rawTrusted = (trustedRes.data || []) as Array<Record<string, unknown>>;
    const rawLogs = (logsRes.data || []) as Array<Record<string, unknown>>;
    const rawDeletions = (deletionsRes.data || []) as Array<Record<string, unknown>>;

    const userIds = Array.from(
      new Set(
        [...rawSessions, ...rawTrusted, ...rawLogs, ...rawDeletions]
          .map((r) => (r.user_id ? String(r.user_id) : ''))
          .filter(Boolean)
      )
    );

    const profMap = new Map<string, Record<string, unknown>>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, username, first_name, last_name, email, avatar_url')
        .in('id', userIds);
      for (const p of (profs || []) as Array<Record<string, unknown>>) {
        profMap.set(String(p.id), p);
      }
    }

    const withProfile = (rows: Array<Record<string, unknown>>) =>
      rows.map((r) => {
        const p = profMap.get(String(r.user_id || '')) || {};
        return {
          ...r,
          username: p.username ?? null,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          email: p.email ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      });

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      sessions: withProfile(rawSessions),
      trustedDevices: withProfile(rawTrusted),
      securityLogs: withProfile(rawLogs),
      deletions: withProfile(rawDeletions),
      kpis: {
        activeSessions: rawSessions.filter((s) => Boolean(s.is_active)).length,
        trustedDevices: rawTrusted.filter((d) => Boolean(d.is_trusted)).length,
        securityEvents: rawLogs.length,
        pendingDeletions: rawDeletions.filter((d) => d.status === 'pending' || d.status === 'requested').length,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error loading security & sessions data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load security telemetry' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      action?: string;
      sessionId?: string;
      userId?: string;
      deletionId?: string;
      status?: string;
    };

    const action = String(body.action || '').toUpperCase();
    const nowIso = new Date().toISOString();

    if (action === 'REVOKE_SESSION') {
      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId || !UUID_REGEX.test(sessionId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID sessionId required' }, { status: 400 });
      }
      await supabaseAdmin
        .from('user_sessions')
        .update({ is_active: false, ended_at: nowIso })
        .eq('id', sessionId);

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'REVOKE_SESSION',
        target_resource_id: sessionId,
      });

      return NextResponse.json({ success: true, message: 'Session terminated' });
    }

    if (action === 'REVOKE_ALL_USER_SESSIONS') {
      const userId = String(body.userId || '').trim();
      if (!userId || !UUID_REGEX.test(userId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID userId required' }, { status: 400 });
      }
      await supabaseAdmin
        .from('user_sessions')
        .update({ is_active: false, ended_at: nowIso })
        .eq('user_id', userId)
        .eq('is_active', true);

      try {
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      } catch {
        // ignore if user already signed out
      }

      await supabaseAdmin.from('user_security_logs').insert({
        user_id: userId,
        event_type: 'admin_force_logout',
        status: 'success',
        metadata: { admin: auth.admin.name },
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'REVOKE_ALL_USER_SESSIONS',
        target_user_id: userId,
      });

      return NextResponse.json({ success: true, message: 'All active sessions signed out' });
    }

    if (action === 'UPDATE_DELETION_STATUS') {
      const deletionId = String(body.deletionId || '').trim();
      const status = String(body.status || 'completed').trim();
      if (!deletionId || !UUID_REGEX.test(deletionId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID deletionId required' }, { status: 400 });
      }
      await supabaseAdmin
        .from('account_deletions')
        .update({
          status,
          completed_at: status === 'completed' ? nowIso : null,
        })
        .eq('id', deletionId);

      return NextResponse.json({ success: true, message: `Deletion request marked as ${status}` });
    }

    return NextResponse.json({ success: false, error: 'Unsupported security action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Security action failed' },
      { status: 500 }
    );
  }
}

