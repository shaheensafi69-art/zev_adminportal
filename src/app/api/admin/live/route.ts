import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const streamId = request.nextUrl.searchParams.get('streamId') || '';

  try {
    // Optional stream detail mode
    if (streamId && UUID_REGEX.test(streamId)) {
      const [commentsRes, viewersRes, reactionsRes] = await Promise.all([
        supabaseAdmin
          .from('live_comments')
          .select('*')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('live_viewers')
          .select('*')
          .eq('stream_id', streamId)
          .order('joined_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('live_reactions')
          .select('*')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const userIds = Array.from(
        new Set(
          [
            ...(commentsRes.data || []).map((c: Record<string, unknown>) => String(c.user_id)),
            ...(viewersRes.data || []).map((v: Record<string, unknown>) => String(v.user_id)),
          ].filter(Boolean)
        )
      );
      const profMap = new Map<string, Record<string, unknown>>();
      if (userIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, username, first_name, last_name, avatar_url, is_verified')
          .in('id', userIds);
        for (const p of (profs || []) as Array<Record<string, unknown>>) {
          profMap.set(String(p.id), p);
        }
      }

      return NextResponse.json({
        success: true,
        comments: (commentsRes.data || []).map((c: Record<string, unknown>) => ({
          ...c,
          ...(profMap.get(String(c.user_id)) || {}),
        })),
        viewers: (viewersRes.data || []).map((v: Record<string, unknown>) => ({
          ...v,
          ...(profMap.get(String(v.user_id)) || {}),
        })),
        reactionsCount: (reactionsRes.data || []).length,
      });
    }

    // Main list (Live streams + Voice/Video calls)
    const directResult = await tryDirectQuery(async (pool) => {
      const [streamsRes, callsRes] = await Promise.all([
        pool.query(`
          SELECT
            ls.*,
            p.username AS host_username,
            p.first_name AS host_first_name,
            p.last_name AS host_last_name,
            p.avatar_url AS host_avatar,
            COALESCE(p.is_verified, false) AS host_is_verified,
            (SELECT COUNT(*)::int FROM public.live_comments lc WHERE lc.stream_id = ls.id) AS comments_count,
            (SELECT COUNT(*)::int FROM public.live_reactions lr WHERE lr.stream_id = ls.id) AS reactions_count
          FROM public.live_streams ls
          LEFT JOIN public.profiles p ON p.id = ls.host_id
          ORDER BY CASE ls.status WHEN 'live' THEN 0 ELSE 1 END, ls.created_at DESC
          LIMIT 100
        `),
        pool.query(`
          SELECT
            cs.*,
            pc.username AS caller_username,
            pc.avatar_url AS caller_avatar,
            pe.username AS callee_username,
            pe.avatar_url AS callee_avatar
          FROM public.call_sessions cs
          LEFT JOIN public.profiles pc ON pc.id = cs.caller_id
          LEFT JOIN public.profiles pe ON pe.id = cs.callee_id
          ORDER BY CASE WHEN cs.status IN ('ringing', 'accepted') THEN 0 ELSE 1 END, cs.created_at DESC
          LIMIT 80
        `),
      ]);
      return { streams: streamsRes.rows, calls: callsRes.rows };
    });

    if (directResult) {
      const { streams, calls } = directResult;
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        streams,
        calls,
        kpis: {
          liveNow: streams.filter((s: { status: string }) => s.status === 'live').length,
          totalStreams: streams.length,
          activeViewers: streams
            .filter((s: { status: string }) => s.status === 'live')
            .reduce((sum: number, s: { viewer_count?: number }) => sum + Number(s.viewer_count || 0), 0),
          peakViewersMax: streams.reduce(
            (mx: number, s: { peak_viewer_count?: number }) => Math.max(mx, Number(s.peak_viewer_count || 0)),
            0
          ),
          activeCalls: calls.filter((c: { status: string }) => c.status === 'ringing' || c.status === 'accepted').length,
          totalCalls: calls.length,
        },
      });
    }

    // HTTPS fallback
    const [{ data: rawStreams, error }, { data: rawCalls }] = await Promise.all([
      supabaseAdmin
        .from('live_streams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('call_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);
    if (error) throw error;

    const list = (rawStreams || []) as Array<Record<string, unknown>>;
    const callList = (rawCalls || []) as Array<Record<string, unknown>>;
    const hostIds = Array.from(
      new Set([
        ...list.map((s) => String(s.host_id)),
        ...callList.map((c) => String(c.caller_id)),
        ...callList.map((c) => String(c.callee_id)),
      ].filter(Boolean))
    );
    const profMap = new Map<string, Record<string, unknown>>();
    if (hostIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, is_verified')
        .in('id', hostIds);
      for (const p of (profs || []) as Array<Record<string, unknown>>) {
        profMap.set(String(p.id), p);
      }
    }

    const streams = list
      .map((ls) => {
        const hp = profMap.get(String(ls.host_id)) || {};
        return {
          ...ls,
          host_username: hp.username ?? null,
          host_first_name: hp.first_name ?? null,
          host_last_name: hp.last_name ?? null,
          host_avatar: hp.avatar_url ?? null,
          host_is_verified: Boolean(hp.is_verified),
        };
      })
      .sort((a, b) => {
        const aLive = (a as Record<string, unknown>).status === 'live' ? 0 : 1;
        const bLive = (b as Record<string, unknown>).status === 'live' ? 0 : 1;
        return aLive - bLive;
      });

    const calls = callList.map((c) => {
      const cp = profMap.get(String(c.caller_id)) || {};
      const ep = profMap.get(String(c.callee_id)) || {};
      return {
        ...c,
        caller_username: cp.username ?? null,
        caller_avatar: cp.avatar_url ?? null,
        callee_username: ep.username ?? null,
        callee_avatar: ep.avatar_url ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      streams,
      calls,
      kpis: {
        liveNow: streams.filter((s) => (s as Record<string, unknown>).status === 'live').length,
        totalStreams: streams.length,
        activeViewers: streams
          .filter((s) => (s as Record<string, unknown>).status === 'live')
          .reduce((sum, s) => sum + Number((s as Record<string, unknown>).viewer_count || 0), 0),
        peakViewersMax: streams.reduce(
          (mx, s) => Math.max(mx, Number((s as Record<string, unknown>).peak_viewer_count || 0)),
          0
        ),
        activeCalls: calls.filter((c) => {
          const st = String((c as Record<string, unknown>).status || '');
          return st === 'ringing' || st === 'accepted';
        }).length,
        totalCalls: calls.length,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error loading live streams:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load live rooms' },
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
      streamId?: string;
      hostId?: string;
      reason?: string;
    };

    if (body.action === 'END_STREAM') {
      const streamId = String(body.streamId || '').trim();
      if (!streamId || !UUID_REGEX.test(streamId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID streamId is required' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();

      await supabaseAdmin
        .from('live_streams')
        .update({ status: 'ended', ended_at: nowIso, viewer_count: 0, updated_at: nowIso })
        .eq('id', streamId);

      await supabaseAdmin
        .from('live_viewers')
        .update({ is_active: false, left_at: nowIso })
        .eq('stream_id', streamId)
        .eq('is_active', true);

      if (body.hostId && UUID_REGEX.test(body.hostId)) {
        const reason = String(body.reason || '').trim() || 'Ended by Trust & Safety moderation.';
        await supabaseAdmin.from('user_notifications').insert({
          user_id: body.hostId,
          title: 'Live Room Ended by Moderation',
          message: reason,
          notification_type: 'security_alert',
          app_source: 'zev',
          is_read: false,
        });
        void dispatchAdminPush({
          userId: body.hostId,
          title: 'Live Room Ended by Moderation',
          body: reason,
          notificationType: 'security_alert',
          deepLink: '/notifications',
        });
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'FORCE_END_LIVE_STREAM',
        target_user_id: body.hostId || null,
        target_resource_id: streamId,
        details: { reason: body.reason || null },
      });

      return NextResponse.json({ success: true, message: 'Live room ended cleanly' });
    }

    if (body.action === 'END_CALL') {
      const callId = String((body as { callId?: string }).callId || '').trim();
      if (!callId || !UUID_REGEX.test(callId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID callId is required' }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from('call_sessions')
        .update({ status: 'ended', ended_at: nowIso, end_reason: 'admin_terminated', updated_at: nowIso })
        .eq('id', callId);
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'FORCE_END_CALL_SESSION',
        target_resource_id: callId,
        details: { reason: body.reason || 'Ended by admin moderation' },
      });
      return NextResponse.json({ success: true, message: 'Call session terminated' });
    }

    return NextResponse.json({ success: false, error: 'Unsupported live action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Live action failed' },
      { status: 500 }
    );
  }
}

