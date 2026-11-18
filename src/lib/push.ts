import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number; projectId: string } | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getFirebaseServiceAccount(): ServiceAccountJson | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getFirebaseAccessToken(sa: ServiceAccountJson): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    cachedAccessToken &&
    cachedAccessToken.projectId === sa.project_id &&
    cachedAccessToken.expiresAt - 60 > nowSec
  ) {
    return cachedAccessToken.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const unsignedJwt = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = base64UrlEncode(signer.sign(sa.private_key));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: nowSec + (data.expires_in ?? 3500),
    projectId: sa.project_id,
  };
  return data.access_token;
}

export interface AdminPushParams {
  userId: string;
  title: string;
  body: string;
  notificationType?: string;
  deepLink?: string;
  imageUrl?: string;
}

export interface AdminPushResult {
  targeted: number;
  sent: number;
  failed: number;
  invalidRemoved: number;
  mode: 'fcm_direct' | 'zev_web_proxy' | 'none';
  error?: string;
}

function resolveAndroidChannelId(rawType: string): string {
  const t = rawType.toLowerCase().trim();
  if (t === 'voice_call') return 'zev_channel_voice_calls';
  if (t === 'video_call') return 'zev_channel_video_calls';
  if (
    t === 'message' ||
    t === 'chat' ||
    t === 'direct_message' ||
    t === 'dm' ||
    t.includes('chat')
  ) {
    return 'zev_channel_messages';
  }
  if (
    t === 'group_message' ||
    t === 'group_chat' ||
    t === 'group_invitation' ||
    t.includes('group')
  ) {
    return 'zev_channel_groups';
  }
  if (t.includes('like')) return 'zev_channel_likes';
  if (t.includes('comment') || t.includes('reply')) return 'zev_channel_comments';
  if (t === 'friend_request' || t === 'follow_request') return 'zev_channel_friend_requests';
  if (t.includes('follow')) return 'zev_channel_followers';
  if (t.includes('story') || t.includes('mention') || t.includes('tag')) {
    return 'zev_channel_stories';
  }
  if (t.includes('share') || t.includes('repost')) return 'zev_channel_shares';
  if (
    t.includes('security') ||
    t.includes('login') ||
    t.includes('password') ||
    t.includes('verify') ||
    t.includes('auth')
  ) {
    return 'zev_channel_security';
  }
  return 'zev_notifications_channel';
}

/**
 * Best-effort FCM push dispatcher for admin moderation / verification / billing events.
 * Uses `FIREBASE_SERVICE_ACCOUNT_JSON` directly when present, or forwards via
 * `CRON_SECRET_KEY` to `zev-web` `/api/v1/push/send`. Never throws into admin mutations.
 */
