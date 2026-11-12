import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PLANS = new Set(['monthly', 'yearly', 'lifetime', 'lifetime_referral', 'custom']);

interface VerificationTableRow {
  id: string;
  user_id: string;
  badge_type: string | null;
  status: string;
  is_active: boolean;
  plan_type: string | null;
  badge_label: string | null;
  verification_reason: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at?: string | null;
}

interface ProfileTableRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  referral_code?: string | null;
  referral_count: number | null;
  lifetime_blue_eligible: boolean | null;
  is_verified: boolean | null;
  created_at?: string | null;
}

interface JoinedVerificationDbRow {
  id: string;
  user_id: string;
  badge_type: string | null;
  status: string;
  is_active: boolean;
  plan_type: string;
  badge_label: string;
  verification_reason: string;
  verified_at: string | null;
  expires_at: string | null;
  days_remaining: string | number | null;
  is_expired: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  referral_count: string | number | null;
  lifetime_blue_eligible: boolean;
}

interface ReferralLeaderDbRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  referral_count: string | number | null;
  is_currently_verified: boolean;
  is_eligible_for_lifetime: boolean;
  badge_plan: string | null;
}

interface KpiDbRow {
  total_verified: string | number | null;
  monthly_count: string | number | null;
  yearly_count: string | number | null;
  lifetime_count: string | number | null;
  referral_legends_count: string | number | null;
  expired_count: string | number | null;
  total_referrals: string | number | null;
}

interface NormalizedVerificationRecord {
  id: string;
  user_id: string;
  badge_type: string;
  status: string;
  is_active: boolean;
  plan_type: string;
  badge_label: string;
  verification_reason: string;
  verified_at: string | null;
  expires_at: string | null;
  days_remaining: number | null;
  is_expired: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  referral_count: number;
  lifetime_blue_eligible: boolean;
}

