import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPushDetailed } from '@/lib/push';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const userId = request.nextUrl.searchParams.get('userId') || '';

  if (!userId || !UUID_REGEX.test(userId)) {
    return NextResponse.json(
      { success: false, error: 'Valid UUID userId is required' },
      { status: 400 }
    );
  }

  try {
    // 1. Try Direct PostgreSQL
    const directResult = await tryDirectQuery(async (pool) => {
      const [
        postsRes,
        reelsRes,
        followersRes,
        followingRes,
        storiesRes,
        rawProfileRes,
        devicesRes,
        pushSubsRes,
        sessionsRes,
        securityLogsRes,
        notifPrefsRes,
        privacyRes,
        linksRes,
        deletionsRes,
        blocksCountRes,
        mutesCountRes,
        highlightsCountRes,
      ] = await Promise.all([
        pool.query(
          `SELECT
            dp.id, dp.title, dp.content, dp.image_url, dp.created_at,
            COALESCE(dp.likes_count, 0)::int AS likes_count,
            COALESCE(dp.comments_count, 0)::int AS comments_count
          FROM public.discussion_posts dp
          WHERE dp.student_id = $1 AND dp.deleted_at IS NULL
          ORDER BY dp.created_at DESC LIMIT 100`,
          [userId]
        ),
        pool.query(
          `SELECT id, title, description, video_url, thumbnail_url, category, duration_seconds,
            COALESCE(views_count, 0) AS views_count,
            COALESCE(likes_count, 0) AS likes_count,
            COALESCE(comments_count, 0) AS comments_count,
            is_published, created_at
          FROM public.reels WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100`,
          [userId]
        ),
        pool.query(
          `SELECT uf.id, uf.follower_id AS user_id, p.first_name, p.last_name, p.username, p.avatar_url, p.email,
            COALESCE(p.is_verified, false) AS is_verified, uf.created_at
          FROM public.user_follows uf LEFT JOIN public.profiles p ON uf.follower_id = p.id
          WHERE uf.following_id = $1 ORDER BY uf.created_at DESC LIMIT 100`,
          [userId]
        ),
        pool.query(
          `SELECT uf.id, uf.following_id AS user_id, p.first_name, p.last_name, p.username, p.avatar_url, p.email,
            COALESCE(p.is_verified, false) AS is_verified, uf.created_at
          FROM public.user_follows uf LEFT JOIN public.profiles p ON uf.following_id = p.id
          WHERE uf.follower_id = $1 ORDER BY uf.created_at DESC LIMIT 100`,
          [userId]
        ),
        pool.query(
          `SELECT id, media_url, media_type, caption, duration_seconds, expires_at, created_at
          FROM public.user_stories WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`,
          [userId]
        ),
        pool.query(
          `SELECT p.*, u.email_confirmed_at, u.banned_until, u.last_sign_in_at,
            u.created_at AS auth_created_at, u.raw_app_meta_data, u.raw_user_meta_data
          FROM auth.users u LEFT JOIN public.profiles p ON u.id = p.id WHERE u.id = $1`,
          [userId]
        ),
        pool.query(
          `SELECT id, user_id, device_id, fcm_token, platform, device_name, app_version, is_active, last_seen_at, token_updated_at, created_at
          FROM public.user_devices WHERE user_id = $1 ORDER BY last_seen_at DESC NULLS LAST, created_at DESC LIMIT 30`,
          [userId]
        ),
        pool.query(
          `SELECT id, user_id, fcm_token, app_name, device_type AS platform, device_name, is_active, created_at
          FROM public.push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
          [userId]
        ),
        pool.query(
          `SELECT id, user_id, device_id, platform, device_name, app_version, ip_address, user_agent, is_active, started_at, last_active_at, ended_at, duration_seconds, created_at
          FROM public.user_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 30`,
          [userId]
        ),
        pool.query(
          `SELECT id, user_id, event_type, status, ip_address, device_id, platform, user_agent, metadata, created_at
          FROM public.user_security_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
          [userId]
        ),
        pool.query(`SELECT * FROM public.notification_preferences WHERE user_id = $1 LIMIT 1`, [userId]),
        pool.query(`SELECT * FROM public.user_privacy_settings WHERE user_id = $1 LIMIT 1`, [userId]),
        pool.query(`SELECT id, title, url, sort_order FROM public.user_links WHERE user_id = $1 ORDER BY sort_order ASC`, [userId]),
        pool.query(`SELECT * FROM public.account_deletions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM public.user_blocks WHERE blocker_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM public.user_mutes WHERE muter_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM public.user_highlights WHERE user_id = $1`, [userId]),
      ]);

      const mergedDevices = [
        ...devicesRes.rows,
        ...pushSubsRes.rows.map((ps) => ({
          id: ps.id,
          user_id: ps.user_id,
          device_id: `sub:${String(ps.id).slice(0, 8)}`,
          fcm_token: ps.fcm_token,
          platform: ps.platform || ps.app_name || 'legacy_sub',
          device_name: ps.device_name,
          app_version: ps.app_name,
          is_active: ps.is_active,
          last_seen_at: ps.created_at,
          token_updated_at: ps.created_at,
          created_at: ps.created_at,
        })),
      ];

      return {
        posts: postsRes.rows,
        reels: reelsRes.rows,
        followers: followersRes.rows,
        following: followingRes.rows,
        stories: storiesRes.rows,
        devices: mergedDevices,
        sessions: sessionsRes.rows,
        securityLogs: securityLogsRes.rows,
        notificationPreferences: notifPrefsRes.rows[0] || null,
        privacySettings: privacyRes.rows[0] || null,
        links: linksRes.rows,
        deletions: deletionsRes.rows,
        blocksCount: Number(blocksCountRes.rows[0]?.cnt || 0),
        mutesCount: Number(mutesCountRes.rows[0]?.cnt || 0),
        highlightsCount: Number(highlightsCountRes.rows[0]?.cnt || 0),
        rawProfile: rawProfileRes.rows[0] || {},
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        activity: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    const [
      authUserRes,
      profileRes,
      postsRes,
      reelsRes,
      followersRawRes,
      followingRawRes,
      storiesRes,
      devicesRes,
      pushSubsRes,
      sessionsRes,
      securityLogsRes,
      notifPrefsRes,
      privacyRes,
      linksRes,
      deletionsRes,
      blocksCountRes,
      mutesCountRes,
      highlightsCountRes,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin
        .from('discussion_posts')
        .select('id, title, content, image_url, created_at, likes_count, comments_count')
        .eq('student_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('reels')
        .select('id, title, description, video_url, thumbnail_url, category, duration_seconds, views_count, likes_count, comments_count, is_published, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('user_follows')
        .select('id, follower_id, created_at')
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('user_follows')
        .select('id, following_id, created_at')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('user_stories')
        .select('id, media_url, media_type, caption, duration_seconds, expires_at, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('user_devices')
        .select('id, user_id, device_id, fcm_token, platform, device_name, app_version, is_active, last_seen_at, token_updated_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('push_subscriptions')
        .select('id, user_id, fcm_token, app_name, device_type, device_name, is_active, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('user_security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabaseAdmin.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_privacy_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_links').select('id, title, url, sort_order').eq('user_id', userId).order('sort_order', { ascending: true }),
      supabaseAdmin.from('account_deletions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('user_blocks').select('id', { count: 'exact', head: true }).eq('blocker_id', userId),
      supabaseAdmin.from('user_mutes').select('id', { count: 'exact', head: true }).eq('muter_id', userId),
      supabaseAdmin.from('user_highlights').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    const followerRows = (followersRawRes.data || []) as Array<{ id: string; follower_id: string; created_at: string }>;
    const followingRows = (followingRawRes.data || []) as Array<{ id: string; following_id: string; created_at: string }>;
    const followProfileIds = Array.from(
      new Set([
        ...followerRows.map((r) => r.follower_id),
        ...followingRows.map((r) => r.following_id),
      ].filter(Boolean))
    );

    const followProfileMap = new Map<string, Record<string, unknown>>();
    if (followProfileIds.length > 0) {
      const { data: fp } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, username, avatar_url, email, is_verified')
        .in('id', followProfileIds);
      for (const row of (fp || []) as Array<Record<string, unknown>>) {
        followProfileMap.set(String(row.id), row);
      }
    }

    const followers = followerRows.map((r) => {
      const p = followProfileMap.get(r.follower_id) || {};
      return {
        id: r.id,
        user_id: r.follower_id,
        first_name: (p.first_name as string) ?? null,
        last_name: (p.last_name as string) ?? null,
        username: (p.username as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        email: (p.email as string) ?? null,
        is_verified: Boolean(p.is_verified),
        created_at: r.created_at,
      };
    });

    const following = followingRows.map((r) => {
      const p = followProfileMap.get(r.following_id) || {};
      return {
        id: r.id,
        user_id: r.following_id,
        first_name: (p.first_name as string) ?? null,
        last_name: (p.last_name as string) ?? null,
        username: (p.username as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        email: (p.email as string) ?? null,
        is_verified: Boolean(p.is_verified),
        created_at: r.created_at,
      };
    });

    const mergedDevices = [
      ...(devicesRes.data || []),
      ...((pushSubsRes.data || []) as Array<Record<string, unknown>>).map((ps) => ({
        id: String(ps.id),
        user_id: String(ps.user_id),
        device_id: `sub:${String(ps.id).slice(0, 8)}`,
        fcm_token: ps.fcm_token ? String(ps.fcm_token) : null,
        platform: String(ps.device_type || ps.app_name || 'legacy_sub'),
        device_name: ps.device_name ? String(ps.device_name) : null,
        app_version: ps.app_name ? String(ps.app_name) : null,
        is_active: Boolean(ps.is_active),
        last_seen_at: ps.created_at ? String(ps.created_at) : null,
        token_updated_at: ps.created_at ? String(ps.created_at) : null,
        created_at: String(ps.created_at || ''),
      })),
    ];

    const authU = authUserRes.data?.user;
    const rawProfile = {
      ...(profileRes.data || {}),
      email_confirmed_at: authU?.email_confirmed_at ?? null,
      banned_until: (authU as unknown as { banned_until?: string | null })?.banned_until ?? null,
      last_sign_in_at: authU?.last_sign_in_at ?? null,
      auth_created_at: authU?.created_at ?? null,
      raw_app_meta_data: authU?.app_metadata ?? null,
      raw_user_meta_data: authU?.user_metadata ?? null,
    };

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      activity: {
        posts: postsRes.data || [],
        reels: reelsRes.data || [],
        followers,
        following,
        stories: storiesRes.data || [],
        devices: mergedDevices,
        sessions: sessionsRes.data || [],
        securityLogs: securityLogsRes.data || [],
        notificationPreferences: notifPrefsRes.data || null,
        privacySettings: privacyRes.data || null,
        links: linksRes.data || [],
        deletions: deletionsRes.data || [],
        blocksCount: blocksCountRes.count || 0,
        mutesCount: mutesCountRes.count || 0,
        highlightsCount: highlightsCountRes.count || 0,
        rawProfile,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching user full activity:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load user activity' },
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
      userId?: string;
      deviceId?: string;
      title?: string;
      message?: string;
      deepLink?: string;
    };

    const { action, userId } = body;
    if (!action || !userId || !UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Valid action and UUID userId are required' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === 'SEND_DIRECT_PUSH') {
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const deepLink = String(body.deepLink || '/notifications').trim() || '/notifications';
      if (!title || !message) {
        return NextResponse.json(
          { success: false, error: 'Title and message are required' },
          { status: 400 }
        );
      }

      await supabaseAdmin.from('user_notifications').insert({
        user_id: userId,
        title: title.slice(0, 120),
        message: message.slice(0, 500),
        notification_type: 'system',
        link_url: deepLink,
        app_source: 'zev',
        is_read: false,
      });

      const pushRes = await dispatchAdminPushDetailed({
        userId,
        title,
        body: message,
        notificationType: 'system',
        deepLink,
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'SEND_DIRECT_PUSH',
        target_user_id: userId,
        details: { title, ...pushRes },
      });

      return NextResponse.json({
        success: true,
        pushResult: pushRes,
        message:
          pushRes.sent > 0
            ? `In-app & FCM push delivered (${pushRes.sent}/${pushRes.targeted} devices)`
            : `In-app notification saved (${pushRes.error || 'no active FCM token'})`,
      });
    }

    if (action === 'REVOKE_USER_SESSIONS') {
      await supabaseAdmin
        .from('user_sessions')
        .update({ is_active: false, ended_at: nowIso })
        .eq('user_id', userId)
        .eq('is_active', true);

      try {
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      } catch {
        // ignore if user has no auth session
      }

      await supabaseAdmin.from('user_security_logs').insert({
        user_id: userId,
        event_type: 'admin_force_logout',
        status: 'success',
        metadata: { revoked_by: auth.admin.name },
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'REVOKE_USER_SESSIONS',
        target_user_id: userId,
      });

      return NextResponse.json({
        success: true,
        message: 'All active sessions revoked for user',
      });
    }

    if (action === 'TOGGLE_DEVICE' && body.deviceId) {
      await supabaseAdmin
        .from('user_devices')
        .update({ is_active: false, updated_at: nowIso })
        .eq('id', body.deviceId)
        .eq('user_id', userId);

      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: nowIso })
        .eq('id', body.deviceId)
        .eq('user_id', userId);

      return NextResponse.json({
        success: true,
        message: 'Device push registration deactivated',
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'User activity action failed' },
      { status: 500 }
    );
  }
}
