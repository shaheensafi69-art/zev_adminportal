import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PLANS = new Set(['monthly', 'yearly', 'lifetime', 'lifetime_referral', 'custom']);

interface AuthUserRecord {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  phone_number?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  referral_code?: string | null;
  referral_count?: number | null;
  lifetime_blue_eligible?: boolean | null;
  referred_by?: string | null;
  is_verified?: boolean | null;
  is_online?: boolean | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  is_restricted?: boolean | null;
  restricted_until?: string | null;
  restriction_reason?: string | null;
  warning_count?: number | null;
  last_warning_at?: string | null;
  last_warning_reason?: string | null;
  bio?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
}

interface VerificationRow {
  id: string;
  user_id: string;
  badge_type: string;
  status: string;
  is_active: boolean;
  plan_type?: string | null;
  verification_reason?: string | null;
  badge_label?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

async function listAllAuthUsers(): Promise<AuthUserRecord[]> {
  const allUsers: AuthUserRecord[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = (data?.users || []) as unknown as AuthUserRecord[];
    allUsers.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const tab = searchParams.get('tab') || 'all'; // all, verified, pending_verification, unverified, restricted, banned, unconfirmed
  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '25', 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 25;
  const offset = (page - 1) * limit;

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      const conditions: string[] = ['u.deleted_at IS NULL'];
      const values: (string | number | boolean)[] = [];
      let paramIndex = 1;

      if (search.trim()) {
        values.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`(
          LOWER(COALESCE(u.email, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.username, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.first_name, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.last_name, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.phone_number, '')) LIKE $${paramIndex} OR
          u.id::text LIKE $${paramIndex}
        )`);
        paramIndex++;
      }

      if (tab === 'verified') {
        conditions.push(`p.is_verified = true`);
      } else if (tab === 'pending_verification') {
        conditions.push(
          `EXISTS (SELECT 1 FROM public.user_verifications uv WHERE uv.user_id = u.id AND uv.status = 'pending')`
        );
      } else if (tab === 'unverified') {
        conditions.push(`(p.is_verified IS NULL OR p.is_verified = false)`);
      } else if (tab === 'restricted') {
        conditions.push(`p.is_restricted = true`);
      } else if (tab === 'banned') {
        conditions.push(
          `((u.banned_until IS NOT NULL AND u.banned_until > NOW()) OR COALESCE(p.is_banned, false) = true)`
        );
      } else if (tab === 'unconfirmed') {
        conditions.push(`u.email_confirmed_at IS NULL`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `
        SELECT COUNT(*) AS total
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        ${whereClause}
      `;
      const countRes = await pool.query(countSql, values);
      const totalUsers = Number.parseInt(countRes.rows[0]?.total || '0', 10) || 0;

      const querySql = `
        SELECT
          u.id,
          u.email,
          (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
          u.email_confirmed_at,
          ((u.banned_until IS NOT NULL AND u.banned_until > NOW()) OR COALESCE(p.is_banned, false) = true) AS is_banned,
          COALESCE(u.banned_until, p.banned_until) AS banned_until,
          u.created_at AS auth_created_at,
          p.first_name,
          p.last_name,
          p.username,
          p.phone_number,
          p.country,
          p.avatar_url,
          COALESCE(p.referral_code, p.username) AS referral_code,
          COALESCE(p.referral_count, 0)::int AS referral_count,
          COALESCE(p.lifetime_blue_eligible, false) AS lifetime_blue_eligible,
          p.referred_by,
          COALESCE(p.is_verified, false) AS is_verified,
          COALESCE(p.is_online, false) AS is_online,
          COALESCE(p.is_restricted, false) AS is_restricted,
          p.restricted_until,
          p.restriction_reason,
          COALESCE(p.warning_count, 0)::int AS warning_count,
          p.last_warning_at,
          p.last_warning_reason,
          p.bio,
          COALESCE(p.created_at, u.created_at) AS created_at,
          p.last_seen_at AS last_seen,
          COALESCE(dp_count.cnt, 0)::int AS posts_count,
          COALESCE(reels_count.cnt, 0)::int AS reels_count,
          COALESCE(followers_count.cnt, 0)::int AS followers_count,
          COALESCE(following_count.cnt, 0)::int AS following_count,
          COALESCE(stories_count.cnt, 0)::int AS stories_count,
          (
            SELECT row_to_json(uv_sub) FROM (
              SELECT uv.id, uv.user_id, uv.badge_type, uv.status, uv.is_active, uv.plan_type, uv.verification_reason, uv.badge_label, uv.verified_at, uv.expires_at, uv.created_at
              FROM public.user_verifications uv
              WHERE uv.user_id = u.id AND uv.is_active = true
              ORDER BY uv.created_at DESC
              LIMIT 1
            ) uv_sub
          ) AS verification_info
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN (
          SELECT student_id, COUNT(*) AS cnt
          FROM public.discussion_posts
          WHERE deleted_at IS NULL
          GROUP BY student_id
        ) dp_count ON dp_count.student_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt
          FROM public.reels
          WHERE deleted_at IS NULL
          GROUP BY user_id
        ) reels_count ON reels_count.user_id = u.id
        LEFT JOIN (
          SELECT following_id, COUNT(*) AS cnt
          FROM public.user_follows
          GROUP BY following_id
        ) followers_count ON followers_count.following_id = u.id
        LEFT JOIN (
          SELECT follower_id, COUNT(*) AS cnt
          FROM public.user_follows
          GROUP BY follower_id
        ) following_count ON following_count.follower_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt
          FROM public.user_stories
          WHERE deleted_at IS NULL
          GROUP BY user_id
        ) stories_count ON stories_count.user_id = u.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const dataRes = await pool.query(querySql, values);

      return {
        users: dataRes.rows,
        total: totalUsers,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        users: directResult.users,
        pagination: {
          page,
          limit,
          total: directResult.total,
          totalPages: Math.ceil(directResult.total / limit) || 1,
        },
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    const allAuthUsers = await listAllAuthUsers();
    const authUsers = allAuthUsers.filter((u) => !u.deleted_at);

    const [profsRes, verifsRes, postsRes, reelsRes, followsRes, storiesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin
        .from('user_verifications')
        .select('id, user_id, badge_type, status, is_active, plan_type, verification_reason, badge_label, verified_at, expires_at, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('discussion_posts').select('student_id').is('deleted_at', null),
      supabaseAdmin.from('reels').select('user_id').is('deleted_at', null),
      supabaseAdmin.from('user_follows').select('follower_id, following_id'),
      supabaseAdmin.from('user_stories').select('user_id').is('deleted_at', null),
    ]);

    if (profsRes.error) throw profsRes.error;
    if (verifsRes.error) throw verifsRes.error;

    const profileMap = new Map<string, ProfileRow>(
      ((profsRes.data || []) as ProfileRow[]).map((p) => [p.id, p])
    );

    const activeVerifMap = new Map<string, VerificationRow>();
    const pendingVerifUsers = new Set<string>();
    for (const v of (verifsRes.data || []) as VerificationRow[]) {
      if (v.status === 'pending') {
        pendingVerifUsers.add(v.user_id);
      }
      if (v.is_active && !activeVerifMap.has(v.user_id)) {
        activeVerifMap.set(v.user_id, v);
      }
    }

    const postCounts = new Map<string, number>();
    ((postsRes.data || []) as { student_id: string | null }[]).forEach((r) => {
      if (r.student_id) postCounts.set(r.student_id, (postCounts.get(r.student_id) || 0) + 1);
    });

    const reelCounts = new Map<string, number>();
    ((reelsRes.data || []) as { user_id: string | null }[]).forEach((r) => {
      if (r.user_id) reelCounts.set(r.user_id, (reelCounts.get(r.user_id) || 0) + 1);
    });

    const followerCounts = new Map<string, number>();
    const followingCounts = new Map<string, number>();
    ((followsRes.data || []) as { follower_id: string; following_id: string }[]).forEach((r) => {
      followerCounts.set(r.following_id, (followerCounts.get(r.following_id) || 0) + 1);
      followingCounts.set(r.follower_id, (followingCounts.get(r.follower_id) || 0) + 1);
    });

    const storyCounts = new Map<string, number>();
    ((storiesRes.data || []) as { user_id: string | null }[]).forEach((r) => {
      if (r.user_id) storyCounts.set(r.user_id, (storyCounts.get(r.user_id) || 0) + 1);
    });

    const now = new Date();

    let merged = authUsers.map((u) => {
      const p = profileMap.get(u.id);
      const v = activeVerifMap.get(u.id) || null;
      const effectiveBannedUntil = u.banned_until || p?.banned_until || null;
      const isBanned = Boolean(
        (u.banned_until && new Date(u.banned_until) > now) || p?.is_banned
      );
      const refCount = p?.referral_count || 0;

      return {
        id: u.id,
        email: u.email || '',
        email_confirmed: Boolean(u.email_confirmed_at),
        email_confirmed_at: u.email_confirmed_at || null,
        is_banned: isBanned,
        banned_until: effectiveBannedUntil,
        auth_created_at: u.created_at,
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        username: p?.username || null,
        phone_number: p?.phone_number || null,
        country: p?.country || null,
        avatar_url: p?.avatar_url || null,
        is_verified: Boolean(p?.is_verified),
        is_online: Boolean(p?.is_online),
        is_restricted: Boolean(p?.is_restricted),
        restricted_until: p?.restricted_until || null,
        restriction_reason: p?.restriction_reason || null,
        warning_count: p?.warning_count || 0,
        last_warning_at: p?.last_warning_at || null,
        last_warning_reason: p?.last_warning_reason || null,
        bio: p?.bio || null,
        created_at: p?.created_at || u.created_at,
        last_seen: p?.last_seen_at || null,
        posts_count: postCounts.get(u.id) || 0,
        reels_count: reelCounts.get(u.id) || 0,
        followers_count: followerCounts.get(u.id) || 0,
        following_count: followingCounts.get(u.id) || 0,
        stories_count: storyCounts.get(u.id) || 0,
        referral_code: p?.referral_code || p?.username || null,
        referred_by: p?.referred_by || null,
        referral_count: refCount,
        lifetime_blue_eligible: Boolean(p?.lifetime_blue_eligible || refCount >= 100),
        verification_info: v,
      };
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.first_name && u.first_name.toLowerCase().includes(q)) ||
          (u.last_name && u.last_name.toLowerCase().includes(q)) ||
          (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
          u.id.toLowerCase().includes(q)
      );
    }

    if (tab === 'verified') {
      merged = merged.filter((u) => u.is_verified);
    } else if (tab === 'pending_verification') {
      merged = merged.filter((u) => pendingVerifUsers.has(u.id));
    } else if (tab === 'unverified') {
      merged = merged.filter((u) => !u.is_verified);
    } else if (tab === 'restricted') {
      merged = merged.filter((u) => u.is_restricted);
    } else if (tab === 'banned') {
      merged = merged.filter((u) => u.is_banned);
    } else if (tab === 'unconfirmed') {
      merged = merged.filter((u) => !u.email_confirmed);
    }

    merged.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const totalUsers = merged.length;
    const paginatedUsers = merged.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit) || 1,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, userId, payload = {} } = body as {
      action?: string;
      userId?: string;
      payload?: Record<string, unknown>;
    };

    if (!userId || !UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Valid UUID User ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'UPDATE_VERIFICATION':
      case 'TOGGLE_BLUE_TICK': {
        const newStatus = Boolean(payload.isVerified);
        const badgeLabel =
          typeof payload.badgeLabel === 'string' && payload.badgeLabel.trim()
            ? payload.badgeLabel.trim()
            : 'Verified Official';
        const reason =
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : 'Official accreditation by ZEV Admin Team';
        const planType =
          typeof payload.planType === 'string' ? payload.planType : 'lifetime';
        const rawCustomDays = payload.customDays;

        if (newStatus && !ALLOWED_PLANS.has(planType)) {
          return NextResponse.json(
            { success: false, error: 'Invalid verification planType specified' },
            { status: 400 }
          );
        }

        const now = new Date();
        const nowIso = now.toISOString();
        let expiresAt: string | null = null;
        if (newStatus) {
          if (planType === 'monthly') {
            expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
          } else if (planType === 'yearly') {
            expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
          } else if (planType === 'lifetime' || planType === 'lifetime_referral') {
            expiresAt = null;
          } else if (planType === 'custom') {
            const parsedDays = Number(rawCustomDays);
            if (!Number.isFinite(parsedDays) || parsedDays <= 0 || parsedDays > 36500) {
              return NextResponse.json(
                { success: false, error: 'Valid customDays (1-36500) is required for custom plans' },
                { status: 400 }
              );
            }
            expiresAt = new Date(
              now.getTime() + Math.round(parsedDays) * 24 * 3600 * 1000
            ).toISOString();
          }
        }

        const planPriceLabel =
          planType === 'monthly' ? '$9.99' : planType === 'yearly' ? '$99.00' : '$0.00';

        // 1. Direct Postgres
        const directOk = await tryDirectQuery(async (pool) => {
          if (newStatus) {
            await pool.query(
              `UPDATE public.profiles SET
                is_verified = true,
                lifetime_blue_eligible = CASE WHEN $1 = 'lifetime_referral' THEN true ELSE lifetime_blue_eligible END,
                updated_at = NOW()
              WHERE id = $2`,
              [planType, userId]
            );
            await pool.query(
              `INSERT INTO public.user_verifications (
                user_id, badge_type, status, is_active, plan_type, badge_label, verification_reason, verified_at, expires_at, updated_at
              ) VALUES ($1, 'blue_tick', 'verified', true, $2, $3, $4, NOW(), $5, NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                badge_type = 'blue_tick',
                status = 'verified',
                is_active = true,
                plan_type = EXCLUDED.plan_type,
                badge_label = EXCLUDED.badge_label,
                verification_reason = EXCLUDED.verification_reason,
                verified_at = NOW(),
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()`,
              [userId, planType, badgeLabel, reason, expiresAt]
            );
            await pool.query(
              `INSERT INTO public.subscriptions (
                user_id, plan_type, plan, plan_price, status, starts_at, expires_at, is_active, created_at, updated_at
              ) VALUES ($1, $2, $2, $3, 'active', NOW(), $4, true, NOW(), NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                plan_type = EXCLUDED.plan_type,
                plan = EXCLUDED.plan_type,
                plan_price = EXCLUDED.plan_price,
                status = 'active',
                starts_at = NOW(),
                expires_at = EXCLUDED.expires_at,
                is_active = true,
                updated_at = NOW()`,
              [userId, planType, planPriceLabel, expiresAt]
            );
            try {
              const planLabel =
                planType === 'lifetime'
                  ? 'Lifetime Permanent'
                  : planType === 'lifetime_referral'
                  ? '100-Referral Lifetime Legend 🏆'
                  : planType;
              await pool.query(
                `INSERT INTO public.user_notifications (
                  user_id, title, message, notification_type, app_source, is_read, created_at
                ) VALUES ($1, $2, $3, 'verification', 'zev', false, NOW())`,
                [
                  userId,
                  'Official Verification Badge Granted ⭐',
                  `Congratulations! Your ZEV account has been officially verified (${planLabel}).`,
                ]
              );
            } catch {
              // ignore notification failure
            }
          } else {
            await pool.query(
              `UPDATE public.user_verifications SET is_active = false, status = 'revoked', updated_at = NOW() WHERE user_id = $1`,
              [userId]
            );
            await pool.query(
              `UPDATE public.subscriptions SET status = 'cancelled', is_active = false, updated_at = NOW() WHERE user_id = $1`,
              [userId]
            );
            await pool.query(
              `UPDATE public.profiles SET is_verified = false, updated_at = NOW() WHERE id = $1`,
              [userId]
            );
          }

          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [
                auth.admin.name,
                newStatus ? 'GRANT_BLUE_TICK' : 'REVOKE_BLUE_TICK',
                userId,
                JSON.stringify({ planType, badgeLabel, expiresAt }),
              ]
            );
          } catch {
            // ignore audit log error
          }

          return true;
        });

        // 2. Supabase HTTPS Service Role Fallback
        if (!directOk) {
          if (newStatus) {
            const { error: profErr } = await supabaseAdmin
              .from('profiles')
              .update({
                is_verified: true,
                ...(planType === 'lifetime_referral' ? { lifetime_blue_eligible: true } : {}),
                updated_at: nowIso,
              })
              .eq('id', userId);
            if (profErr) throw profErr;

            const { error: verErr } = await supabaseAdmin.from('user_verifications').upsert(
              {
                user_id: userId,
                badge_type: 'blue_tick',
                status: 'verified',
                is_active: true,
                plan_type: planType,
                badge_label: badgeLabel,
                verification_reason: reason,
                verified_at: nowIso,
                expires_at: expiresAt,
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            );
            if (verErr) throw verErr;

            const { error: subErr } = await supabaseAdmin.from('subscriptions').upsert(
              {
                user_id: userId,
                plan_type: planType,
                plan: planType,
                plan_price: planPriceLabel,
                status: 'active',
                is_active: true,
                starts_at: nowIso,
                expires_at: expiresAt,
                created_at: nowIso,
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            );
            if (subErr) throw subErr;

            try {
              const planLabel =
                planType === 'lifetime'
                  ? 'Lifetime Permanent'
                  : planType === 'lifetime_referral'
                  ? '100-Referral Lifetime Legend 🏆'
                  : planType;
              await supabaseAdmin.from('user_notifications').insert({
                user_id: userId,
                title: 'Official Verification Badge Granted ⭐',
                message: `Congratulations! Your ZEV account has been officially verified (${planLabel}).`,
                notification_type: 'verification',
                app_source: 'zev',
                is_read: false,
              });
            } catch {
              // ignore notification failure
            }
          } else {
            const { error: verErr } = await supabaseAdmin
              .from('user_verifications')
              .update({ is_active: false, status: 'revoked', updated_at: nowIso })
              .eq('user_id', userId);
            if (verErr) throw verErr;

            const { error: subErr } = await supabaseAdmin
              .from('subscriptions')
              .update({ status: 'cancelled', is_active: false, updated_at: nowIso })
              .eq('user_id', userId);
            if (subErr) throw subErr;

            const { error: profErr } = await supabaseAdmin
              .from('profiles')
              .update({ is_verified: false, updated_at: nowIso })
              .eq('id', userId);
            if (profErr) throw profErr;
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: newStatus ? 'GRANT_BLUE_TICK' : 'REVOKE_BLUE_TICK',
              target_user_id: userId,
              details: { planType, badgeLabel, expiresAt },
            });
          } catch {
            // ignore audit log error
          }
        }

        if (newStatus) {
          const planLabel =
            planType === 'lifetime'
              ? 'Lifetime Permanent'
              : planType === 'lifetime_referral'
              ? '100-Referral Lifetime Legend 🏆'
              : planType;
          void dispatchAdminPush({
            userId,
            title: 'Official Verification Badge Granted ⭐',
            body: `Congratulations! Your ZEV account has been officially verified (${planLabel}).`,
            notificationType: 'verification',
            deepLink: '/notifications',
          });
        }

        return NextResponse.json({
          success: true,
          message: newStatus ? `Official Blue Badge granted (${planType})` : 'Blue Badge revoked',
          is_verified: newStatus,
          expires_at: expiresAt,
        });
      }

      case 'CONFIRM_EMAIL': {
        // NOTE: auth.users.confirmed_at is GENERATED ALWAYS (LEAST(email_confirmed_at, phone_confirmed_at)).
        // Only update email_confirmed_at!
        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE auth.users
             SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()), updated_at = NOW()
             WHERE id = $1`,
            [userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, created_at)
               VALUES ($1, 'CONFIRM_EMAIL', $2, NOW())`,
              [auth.admin.name, userId]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const { error: authUpErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email_confirm: true,
          });
          if (authUpErr) throw authUpErr;

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'CONFIRM_EMAIL',
              target_user_id: userId,
            });
          } catch {
            // ignore audit log error
          }
        }

        return NextResponse.json({
          success: true,
          message: 'User email confirmed instantly in database',
        });
      }

      case 'BAN_USER': {
        const rawHours = payload.durationHours ?? 876000;
        const reason =
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : 'Violating community guidelines';
        const parsedBanHours = Number(rawHours);
        const safeBanHours =
          Number.isFinite(parsedBanHours) && parsedBanHours > 0
            ? Math.min(Math.round(parsedBanHours), 876000)
            : 876000;
        const bannedUntilIso = new Date(Date.now() + safeBanHours * 3600 * 1000).toISOString();

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE auth.users
             SET banned_until = NOW() + make_interval(hours => $2::int), updated_at = NOW()
             WHERE id = $1`,
            [userId, safeBanHours]
          );
          await pool.query(
            `UPDATE public.profiles
             SET is_banned = true,
                 banned_until = $1,
                 ban_reason = $2,
                 account_status = 'banned',
                 updated_at = NOW()
             WHERE id = $3`,
            [bannedUntilIso, reason, userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES ($1, $2, $3, 'security_alert', 'zev', false, NOW())`,
              [
                userId,
                'Account Suspended ⚠️',
                `Your ZEV account has been suspended by administration. Reason: ${reason}`,
              ]
            );
          } catch {
            // ignore notification error
          }
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'BAN_USER', $2, $3, NOW())`,
              [auth.admin.name, userId, JSON.stringify({ durationHours: safeBanHours, reason })]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const { error: authBanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: `${safeBanHours}h`,
          });
          if (authBanErr) throw authBanErr;

          const { error: profBanErr } = await supabaseAdmin
            .from('profiles')
            .update({
              is_banned: true,
              banned_until: bannedUntilIso,
              ban_reason: reason,
              account_status: 'banned',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          if (profBanErr) throw profBanErr;

          try {
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: 'Account Suspended ⚠️',
              message: `Your ZEV account has been suspended by administration. Reason: ${reason}`,
              notification_type: 'security_alert',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification error
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'BAN_USER',
              target_user_id: userId,
              details: { durationHours: safeBanHours, reason },
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: 'Account Suspended ⚠️',
          body: `Your ZEV account has been suspended by administration. Reason: ${reason}`,
          notificationType: 'security_alert',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: 'User account has been banned immediately in database',
        });
      }

      case 'WARN_USER': {
        const reason =
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : 'Violation of community policies';
        const details = typeof payload.details === 'string' ? payload.details : '';
        const parsedLevel = Number(payload.warningLevel ?? 1);
        const warningLevel =
          Number.isFinite(parsedLevel) && parsedLevel > 0
            ? Math.min(Math.round(parsedLevel), 10)
            : 1;

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET
              warning_count = COALESCE(warning_count, 0) + 1,
              last_warning_at = NOW(),
              last_warning_reason = $1,
              updated_at = NOW()
            WHERE id = $2`,
            [reason, userId]
          );
          await pool.query(
            `INSERT INTO public.user_restrictions (
              user_id, type, warning_level, reason, details, status, created_by, created_at
            ) VALUES ($1, 'WARNING', $2, $3, $4, 'active', $5, NOW())`,
            [userId, warningLevel, reason, details, auth.admin.name]
          );
          try {
            await pool.query(
              `INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES ($1, $2, $3, 'policy_warning', 'zev', false, NOW())`,
              [
                userId,
                `⚠️ Official Policy Notice (Strike #${warningLevel})`,
                `Your account has received a warning for violating ZEV Community Guidelines: ${reason}. Please maintain respectful interactions.`,
              ]
            );
          } catch {
            // ignore notification error
          }
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'WARN_USER', $2, $3, NOW())`,
              [auth.admin.name, userId, JSON.stringify({ warningLevel, reason })]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const nowIso = new Date().toISOString();
          const { data: prof, error: profFetchErr } = await supabaseAdmin
            .from('profiles')
            .select('warning_count')
            .eq('id', userId)
            .single();
          if (profFetchErr) throw profFetchErr;

          const nextCount = (prof?.warning_count || 0) + 1;
          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update({
              warning_count: nextCount,
              last_warning_at: nowIso,
              last_warning_reason: reason,
              updated_at: nowIso,
            })
            .eq('id', userId);
          if (profErr) throw profErr;

          const { error: restErr } = await supabaseAdmin.from('user_restrictions').insert({
            user_id: userId,
            type: 'WARNING',
            warning_level: warningLevel,
            reason,
            details,
            status: 'active',
            created_by: auth.admin.name,
            created_at: nowIso,
          });
          if (restErr) throw restErr;

          try {
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: `⚠️ Official Policy Notice (Strike #${warningLevel})`,
              message: `Your account has received a warning for violating ZEV Community Guidelines: ${reason}. Please maintain respectful interactions.`,
              notification_type: 'policy_warning',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification error
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'WARN_USER',
              target_user_id: userId,
              details: { warningLevel, reason },
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: `⚠️ Official Policy Notice (Strike #${warningLevel})`,
          body: `Your account has received a warning for violating ZEV Community Guidelines: ${reason}. Please maintain respectful interactions.`,
          notificationType: 'policy_warning',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: `Official Policy Warning #${warningLevel} dispatched to user`,
        });
      }

      case 'RESTRICT_USER': {
        const reason =
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : 'Violation of community guidelines';
        const details = typeof payload.details === 'string' ? payload.details : '';
        const rawHours = payload.durationHours === undefined ? 72 : payload.durationHours;
        const parsedHours = rawHours === null || rawHours === '' ? 0 : Number(rawHours);
        const safeHours =
          Number.isFinite(parsedHours) && parsedHours > 0
            ? Math.min(Math.round(parsedHours), 87600)
            : null;
        const expiresAt = safeHours
          ? new Date(Date.now() + safeHours * 3600 * 1000).toISOString()
          : null;

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET
              is_restricted = TRUE,
              restricted_until = CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + make_interval(hours => $3::int) END,
              restriction_reason = $1,
              warning_count = COALESCE(warning_count, 0) + 1,
              last_warning_at = NOW(),
              last_warning_reason = $1,
              updated_at = NOW()
            WHERE id = $2`,
            [reason, userId, safeHours]
          );
          await pool.query(
            `INSERT INTO public.user_restrictions (
              user_id, type, warning_level, reason, details, duration_hours, expires_at, status, created_by, created_at
            ) VALUES (
              $1, 'RESTRICTION', 2, $2, $3, $4::int,
              CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() + make_interval(hours => $4::int) END,
              'active', $5, NOW()
            )`,
            [userId, reason, details, safeHours, auth.admin.name]
          );
          try {
            await pool.query(
              `INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES ($1, $2, $3, 'account_restricted', 'zev', false, NOW())`,
              [
                userId,
                'Account Restriction Notice 🚫',
                `Your ZEV account has been temporarily restricted due to policy violation: ${reason}. Certain features are limited until review.`,
              ]
            );
          } catch {
            // ignore notification error
          }
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'RESTRICT_USER', $2, $3, NOW())`,
              [auth.admin.name, userId, JSON.stringify({ durationHours: safeHours, reason })]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const nowIso = new Date().toISOString();
          const { data: prof, error: profFetchErr } = await supabaseAdmin
            .from('profiles')
            .select('warning_count')
            .eq('id', userId)
            .single();
          if (profFetchErr) throw profFetchErr;

          const nextCount = (prof?.warning_count || 0) + 1;
          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update({
              is_restricted: true,
              restricted_until: expiresAt,
              restriction_reason: reason,
              warning_count: nextCount,
              last_warning_at: nowIso,
              last_warning_reason: reason,
              updated_at: nowIso,
            })
            .eq('id', userId);
          if (profErr) throw profErr;

          const { error: restErr } = await supabaseAdmin.from('user_restrictions').insert({
            user_id: userId,
            type: 'RESTRICTION',
            warning_level: 2,
            reason,
            details,
            duration_hours: safeHours,
            expires_at: expiresAt,
            status: 'active',
            created_by: auth.admin.name,
            created_at: nowIso,
          });
          if (restErr) throw restErr;

          try {
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: 'Account Restriction Notice 🚫',
              message: `Your ZEV account has been temporarily restricted due to policy violation: ${reason}. Certain features are limited until review.`,
              notification_type: 'account_restricted',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification error
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'RESTRICT_USER',
              target_user_id: userId,
              details: { durationHours: safeHours, reason },
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: 'Account Restriction Notice 🚫',
          body: `Your ZEV account has been temporarily restricted due to policy violation: ${reason}. Certain features are limited until review.`,
          notificationType: 'account_restricted',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: 'User account has been placed under restriction',
        });
      }

