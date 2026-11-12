import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPushDetailed } from '@/lib/push';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const directResult = await tryDirectQuery(async (pool) => {
      const [devicesRes, pushSubsRes, deliveriesRes, recentNotifsRes, statsRes] = await Promise.all([
        pool.query(`
          SELECT d.*, p.username, p.first_name, p.last_name, p.email, p.avatar_url, COALESCE(p.is_verified, false) AS is_verified
          FROM public.user_devices d
          LEFT JOIN public.profiles p ON p.id = d.user_id
          ORDER BY d.last_seen_at DESC NULLS LAST, d.created_at DESC
          LIMIT 150
        `),
        pool.query(`
          SELECT ps.*, p.username, p.first_name, p.last_name, p.email
          FROM public.push_subscriptions ps
          LEFT JOIN public.profiles p ON p.id = ps.user_id
          ORDER BY ps.created_at DESC
          LIMIT 100
        `),
        pool.query(`
          SELECT nd.*, p.username, p.first_name, p.last_name, p.email
          FROM public.notification_deliveries nd
          LEFT JOIN public.profiles p ON p.id = nd.user_id
          ORDER BY nd.created_at DESC
          LIMIT 100
        `),
        pool.query(`
          SELECT n.*, p.username, p.first_name, p.last_name
          FROM public.user_notifications n
          LEFT JOIN public.profiles p ON p.id = n.user_id
          WHERE n.notification_type IN ('system', 'announcement', 'admin_broadcast', 'verification', 'policy_resolved', 'security_alert')
          ORDER BY n.created_at DESC
          LIMIT 60
        `),
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM public.user_devices WHERE is_active = true) AS active_devices,
            (SELECT COUNT(*)::int FROM public.user_devices WHERE is_active = true AND LOWER(COALESCE(platform,'')) = 'android') AS android_devices,
            (SELECT COUNT(*)::int FROM public.user_devices WHERE is_active = true AND LOWER(COALESCE(platform,'')) = 'ios') AS ios_devices,
            (SELECT COUNT(*)::int FROM public.push_subscriptions WHERE is_active = true) AS active_push_subs,
            (SELECT COALESCE(SUM(sent_count), 0)::int FROM public.notification_deliveries) AS sent_total,
            (SELECT COALESCE(SUM(failed_count), 0)::int FROM public.notification_deliveries) AS failed_total,
            (SELECT COUNT(*)::int FROM public.user_notifications) AS total_notifications
        `),
      ]);

      const s = statsRes.rows[0] || {};
      return {
        devices: devicesRes.rows,
        pushSubscriptions: pushSubsRes.rows,
        deliveries: deliveriesRes.rows,
        recentSystemNotifications: recentNotifsRes.rows,
        kpis: {
          activeDevices: Number(s.active_devices || 0),
          androidDevices: Number(s.android_devices || 0),
          iosDevices: Number(s.ios_devices || 0),
          activePushSubs: Number(s.active_push_subs || 0),
          sentTotal: Number(s.sent_total || 0),
          failedTotal: Number(s.failed_total || 0),
          totalNotifications: Number(s.total_notifications || 0),
          fcmConfigured: Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()),
        },
      };
    });

    if (directResult) {
      return NextResponse.json({ success: true, source: 'direct_postgres', ...directResult });
    }

    // 2. Fallback: Supabase HTTPS
    const [devicesRes, pushSubsRes, deliveriesRes, recentNotifsRes, totalNotifsCountRes] = await Promise.all([
      supabaseAdmin.from('user_devices').select('*').order('created_at', { ascending: false }).limit(150),
      supabaseAdmin.from('push_subscriptions').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('notification_deliveries').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin
        .from('user_notifications')
        .select('*')
        .in('notification_type', ['system', 'announcement', 'admin_broadcast', 'verification', 'policy_resolved', 'security_alert'])
        .order('created_at', { ascending: false })
        .limit(60),
      supabaseAdmin.from('user_notifications').select('id', { count: 'exact', head: true }),
    ]);

    if (devicesRes.error) throw devicesRes.error;

    const rawDevices = (devicesRes.data || []) as Array<Record<string, unknown>>;
    const rawSubs = (pushSubsRes.data || []) as Array<Record<string, unknown>>;
    const rawDeliveries = (deliveriesRes.data || []) as Array<Record<string, unknown>>;
    const rawNotifs = (recentNotifsRes.data || []) as Array<Record<string, unknown>>;

    const userIds = Array.from(
      new Set(
        [...rawDevices, ...rawSubs, ...rawDeliveries, ...rawNotifs]
          .map((r) => (r.user_id ? String(r.user_id) : ''))
          .filter(Boolean)
      )
    );

    const profMap = new Map<string, Record<string, unknown>>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, username, first_name, last_name, email, avatar_url, is_verified')
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
          is_verified: Boolean(p.is_verified),
        };
      });

    const activeDevicesList = rawDevices.filter((d) => Boolean(d.is_active));
    const sentTotal = rawDeliveries.reduce((sum, r) => sum + Number(r.sent_count || 0), 0);
    const failedTotal = rawDeliveries.reduce((sum, r) => sum + Number(r.failed_count || 0), 0);

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      devices: withProfile(rawDevices),
      pushSubscriptions: withProfile(rawSubs),
      deliveries: withProfile(rawDeliveries),
      recentSystemNotifications: withProfile(rawNotifs),
      kpis: {
        activeDevices: activeDevicesList.length,
        androidDevices: activeDevicesList.filter((d) => String(d.platform || '').toLowerCase() === 'android').length,
        iosDevices: activeDevicesList.filter((d) => String(d.platform || '').toLowerCase() === 'ios').length,
        activePushSubs: rawSubs.filter((s) => Boolean(s.is_active)).length,
        sentTotal,
        failedTotal,
        totalNotifications: totalNotifsCountRes.count || 0,
        fcmConfigured: Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error loading notifications telemetry:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load push telemetry' },
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
      usernameOrId?: string;
      segment?: 'active_devices' | 'verified' | 'all_profiles';
      title?: string;
      message?: string;
      deepLink?: string;
      deviceId?: string;
      isActive?: boolean;
    };

    const action = String(body.action || '').toUpperCase();

    if (action === 'TOGGLE_DEVICE_STATUS') {
      const deviceId = String(body.deviceId || '').trim();
      const nextActive = Boolean(body.isActive);
      if (!deviceId || !UUID_REGEX.test(deviceId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID deviceId required' }, { status: 400 });
      }
      await supabaseAdmin
        .from('user_devices')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', deviceId);

      return NextResponse.json({
        success: true,
        message: nextActive ? 'Device token re-enabled' : 'Device token deactivated',
      });
    }

    if (action === 'SEND_USER_PUSH') {
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const deepLink = String(body.deepLink || '/notifications').trim() || '/notifications';
      let targetUserId = String(body.userId || '').trim();
      const lookup = String(body.usernameOrId || '').trim().replace(/^@/, '');

      if (!targetUserId && lookup) {
        if (UUID_REGEX.test(lookup)) {
          targetUserId = lookup;
        } else {
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('username', lookup)
            .maybeSingle();
          if (prof?.id) targetUserId = String(prof.id);
        }
      }

      if (!targetUserId || !UUID_REGEX.test(targetUserId) || !title || !message) {
        return NextResponse.json(
          { success: false, error: 'Valid recipient username/UUID, title, and message are required' },
          { status: 400 }
        );
      }

      await supabaseAdmin.from('user_notifications').insert({
        user_id: targetUserId,
        title: title.slice(0, 120),
        message: message.slice(0, 500),
        notification_type: 'system',
        link_url: deepLink,
        app_source: 'zev',
        is_read: false,
      });

      const pushRes = await dispatchAdminPushDetailed({
        userId: targetUserId,
        title,
        body: message,
        notificationType: 'system',
        deepLink,
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'ADMIN_DIRECT_PUSH',
        target_user_id: targetUserId,
        details: { title, deepLink, ...pushRes },
      });

      return NextResponse.json({
        success: true,
        pushResult: pushRes,
        message:
          pushRes.sent > 0
            ? `Delivered in-app + FCM push (${pushRes.sent}/${pushRes.targeted} devices)`
            : `In-app notification saved; FCM skipped (${pushRes.error || 'no active token'})`,
      });
    }

    if (action === 'BROADCAST_ANNOUNCEMENT') {
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const deepLink = String(body.deepLink || '/notifications').trim() || '/notifications';
      const segment = body.segment || 'active_devices';

      if (!title || !message) {
        return NextResponse.json({ success: false, error: 'Title and message are required' }, { status: 400 });
      }

      const targetIds = new Set<string>();
      if (segment === 'active_devices') {
        const { data: dRows } = await supabaseAdmin
          .from('user_devices')
          .select('user_id')
          .eq('is_active', true);
        for (const r of (dRows || []) as Array<{ user_id: string }>) {
          if (r.user_id) targetIds.add(r.user_id);
        }
      } else if (segment === 'verified') {
        const { data: pRows } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('is_verified', true)
          .limit(500);
        for (const r of (pRows || []) as Array<{ id: string }>) targetIds.add(r.id);
      } else {
        const { data: pRows } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .limit(500);
        for (const r of (pRows || []) as Array<{ id: string }>) targetIds.add(r.id);
      }

      const recipientList = Array.from(targetIds);
      if (recipientList.length === 0) {
        return NextResponse.json({ success: false, error: 'No recipients matched this segment' }, { status: 400 });
      }

      // Insert in-app notification rows in batches of 100
      for (let i = 0; i < recipientList.length; i += 100) {
        const batch = recipientList.slice(i, i + 100).map((uid) => ({
          user_id: uid,
          title: title.slice(0, 120),
          message: message.slice(0, 500),
          notification_type: 'announcement',
          link_url: deepLink,
          app_source: 'zev',
          is_read: false,
        }));
        await supabaseAdmin.from('user_notifications').insert(batch);
      }

      // Dispatch push in parallel chunks (capped for fast response)
      let totalSent = 0;
      let totalTargeted = 0;
      for (let i = 0; i < recipientList.length; i += 10) {
        const chunk = recipientList.slice(i, i + 10);
        const results = await Promise.all(
          chunk.map((uid) =>
            dispatchAdminPushDetailed({
              userId: uid,
              title,
              body: message,
              notificationType: 'announcement',
              deepLink,
            })
          )
        );
        for (const r of results) {
          totalSent += r.sent;
          totalTargeted += r.targeted;
        }
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'ADMIN_BROADCAST_PUSH',
        details: { segment, title, recipients: recipientList.length, totalTargeted, totalSent },
      });

      return NextResponse.json({
        success: true,
        recipients: recipientList.length,
        totalTargeted,
        totalSent,
        message: `Broadcast queued for ${recipientList.length} accounts (${totalSent}/${totalTargeted} FCM deliveries succeeded)`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported notification action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Notification admin action error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process push action' },
      { status: 500 }
    );
  }
}