function filterVerificationsByTab(
  items: NormalizedVerificationRecord[],
  tab: string
): NormalizedVerificationRecord[] {
  switch (tab) {
    case 'monthly':
      return items.filter((v) => v.is_active && !v.is_expired && v.plan_type === 'monthly');
    case 'yearly':
      return items.filter((v) => v.is_active && !v.is_expired && v.plan_type === 'yearly');
    case 'lifetime':
      return items.filter(
        (v) =>
          v.is_active &&
          !v.is_expired &&
          (v.plan_type === 'lifetime' || v.plan_type === 'lifetime_referral' || !v.plan_type)
      );
    case 'expired':
      return items.filter((v) => v.status === 'expired' || v.is_expired);
    case 'all':
    case 'referrals':
    default:
      return items.filter((v) => v.is_active && !v.is_expired);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const tab = (searchParams.get('tab') || 'all').toLowerCase(); // all, monthly, yearly, lifetime, referrals, expired

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: AUTOMATED EXPIRATION ENFORCER (preserves lifetime_blue_eligible = true)
    // ══════════════════════════════════════════════════════════════
    const directSweepDone = await tryDirectQuery(async (pool) => {
      const expiredQuery = await pool.query(`
        SELECT uv.user_id
        FROM public.user_verifications uv
        JOIN public.profiles p ON p.id = uv.user_id
        WHERE uv.is_active = true
          AND uv.expires_at IS NOT NULL
          AND uv.expires_at < NOW()
          AND COALESCE(p.lifetime_blue_eligible, false) = false
      `);

      if (expiredQuery.rows.length > 0) {
        const expiredUserIds = expiredQuery.rows.map((r: { user_id: string }) => r.user_id);

        await pool.query(
          `
          UPDATE public.user_verifications
          SET is_active = false, status = 'expired', updated_at = NOW()
          WHERE user_id = ANY($1::uuid[]) AND is_active = true AND expires_at < NOW()
          `,
          [expiredUserIds]
        );

        await pool.query(
          `
          UPDATE public.profiles
          SET is_verified = false, updated_at = NOW()
          WHERE id = ANY($1::uuid[])
            AND COALESCE(lifetime_blue_eligible, false) = false
          `,
          [expiredUserIds]
        );

        await pool.query(
          `
          UPDATE public.subscriptions
          SET is_active = false, status = 'expired', updated_at = NOW()
          WHERE user_id = ANY($1::uuid[])
          `,
          [expiredUserIds]
        );

        for (const uid of expiredUserIds) {
          try {
            await pool.query(
              `
              INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES (
                $1,
                'Blue Badge Subscription Expired ⚠️',
                'Your ZEV Blue Badge subscription period has ended. Renew your monthly/annual plan or invite 100 friends to earn a permanent Lifetime Blue Badge!',
                'verification',
                'zev',
                false,
                NOW()
              )
              `,
              [uid]
            );
          } catch {
            // ignore notification failure during sweep
          }
        }
      }
      return true;
    });

    if (!directSweepDone) {
      try {
        const nowIso = new Date().toISOString();
        const { data: expiredRows } = await supabaseAdmin
          .from('user_verifications')
          .select('user_id')
          .eq('is_active', true)
          .not('expires_at', 'is', null)
          .lt('expires_at', nowIso);

        if (expiredRows && expiredRows.length > 0) {
          const candidateIds = expiredRows.map((r: { user_id: string }) => r.user_id);
          const { data: lifetimeProfs } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .in('id', candidateIds)
            .eq('lifetime_blue_eligible', true);
          const lifetimeSet = new Set((lifetimeProfs || []).map((p: { id: string }) => p.id));
          const expiredIds = candidateIds.filter((id: string) => !lifetimeSet.has(id));

          if (expiredIds.length > 0) {
            await supabaseAdmin
              .from('user_verifications')
              .update({ is_active: false, status: 'expired', updated_at: nowIso })
              .in('user_id', expiredIds);

            await supabaseAdmin
              .from('profiles')
              .update({ is_verified: false, updated_at: nowIso })
              .in('id', expiredIds);

            await supabaseAdmin
              .from('subscriptions')
              .update({ is_active: false, status: 'expired', updated_at: nowIso })
              .in('user_id', expiredIds);

            try {
              await supabaseAdmin.from('user_notifications').insert(
                expiredIds.map((uid: string) => ({
                  user_id: uid,
                  title: 'Blue Badge Subscription Expired ⚠️',
                  message:
                    'Your ZEV Blue Badge subscription period has ended. Renew your monthly/annual plan or invite 100 friends to earn a permanent Lifetime Blue Badge!',
                  notification_type: 'verification',
                  app_source: 'zev',
                  is_read: false,
                }))
              );
            } catch {
              // ignore notification error during sweep
            }
          }
        }
      } catch (e) {
        console.warn('Supabase HTTPS expiry sweep warning:', e);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 2: FETCH VERIFICATIONS & REFERRALS DATA
    // ══════════════════════════════════════════════════════════════
    const directResult = await tryDirectQuery(async (pool) => {
      const verifsRes = await pool.query(`
        SELECT
          uv.id,
          uv.user_id,
          uv.badge_type,
          uv.status,
          uv.is_active,
          COALESCE(uv.plan_type, 'lifetime') AS plan_type,
          COALESCE(uv.badge_label, 'Verified Official') AS badge_label,
          COALESCE(uv.verification_reason, 'Official Accreditation') AS verification_reason,
          uv.verified_at,
          uv.expires_at,
          p.first_name,
          p.last_name,
          p.username,
          p.email,
          p.phone_number,
          p.avatar_url,
          COALESCE(p.referral_count, 0) AS referral_count,
          COALESCE(p.lifetime_blue_eligible, false) AS lifetime_blue_eligible,
          CASE
            WHEN uv.expires_at IS NULL THEN NULL
            ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (uv.expires_at - NOW())) / 86400))
          END AS days_remaining,
          (uv.expires_at IS NOT NULL AND uv.expires_at < NOW()) AS is_expired
        FROM public.user_verifications uv
        JOIN public.profiles p ON uv.user_id = p.id
        ORDER BY uv.verified_at DESC
      `);

      const referralsRes = await pool.query(`
        SELECT
          p.id AS user_id,
          p.first_name,
          p.last_name,
          p.username,
          p.email,
          p.avatar_url,
          COALESCE(p.referral_code, p.username) AS referral_code,
          COALESCE(p.referral_count, 0) AS referral_count,
          COALESCE(p.is_verified, false) AS is_currently_verified,
          COALESCE(p.lifetime_blue_eligible, false) AS is_eligible_for_lifetime,
          COALESCE(uv.plan_type, NULL) AS badge_plan
        FROM public.profiles p
        LEFT JOIN public.user_verifications uv ON p.id = uv.user_id AND uv.is_active = true
        ORDER BY p.referral_count DESC, p.created_at ASC
        LIMIT 100
      `);

      const kpisRes = await pool.query(`
        SELECT
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.expires_at IS NULL OR uv.expires_at >= NOW())) AS total_verified,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.expires_at IS NULL OR uv.expires_at >= NOW()) AND uv.plan_type = 'monthly') AS monthly_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.expires_at IS NULL OR uv.expires_at >= NOW()) AND uv.plan_type = 'yearly') AS yearly_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.expires_at IS NULL OR uv.expires_at >= NOW()) AND (uv.plan_type = 'lifetime' OR uv.plan_type IS NULL)) AS lifetime_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.expires_at IS NULL OR uv.expires_at >= NOW()) AND uv.plan_type = 'lifetime_referral') AS referral_legends_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.status = 'expired' OR (uv.expires_at IS NOT NULL AND uv.expires_at < NOW())) AS expired_count,
          COALESCE((SELECT SUM(COALESCE(p2.referral_count, 0)) FROM public.profiles p2), 0) AS total_referrals
        FROM public.user_verifications uv
      `);

      const kpiRow = (kpisRes.rows[0] || {}) as KpiDbRow;
      const normalizedVerifications: NormalizedVerificationRecord[] = (
        verifsRes.rows as JoinedVerificationDbRow[]
      ).map((v) => {
        const refCount = Number.parseInt(String(v.referral_count ?? '0'), 10) || 0;
        const isExpired = Boolean(v.is_expired);
        const isActive = isExpired ? false : Boolean(v.is_active);
        return {
          id: v.id,
          user_id: v.user_id,
          badge_type: v.badge_type || 'blue_tick',
          status: isExpired ? 'expired' : v.status,
          is_active: isActive,
          plan_type: v.plan_type || 'lifetime',
          badge_label: v.badge_label || 'Verified Official',
          verification_reason: v.verification_reason || 'Official Accreditation',
          verified_at: v.verified_at,
          expires_at: v.expires_at,
          days_remaining: v.days_remaining !== null && v.days_remaining !== undefined
            ? Number(v.days_remaining)
            : null,
          is_expired: isExpired,
          first_name: v.first_name,
          last_name: v.last_name,
          username: v.username,
          email: v.email,
          phone_number: v.phone_number,
          avatar_url: v.avatar_url,
          referral_count: refCount,
          lifetime_blue_eligible: Boolean(v.lifetime_blue_eligible || refCount >= 100),
        };
      });

      return {
        verifications: filterVerificationsByTab(normalizedVerifications, tab),
        referralLeaderboard: (referralsRes.rows as ReferralLeaderDbRow[]).map((r) => {
          const count = Number.parseInt(String(r.referral_count ?? '0'), 10) || 0;
          return {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            username: r.username || 'user',
            email: r.email || '',
            avatar_url: r.avatar_url,
            referral_code: r.referral_code || r.username || 'N/A',
            referral_count: count,
            progress_percentage: Math.min(100, Math.round((count / 100) * 100)),
            is_eligible_for_lifetime: count >= 100 || Boolean(r.is_eligible_for_lifetime),
            is_currently_verified: Boolean(r.is_currently_verified),
            badge_plan: r.badge_plan,
          };
        }),
        kpis: {
          totalVerified: Number.parseInt(String(kpiRow.total_verified ?? '0'), 10) || 0,
          monthlyCount: Number.parseInt(String(kpiRow.monthly_count ?? '0'), 10) || 0,
          yearlyCount: Number.parseInt(String(kpiRow.yearly_count ?? '0'), 10) || 0,
          lifetimeCount: Number.parseInt(String(kpiRow.lifetime_count ?? '0'), 10) || 0,
          referralLegendsCount: Number.parseInt(String(kpiRow.referral_legends_count ?? '0'), 10) || 0,
          expiredCount: Number.parseInt(String(kpiRow.expired_count ?? '0'), 10) || 0,
          totalReferrals: Number.parseInt(String(kpiRow.total_referrals ?? '0'), 10) || 0,
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

    // 2. Fallback: Supabase HTTPS Service Role
    const [verifsDataRes, profilesDataRes] = await Promise.all([
      supabaseAdmin
        .from('user_verifications')
        .select('id, user_id, badge_type, status, is_active, plan_type, badge_label, verification_reason, verified_at, expires_at')
        .order('verified_at', { ascending: false }),
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, username, email, phone_number, avatar_url, referral_code, referral_count, lifetime_blue_eligible, is_verified, created_at')
        .order('referral_count', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    if (verifsDataRes.error) throw verifsDataRes.error;
    if (profilesDataRes.error) throw profilesDataRes.error;

    const allVerifs = (verifsDataRes.data || []) as VerificationTableRow[];
    const allProfiles = (profilesDataRes.data || []) as ProfileTableRow[];
    const profMap = new Map<string, ProfileTableRow>(allProfiles.map((p) => [p.id, p]));
    const verifMap = new Map<string, VerificationTableRow>();
    for (const v of allVerifs) {
      if (v.is_active && !verifMap.has(v.user_id)) {
        verifMap.set(v.user_id, v);
      }
    }

    const now = new Date();

    const allVerifications: NormalizedVerificationRecord[] = allVerifs.map((v) => {
      const p = profMap.get(v.user_id);
      const expiresAtDate = v.expires_at ? new Date(v.expires_at) : null;
      const isExpired = expiresAtDate ? expiresAtDate < now : false;
      const daysRemaining =
        expiresAtDate && !isExpired
          ? Math.max(0, Math.ceil((expiresAtDate.getTime() - now.getTime()) / (1000 * 3600 * 24)))
          : null;
      const refCount = p?.referral_count || 0;

      return {
        id: v.id,
        user_id: v.user_id,
        badge_type: v.badge_type || 'blue_tick',
        status: isExpired ? 'expired' : v.status,
        is_active: isExpired ? false : v.is_active,
        plan_type: v.plan_type || 'lifetime',
        badge_label: v.badge_label || 'Verified Official',
        verification_reason: v.verification_reason || 'Official Accreditation',
        verified_at: v.verified_at,
        expires_at: v.expires_at,
        days_remaining: daysRemaining,
        is_expired: isExpired,
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        username: p?.username || null,
        email: p?.email || null,
        phone_number: p?.phone_number || null,
        avatar_url: p?.avatar_url || null,
        referral_count: refCount,
        lifetime_blue_eligible: Boolean(p?.lifetime_blue_eligible || refCount >= 100),
      };
    });

    const referralLeaderboard = allProfiles.slice(0, 100).map((p) => {
      const activeV = verifMap.get(p.id);
      const count = p.referral_count || 0;
      return {
        user_id: p.id,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || 'user',
        email: p.email || '',
        avatar_url: p.avatar_url || null,
        referral_code: p.referral_code || p.username || 'N/A',
        referral_count: count,
        progress_percentage: Math.min(100, Math.round((count / 100) * 100)),
        is_eligible_for_lifetime: count >= 100 || Boolean(p.lifetime_blue_eligible),
        is_currently_verified: Boolean(p.is_verified),
        badge_plan: activeV?.plan_type || null,
      };
    });

    const activeVerifsList = allVerifications.filter((v) => v.is_active && !v.is_expired);
    const kpis = {
      totalVerified: activeVerifsList.length,
      monthlyCount: activeVerifsList.filter((v) => v.plan_type === 'monthly').length,
      yearlyCount: activeVerifsList.filter((v) => v.plan_type === 'yearly').length,
      lifetimeCount: activeVerifsList.filter((v) => v.plan_type === 'lifetime' || !v.plan_type).length,
      referralLegendsCount: activeVerifsList.filter((v) => v.plan_type === 'lifetime_referral').length,
      expiredCount: allVerifications.filter((v) => v.status === 'expired' || v.is_expired).length,
      totalReferrals: allProfiles.reduce((acc, p) => acc + (p.referral_count || 0), 0),
    };

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      verifications: filterVerificationsByTab(allVerifications, tab),
      referralLeaderboard,
      kpis,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching verifications data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch verifications' },
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

    switch (action) {
      case 'GRANT_SUBSCRIPTION': {
        const planType =
          typeof payload.planType === 'string' ? payload.planType : 'monthly';
        const badgeLabel =
          typeof payload.badgeLabel === 'string' && payload.badgeLabel.trim()
            ? payload.badgeLabel.trim()
            : 'Verified Official';
        const reason =
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : 'Official ZEV Blue Tick Subscription';
        const rawCustomDays = payload.customDays;

        if (!userId || !UUID_REGEX.test(userId)) {
          return NextResponse.json(
            { success: false, error: 'Valid UUID User ID is required' },
            { status: 400 }
          );
        }

        if (!ALLOWED_PLANS.has(planType)) {
          return NextResponse.json(
            { success: false, error: 'Invalid subscription planType specified' },
            { status: 400 }
          );
        }

        const now = new Date();
        let expiresAt: string | null = null;

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
          expiresAt = new Date(now.getTime() + Math.round(parsedDays) * 24 * 3600 * 1000).toISOString();
        }

        const isLifetime = planType === 'lifetime' || planType === 'lifetime_referral';
        const planPriceLabel =
          planType === 'monthly' ? '$9.99' : planType === 'yearly' ? '$99.00' : '$0.00';
        const planText =
          planType === 'monthly'
            ? 'Monthly Plan (30 Days)'
            : planType === 'yearly'
            ? 'Yearly Plan (1 Year)'
            : planType === 'lifetime_referral'
            ? '100-Referrals Lifetime Legend 🏆'
            : 'Permanent Lifetime Badge ⭐';

        // 1. Direct Postgres
        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `
            UPDATE public.profiles SET
              is_verified = true,
              lifetime_blue_eligible = CASE WHEN $1 = 'lifetime_referral' THEN true ELSE lifetime_blue_eligible END,
              updated_at = NOW()
            WHERE id = $2
            `,
            [planType, userId]
          );

          await pool.query(
            `
            INSERT INTO public.user_verifications (
              user_id, badge_type, status, is_active, plan_type, badge_label, verification_reason, verified_at, expires_at, updated_at
            ) VALUES (
              $1, 'blue_tick', 'verified', true, $2, $3, $4, NOW(), $5, NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
              badge_type = 'blue_tick',
              is_active = true,
              status = 'verified',
              plan_type = EXCLUDED.plan_type,
              badge_label = EXCLUDED.badge_label,
              verification_reason = EXCLUDED.verification_reason,
              verified_at = NOW(),
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()
            `,
            [userId, planType, badgeLabel, reason, expiresAt]
          );

          await pool.query(
            `
            INSERT INTO public.subscriptions (
              user_id, plan_type, plan, plan_price, status, starts_at, expires_at, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $2, $3, 'active', NOW(), $4, true, NOW(), NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
              plan_type = EXCLUDED.plan_type,
              plan = EXCLUDED.plan_type,
              plan_price = EXCLUDED.plan_price,
              status = 'active',
              starts_at = NOW(),
              expires_at = EXCLUDED.expires_at,
              is_active = true,
              updated_at = NOW()
            `,
            [userId, planType, planPriceLabel, expiresAt]
          );

          try {
            await pool.query(
              `
              INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES (
                $1,
                'Official Blue Badge Activated ⭐',
                'Congratulations! Your ZEV Blue Badge has been activated: ' || $2 || '. Enjoy your verified status across the community!',
                'verification',
                'zev',
                false,
                NOW()
              )
              `,
              [userId, planText]
            );
          } catch {
            // ignore notification failure
          }

          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'GRANT_SUBSCRIPTION', $2, $3, NOW())`,
              [auth.admin.name, userId, JSON.stringify({ planType, badgeLabel, expiresAt })]
            );
          } catch {
            // ignore audit log error
          }

          return true;
        });

        // 2. Supabase HTTPS Fallback
        if (!directOk) {
          const nowIso = now.toISOString();
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
            await supabaseAdmin.from('user_notifications').insert({
              user_id: userId,
              title: 'Official Blue Badge Activated ⭐',
              message: `Congratulations! Your ZEV Blue Badge has been activated: ${planText}. Enjoy your verified status across the community!`,
              notification_type: 'verification',
              app_source: 'zev',
              is_read: false,
            });
          } catch {
            // ignore notification failure
          }

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'GRANT_SUBSCRIPTION',
              target_user_id: userId,
              details: { planType, badgeLabel, expiresAt },
            });
          } catch {
            // ignore audit log error
          }
        }

        void dispatchAdminPush({
          userId,
          title: 'Official Blue Badge Activated ⭐',
          body: `Congratulations! Your ZEV Blue Badge has been activated: ${planText}. Enjoy your verified status across the community!`,
          notificationType: 'verification',
          deepLink: '/notifications',
        });

        return NextResponse.json({
          success: true,
          message: isLifetime
            ? 'Lifetime Blue Badge granted permanently'
            : `Blue Badge subscription granted (${planType}, expires ${
                expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'
              })`,
          expires_at: expiresAt,
        });
      }

      case 'REVOKE_SUBSCRIPTION': {
        if (!userId || !UUID_REGEX.test(userId)) {
          return NextResponse.json(
            { success: false, error: 'Valid UUID User ID is required' },
            { status: 400 }
          );
        }

        const nowIso = new Date().toISOString();

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.user_verifications SET is_active = false, status = 'revoked', updated_at = NOW() WHERE user_id = $1`,
            [userId]
          );
          await pool.query(
            `UPDATE public.subscriptions SET is_active = false, status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
            [userId]
          );
          // Explicit profile revocation after verification update (overrides lifetime_blue_eligible guard if needed)
          await pool.query(
            `UPDATE public.profiles SET is_verified = false, updated_at = NOW() WHERE id = $1`,
            [userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, created_at)
               VALUES ($1, 'REVOKE_SUBSCRIPTION', $2, NOW())`,
              [auth.admin.name, userId]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const { error: verErr } = await supabaseAdmin
            .from('user_verifications')
            .update({ is_active: false, status: 'revoked', updated_at: nowIso })
            .eq('user_id', userId);
          if (verErr) throw verErr;

          const { error: subErr } = await supabaseAdmin
            .from('subscriptions')
            .update({ is_active: false, status: 'cancelled', updated_at: nowIso })
            .eq('user_id', userId);
          if (subErr) throw subErr;

          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update({ is_verified: false, updated_at: nowIso })
            .eq('id', userId);
          if (profErr) throw profErr;

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'REVOKE_SUBSCRIPTION',
              target_user_id: userId,
            });
          } catch {
            // ignore audit log error
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Blue Badge revoked and subscription cancelled',
        });
      }

      case 'SYNC_EXPIRED': {
        const nowIso = new Date().toISOString();
        let revokedCount = 0;

        const directOk = await tryDirectQuery(async (pool) => {
          const expiredRes = await pool.query(`
            SELECT uv.user_id
            FROM public.user_verifications uv
            JOIN public.profiles p ON p.id = uv.user_id
            WHERE uv.is_active = true
              AND uv.expires_at IS NOT NULL
              AND uv.expires_at < NOW()
              AND COALESCE(p.lifetime_blue_eligible, false) = false
          `);

          if (expiredRes.rows.length > 0) {
            revokedCount = expiredRes.rows.length;
            const ids = expiredRes.rows.map((r: { user_id: string }) => r.user_id);

            await pool.query(
              `UPDATE public.user_verifications SET is_active = false, status = 'expired', updated_at = NOW() WHERE user_id = ANY($1::uuid[])`,
              [ids]
            );
            await pool.query(
              `UPDATE public.profiles SET is_verified = false, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND COALESCE(lifetime_blue_eligible, false) = false`,
              [ids]
            );
            await pool.query(
              `UPDATE public.subscriptions SET is_active = false, status = 'expired', updated_at = NOW() WHERE user_id = ANY($1::uuid[])`,
              [ids]
            );

            try {
              await pool.query(
                `INSERT INTO public.admin_audit_logs (admin_id, action, details, created_at)
                 VALUES ($1, 'SYNC_EXPIRED', $2, NOW())`,
                [auth.admin.name, JSON.stringify({ revokedCount })]
              );
            } catch {
              // ignore audit log error
            }
          }
          return true;
        });

        if (!directOk) {
          const { data: expRows, error: expErr } = await supabaseAdmin
            .from('user_verifications')
            .select('user_id')
            .eq('is_active', true)
            .not('expires_at', 'is', null)
            .lt('expires_at', nowIso);
          if (expErr) throw expErr;

          if (expRows && expRows.length > 0) {
            const candidateIds = expRows.map((r: { user_id: string }) => r.user_id);
            const { data: lifetimeProfs, error: lifeErr } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .in('id', candidateIds)
              .eq('lifetime_blue_eligible', true);
            if (lifeErr) throw lifeErr;

            const lifetimeSet = new Set((lifetimeProfs || []).map((p: { id: string }) => p.id));
            const ids = candidateIds.filter((id: string) => !lifetimeSet.has(id));

            if (ids.length > 0) {
              revokedCount = ids.length;
              const { error: verErr } = await supabaseAdmin
                .from('user_verifications')
                .update({ is_active: false, status: 'expired', updated_at: nowIso })
                .in('user_id', ids);
              if (verErr) throw verErr;

              const { error: profErr } = await supabaseAdmin
                .from('profiles')
                .update({ is_verified: false, updated_at: nowIso })
                .in('id', ids);
              if (profErr) throw profErr;

              const { error: subErr } = await supabaseAdmin
                .from('subscriptions')
                .update({ is_active: false, status: 'expired', updated_at: nowIso })
                .in('user_id', ids);
              if (subErr) throw subErr;

              try {
                await supabaseAdmin.from('admin_audit_logs').insert({
                  admin_id: auth.admin.name,
                  action: 'SYNC_EXPIRED',
                  details: { revokedCount },
                });
              } catch {
                // ignore audit log error
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          message:
            revokedCount > 0
              ? `Successfully scanned and revoked ${revokedCount} expired blue badge subscription(s)`
              : 'All active subscriptions are in good standing. Zero expired badges detected.',
          revokedCount,
        });
      }

      case 'UPDATE_REFERRAL_COUNT': {
        if (!userId || !UUID_REGEX.test(userId)) {
          return NextResponse.json(
            { success: false, error: 'Valid UUID User ID is required' },
            { status: 400 }
          );
        }

        const rawCount = payload.referralCount;
        const parsedCount = Number(rawCount);
        if (!Number.isFinite(parsedCount) || parsedCount < 0) {
          return NextResponse.json(
            { success: false, error: 'Valid non-negative referralCount is required' },
            { status: 400 }
          );
        }

        const newCount = Math.min(Math.round(parsedCount), 1_000_000);
        const isEligible = newCount >= 100;
        const nowIso = new Date().toISOString();

        const directOk = await tryDirectQuery(async (pool) => {
          await pool.query(
            `
            UPDATE public.profiles SET
              referral_count = $1,
              lifetime_blue_eligible = $2,
              updated_at = NOW()
            WHERE id = $3
            `,
            [newCount, isEligible, userId]
          );
          try {
            await pool.query(
              `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, details, created_at)
               VALUES ($1, 'UPDATE_REFERRAL_COUNT', $2, $3, NOW())`,
              [auth.admin.name, userId, JSON.stringify({ referralCount: newCount, isEligible })]
            );
          } catch {
            // ignore audit log error
          }
          return true;
        });

        if (!directOk) {
          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update({
              referral_count: newCount,
              lifetime_blue_eligible: isEligible,
              updated_at: nowIso,
            })
            .eq('id', userId);
          if (profErr) throw profErr;

          try {
            await supabaseAdmin.from('admin_audit_logs').insert({
              admin_id: auth.admin.name,
              action: 'UPDATE_REFERRAL_COUNT',
              target_user_id: userId,
              details: { referralCount: newCount, isEligible },
            });
          } catch {
            // ignore audit log error
          }
        }

        return NextResponse.json({
          success: true,
          message: `Referral count updated to ${newCount}.${
            isEligible ? ' ⭐ 100 Milestone Reached! Eligible for Lifetime Blue Badge.' : ''
          }`,
          referral_count: newCount,
          is_eligible: isEligible,
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
    console.error('Error handling verification action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