export async function dispatchAdminPushDetailed({
  userId,
  title,
  body,
  notificationType = 'system',
  deepLink = '/notifications',
  imageUrl,
}: AdminPushParams): Promise<AdminPushResult> {
  const uid = String(userId || '').trim();
  if (!uid || !title.trim() || !body.trim()) {
    return { targeted: 0, sent: 0, failed: 0, invalidRemoved: 0, mode: 'none', error: 'Missing required fields' };
  }

  try {
    const sa = getFirebaseServiceAccount();
    if (!sa) {
      const cronSecret = (process.env.CRON_SECRET_KEY || '').trim();
      const baseUrl = (process.env.ZEV_WEB_URL || 'https://www.zevapp.com').replace(/\/+$/, '');
      if (!cronSecret) {
        return { targeted: 0, sent: 0, failed: 0, invalidRemoved: 0, mode: 'none', error: 'Neither FIREBASE_SERVICE_ACCOUNT_JSON nor CRON_SECRET_KEY configured' };
      }

      const proxyRes = await fetch(`${baseUrl}/api/v1/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
        },
        body: JSON.stringify({
          recipientUserId: uid,
          title: title.slice(0, 120),
          body: body.slice(0, 500),
          notificationType,
          deepLink,
        }),
      });
      const json = (await proxyRes.json().catch(() => ({}))) as { sentCount?: number; targeted?: number; error?: string };
      return {
        targeted: json.targeted ?? (json.sentCount ? 1 : 0),
        sent: json.sentCount ?? (proxyRes.ok ? 1 : 0),
        failed: proxyRes.ok ? 0 : 1,
        invalidRemoved: 0,
        mode: 'zev_web_proxy',
        error: proxyRes.ok ? undefined : json.error || `HTTP ${proxyRes.status}`,
      };
    }

    const tokenSet = new Set<string>();
    const inactiveTokenSet = new Set<string>();

    const [devicesRes, pushRes, profileRes] = await Promise.allSettled([
      supabaseAdmin
        .from('user_devices')
        .select('fcm_token, is_active')
        .eq('user_id', uid),
      supabaseAdmin
        .from('push_subscriptions')
        .select('fcm_token, is_active')
        .eq('user_id', uid),
      supabaseAdmin
        .from('profiles')
        .select('fcm_token')
        .eq('id', uid)
        .maybeSingle(),
    ]);

    if (devicesRes.status === 'fulfilled' && Array.isArray(devicesRes.value.data)) {
      for (const row of devicesRes.value.data) {
        const tok = String((row as { fcm_token?: unknown }).fcm_token || '').trim();
        const isActive = (row as { is_active?: unknown }).is_active === true;
        if (tok.length > 20) {
          if (isActive) {
            tokenSet.add(tok);
          } else {
            inactiveTokenSet.add(tok);
          }
        }
      }
    }

    if (pushRes.status === 'fulfilled' && Array.isArray(pushRes.value.data)) {
      for (const row of pushRes.value.data) {
        const tok = String((row as { fcm_token?: unknown }).fcm_token || '').trim();
        const isActive = (row as { is_active?: unknown }).is_active === true;
        if (tok.length > 20) {
          if (isActive && !inactiveTokenSet.has(tok)) {
            tokenSet.add(tok);
          } else if (!isActive) {
            inactiveTokenSet.add(tok);
          }
        }
      }
    }

    if (profileRes.status === 'fulfilled' && profileRes.value.data) {
      const tok = String((profileRes.value.data as { fcm_token?: unknown }).fcm_token || '').trim();
      if (tok.length > 20) {
        if (inactiveTokenSet.has(tok)) {
          // Clean inactive token from profiles so it never gets targeted again
          void supabaseAdmin
            .from('profiles')
            .update({ fcm_token: null, updated_at: new Date().toISOString() })
            .eq('id', uid);
        } else if (tokenSet.size === 0) {
          tokenSet.add(tok);
        }
      }
    }

    // Filter out any tokens explicitly marked inactive
    for (const inact of inactiveTokenSet) {
      tokenSet.delete(inact);
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) {
      return { targeted: 0, sent: 0, failed: 0, invalidRemoved: 0, mode: 'fcm_direct', error: 'No active FCM device tokens found for user' };
    }

    const accessToken = await getFirebaseAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const invalidTokens: string[] = [];
    let sentCount = 0;
    let lastError: string | null = null;

    const defaultAppLogo = 'https://www.zevapp.com/assets/icon/icon-512x512.png';
    const isSystemOrSecurity =
      notificationType === 'system' ||
      notificationType === 'security_alert' ||
      notificationType === 'moderation';
    const resolvedImageUrl =
      (imageUrl || '').trim() || (isSystemOrSecurity ? defaultAppLogo : '');
    const resolvedChannelId = resolveAndroidChannelId(notificationType);

    for (const token of tokens) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: title.slice(0, 120),
              body: body.slice(0, 500),
              ...(resolvedImageUrl ? { image: resolvedImageUrl } : {}),
            },
            data: {
              title: title.slice(0, 120),
              body: body.slice(0, 500),
              message: body.slice(0, 500),
              type: notificationType,
              notification_type: notificationType,
              recipient_user_id: uid,
              deep_link: deepLink,
              link_url: deepLink,
              ...(resolvedImageUrl ? { image_url: resolvedImageUrl, avatar_url: resolvedImageUrl } : {}),
            },
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: resolvedChannelId,
                icon: 'ic_notification',
                color: '#2563EB',
                sound: 'default',
                default_vibrate_timings: true,
                default_light_settings: true,
                notification_priority: 'PRIORITY_MAX',
                ...(resolvedImageUrl ? { image: resolvedImageUrl } : {}),
              },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: {
                aps: {
                  sound: 'default',
                  'mutable-content': 1,
                },
              },
            },
          },
        }),
      });

      if (res.ok) {
        sentCount += 1;
      } else {
        const errText = await res.text();
        lastError = errText.slice(0, 240);
        if (
          errText.includes('UNREGISTERED') ||
          errText.includes('INVALID_ARGUMENT') ||
          errText.includes('SENDER_ID_MISMATCH') ||
          errText.includes('SenderId mismatch') ||
          res.status === 404 ||
          res.status === 400 ||
          res.status === 403
        ) {
          invalidTokens.push(token);
        }
      }
    }

    if (invalidTokens.length > 0) {
      const nowIso = new Date().toISOString();
      await Promise.allSettled([
        supabaseAdmin
          .from('user_devices')
          .update({ is_active: false, updated_at: nowIso })
          .in('fcm_token', invalidTokens),
        supabaseAdmin
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: nowIso })
          .in('fcm_token', invalidTokens),
        supabaseAdmin
          .from('profiles')
          .update({ fcm_token: null, updated_at: nowIso })
          .in('fcm_token', invalidTokens),
      ]);
    }

    await supabaseAdmin.from('notification_deliveries').insert({
      user_id: uid,
      notification_type: notificationType,
      status: sentCount > 0 ? 'sent' : 'failed',
      tokens_targeted: tokens.length,
      sent_count: sentCount,
      failed_count: tokens.length - sentCount,
      error_message: sentCount === tokens.length ? null : lastError,
    });

    return {
      targeted: tokens.length,
      sent: sentCount,
      failed: tokens.length - sentCount,
      invalidRemoved: invalidTokens.length,
      mode: 'fcm_direct',
      error: sentCount > 0 ? undefined : lastError || 'FCM send failed',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('dispatchAdminPush notice:', msg);
    return { targeted: 0, sent: 0, failed: 0, invalidRemoved: 0, mode: 'fcm_direct', error: msg };
  }
}

export async function dispatchAdminPush(params: AdminPushParams): Promise<void> {
  await dispatchAdminPushDetailed(params);
}