      case 'UNRESTRICT_USER': {
        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET
              is_restricted = FALSE,
              restricted_until = NULL,
              restriction_reason = NULL,
              updated_at = NOW()
            WHERE id = $1`,
            [userId]
          );
          await pool.query(
            `UPDATE public.user_restrictions SET status = 'lifted' WHERE user_id = $1 AND status = 'active'`,
            [userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES ($1, $2, $3, 'policy_resolved', 'zev', false, NOW())`,
              [
                userId,
                'Account Restriction Lifted ✅',
                'Your account restrictions have been cleared. Full access to all ZEV features has been restored.',
              ]
            );
          } catch {
            // ignore notification error
          }
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, created_at)
               VALUES ($1, 'UNRESTRICT_USER', $2, NOW())`,
              [auth.admin.name, userId]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const nowIso = new Date().toISOString();
          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update({
              is_restricted: false,
              restricted_until: null,
              restriction_reason: null,
              updated_at: nowIso,
            })
            .eq('id', userId);
          if (profErr) throw profErr;

          const { error: restErr } = await supabaseAdmin
            .from('user_restrictions')
            .update({ status: 'lifted' })
            .eq('user_id', userId)
            .eq('status', 'active');
          if (restErr) throw restErr;

          try {
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: 'Account Restriction Lifted ✅',
              message:
                'Your account restrictions have been cleared. Full access to all ZEV features has been restored.',
              notification_type: 'policy_resolved',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification error
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'UNRESTRICT_USER',
              target_user_id: userId,
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: 'Account Restriction Lifted ✅',
          body: 'Your account restrictions have been cleared. Full access to all ZEV features has been restored.',
          notificationType: 'policy_resolved',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: 'Account restriction lifted successfully',
        });
      }

      case 'UNBAN_USER': {
        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE auth.users SET banned_until = NULL, updated_at = NOW() WHERE id = $1`,
            [userId]
          );
          await pool.query(
            `UPDATE public.profiles
             SET is_banned = false,
                 banned_until = NULL,
                 ban_reason = NULL,
                 account_status = 'active',
                 updated_at = NOW()
             WHERE id = $1`,
            [userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES ($1, $2, $3, 'security_alert', 'zev', false, NOW())`,
              [
                userId,
                'Account Suspension Lifted ✅',
                'Your account suspension has been lifted by administration. Full access has been restored.',
              ]
            );
          } catch {
            // ignore notification error
          }
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, created_at)
               VALUES ($1, 'UNBAN_USER', $2, NOW())`,
              [auth.admin.name, userId]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const { error: authUnbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: 'none',
          });
          if (authUnbanErr) throw authUnbanErr;

          const { error: profUnbanErr } = await supabaseAdmin
            .from('profiles')
            .update({
              is_banned: false,
              banned_until: null,
              ban_reason: null,
              account_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          if (profUnbanErr) throw profUnbanErr;

          try {
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: 'Account Suspension Lifted ✅',
              message:
                'Your account suspension has been lifted by administration. Full access has been restored.',
              notification_type: 'security_alert',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification error
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'UNBAN_USER',
              target_user_id: userId,
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: 'Account Suspension Lifted ✅',
          body: 'Your account suspension has been lifted by administration. Full access has been restored.',
          notificationType: 'security_alert',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: 'User suspension has been lifted immediately in database',
        });
      }

      case 'DELETE_USER': {
        // 1. Try Direct Postgres transactional purge (uses verified schema column names + CASCADE on profiles)
        const directOk = await tryDirectQuery(async (pool) => {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM public.discussion_likes WHERE student_id = $1`, [userId]);
            await client.query(`DELETE FROM public.discussion_bookmarks WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.discussion_comments WHERE student_id = $1`, [userId]);
            await client.query(`DELETE FROM public.discussion_posts WHERE student_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_likes WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_bookmarks WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_comments WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_views WHERE viewer_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reels WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.story_views WHERE viewer_id = $1`, [userId]);
            await client.query(`DELETE FROM public.story_likes WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_stories WHERE user_id = $1`, [userId]);
            await client.query(
              `DELETE FROM public.user_follows WHERE follower_id = $1 OR following_id = $1`,
              [userId]
            );
            await client.query(
              `DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1`,
              [userId]
            );
            await client.query(
              `DELETE FROM public.user_reports WHERE reporter_id = $1 OR reported_user_id = $1`,
              [userId]
            );
            await client.query(`DELETE FROM public.user_verifications WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.subscriptions WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_restrictions WHERE user_id = $1`, [userId]);
            await client.query(
              `DELETE FROM public.user_notifications WHERE user_id = $1 OR sender_id = $1`,
              [userId]
            );
            await client.query(`DELETE FROM public.push_subscriptions WHERE user_id = $1`, [userId]);
            await client.query(
              `DELETE FROM public.direct_messages WHERE sender_id = $1 OR receiver_id = $1`,
              [userId]
            );
            await client.query(
              `DELETE FROM public.chat_pins WHERE user_id = $1 OR peer_id = $1`,
              [userId]
            );
            await client.query(`DELETE FROM public.profiles WHERE id = $1`, [userId]);
            await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
            await client.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_resource_id, created_at)
               VALUES ($1, 'DELETE_USER', $2, NOW())`,
              [auth.admin.name, userId]
            );
            await client.query('COMMIT');
          } catch (delErr) {
            await client.query('ROLLBACK');
            throw delErr;
          } finally {
            client.release();
          }
          return true;
        });

        // 2. Sequential cascade cleanup via Supabase HTTPS Service Role fallback (only if Direct PG unavailable)
        if (!directOk) {
          const { error: profDelErr } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);
          if (profDelErr) throw profDelErr;

          const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (authDelErr) throw authDelErr;

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'DELETE_USER',
              target_resource_id: userId,
            });
          } catch {
            // ignore audit log error
          }
        }

        return NextResponse.json({
          success: true,
          message: 'User and all associated database records permanently purged',
        });
      }

      case 'UPDATE_PROFILE': {
        const firstName =
          typeof payload.firstName === 'string' ? payload.firstName : undefined;
        const lastName =
          typeof payload.lastName === 'string' ? payload.lastName : undefined;
        const username =
          typeof payload.username === 'string' ? payload.username : undefined;
        const bio = typeof payload.bio === 'string' ? payload.bio : undefined;
        const phoneNumber =
          typeof payload.phoneNumber === 'string' ? payload.phoneNumber : undefined;
        const country = typeof payload.country === 'string' ? payload.country : undefined;

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET
              first_name = COALESCE($1, first_name),
              last_name = COALESCE($2, last_name),
              username = COALESCE($3, username),
              bio = COALESCE($4, bio),
              phone_number = COALESCE($5, phone_number),
              country = COALESCE($6, country),
              updated_at = NOW()
            WHERE id = $7`,
            [
              firstName ?? null,
              lastName ?? null,
              username ?? null,
              bio ?? null,
              phoneNumber ?? null,
              country ?? null,
              userId,
            ]
          );
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'UPDATE_PROFILE', $2, $3, NOW())`,
              [
                auth.admin.name,
                userId,
                JSON.stringify({ firstName, lastName, username, country }),
              ]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (firstName !== undefined) updateData.first_name = firstName;
          if (lastName !== undefined) updateData.last_name = lastName;
          if (username !== undefined) updateData.username = username;
          if (bio !== undefined) updateData.bio = bio;
          if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
          if (country !== undefined) updateData.country = country;

          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', userId);
          if (profErr) throw profErr;

          const userMetadata: Record<string, unknown> = {};
          if (firstName !== undefined) userMetadata.first_name = firstName;
          if (lastName !== undefined) userMetadata.last_name = lastName;
          if (username !== undefined) userMetadata.username = username;

          if (Object.keys(userMetadata).length > 0) {
            const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: userMetadata,
            });
            if (authErr) throw authErr;
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'UPDATE_PROFILE',
              target_user_id: userId,
              details: { firstName, lastName, username, country },
            });
          } catch {
            // ignore audit log error
          }
        }

        return NextResponse.json({
          success: true,
          message: 'User profile updated instantly in database',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling user action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
