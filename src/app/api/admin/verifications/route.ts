import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tab = searchParams.get('tab') || 'all'; // all, monthly, yearly, lifetime, referral, expired

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: AUTOMATED EXPIRATION ENFORCER
    // ══════════════════════════════════════════════════════════════
    // Direct Postgres Expiration sweep
    await tryDirectQuery(async (pool) => {
      // Find expired users
      const expiredQuery = await pool.query(`
        SELECT user_id 
        FROM public.user_verifications 
        WHERE is_active = true AND expires_at IS NOT NULL AND expires_at < NOW()
      `);

      if (expiredQuery.rows.length > 0) {
        const expiredUserIds = expiredQuery.rows.map((r: { user_id: string }) => r.user_id);
        
        // 1. Deactivate verifications
        await pool.query(`
          UPDATE public.user_verifications 
          SET is_active = false, status = 'expired', updated_at = NOW()
          WHERE user_id = ANY($1::uuid[]) AND is_active = true AND expires_at < NOW()
        `, [expiredUserIds]);

        // 2. Revoke blue badge on profiles
        await pool.query(`
          UPDATE public.profiles 
          SET is_verified = false, updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `, [expiredUserIds]);

        // 3. Update subscriptions table
        await pool.query(`
          UPDATE public.subscriptions 
          SET is_active = false, status = 'expired', updated_at = NOW()
          WHERE user_id = ANY($1::uuid[])
        `, [expiredUserIds]);

        // 4. Send notification
        for (const uid of expiredUserIds) {
          try {
            await pool.query(`
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
            `, [uid]);
          } catch {
            // ignore
          }
        }
      }
    });

    // Supabase HTTPS fallback for expiration check
    try {
      const nowIso = new Date().toISOString();
      const { data: expiredRows } = await supabaseAdmin
        .from('user_verifications')
        .select('user_id')
        .eq('is_active', true)
        .not('expires_at', 'is', null)
        .lt('expires_at', nowIso);

      if (expiredRows && expiredRows.length > 0) {
        const expiredIds = expiredRows.map((r: { user_id: string }) => r.user_id);
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
      }
    } catch (e) {
      console.warn('Supabase HTTPS expiry sweep warning:', e);
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 2: FETCH VERIFICATIONS & REFERRALS DATA
    // ══════════════════════════════════════════════════════════════
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      // 1. Active Verifications with Profile Data
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

      // 2. Referral Leaderboard & Progress
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

      // 3. Platform Verification KPIs
      const kpisRes = await pool.query(`
        SELECT 
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true) AS total_verified,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND uv.plan_type = 'monthly') AS monthly_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND uv.plan_type = 'yearly') AS yearly_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND (uv.plan_type = 'lifetime' OR uv.plan_type IS NULL)) AS lifetime_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.is_active = true AND uv.plan_type = 'lifetime_referral') AS referral_legends_count,
          COUNT(DISTINCT uv.user_id) FILTER (WHERE uv.status = 'expired' OR (uv.expires_at IS NOT NULL AND uv.expires_at < NOW())) AS expired_count,
          COALESCE(SUM(p.referral_count), 0) AS total_referrals
        FROM public.profiles p
        LEFT JOIN public.user_verifications uv ON p.id = uv.user_id
      `);

      const kpiRow = kpisRes.rows[0];

      return {
        verifications: verifsRes.rows,
        referralLeaderboard: referralsRes.rows.map((r: any) => ({
          user_id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          username: r.username || 'user',
          email: r.email,
          avatar_url: r.avatar_url,
          referral_code: r.referral_code || r.username || 'N/A',
          referral_count: parseInt(r.referral_count || '0', 10),
          progress_percentage: Math.min(100, Math.round((parseInt(r.referral_count || '0', 10) / 100) * 100)),
          is_eligible_for_lifetime: parseInt(r.referral_count || '0', 10) >= 100 || Boolean(r.is_eligible_for_lifetime),
          is_currently_verified: Boolean(r.is_currently_verified),
          badge_plan: r.badge_plan,
        })),
        kpis: {
          totalVerified: parseInt(kpiRow.total_verified || '0', 10),
          monthlyCount: parseInt(kpiRow.monthly_count || '0', 10),
          yearlyCount: parseInt(kpiRow.yearly_count || '0', 10),
          lifetimeCount: parseInt(kpiRow.lifetime_count || '0', 10),
          referralLegendsCount: parseInt(kpiRow.referral_legends_count || '0', 10),
          expiredCount: parseInt(kpiRow.expired_count || '0', 10),
          totalReferrals: parseInt(kpiRow.total_referrals || '0', 10),
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

    // 2. Fallback: Supabase HTTPS Service Role (Cloud resilience)
    const [verifsDataRes, profilesDataRes] = await Promise.all([
      supabaseAdmin.from('user_verifications').select('*').order('verified_at', { ascending: false }),
      supabaseAdmin.from('profiles').select('*').order('referral_count', { ascending: false }),
    ]);

    const allVerifs = verifsDataRes.data || [];
    const allProfiles = profilesDataRes.data || [];
    const profMap = new Map(allProfiles.map((p: any) => [p.id, p]));
    const verifMap = new Map(allVerifs.filter((v: any) => v.is_active).map((v: any) => [v.user_id, v]));

    const now = new Date();

    const verifications = allVerifs.map((v: any) => {
      const p = profMap.get(v.user_id) || {};
      const expiresAtDate = v.expires_at ? new Date(v.expires_at) : null;
      const isExpired = expiresAtDate ? expiresAtDate < now : false;
      const daysRemaining = expiresAtDate && !isExpired
        ? Math.ceil((expiresAtDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
        : null;

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
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || null,
        email: p.email || null,
        phone_number: p.phone_number || null,
        avatar_url: p.avatar_url || null,
        referral_count: p.referral_count || 0,
        lifetime_blue_eligible: Boolean(p.lifetime_blue_eligible || (p.referral_count || 0) >= 100),
      };
    });

    const referralLeaderboard = allProfiles.map((p: any) => {
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

    const activeVerifsList = verifications.filter((v: any) => v.is_active && !v.is_expired);
    const kpis = {
      totalVerified: activeVerifsList.length,
      monthlyCount: activeVerifsList.filter((v: any) => v.plan_type === 'monthly').length,
      yearlyCount: activeVerifsList.filter((v: any) => v.plan_type === 'yearly').length,
      lifetimeCount: activeVerifsList.filter((v: any) => v.plan_type === 'lifetime' || !v.plan_type).length,
      referralLegendsCount: activeVerifsList.filter((v: any) => v.plan_type === 'lifetime_referral').length,
      expiredCount: verifications.filter((v: any) => v.status === 'expired' || v.is_expired).length,
      totalReferrals: allProfiles.reduce((acc: number, p: any) => acc + (p.referral_count || 0), 0),
    };

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      verifications,
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
  try {
    const body = await request.json();
    const { action, userId, payload = {} } = body;

    switch (action) {
      case 'GRANT_SUBSCRIPTION': {
        const {
          isVerified = true,
          planType = 'monthly', // monthly, yearly, lifetime, lifetime_referral, custom
          badgeLabel = 'Verified Official',
          reason = 'Official ZEV Blue Tick Subscription',
          customDays = null,
        } = payload;

        if (!userId) {
          return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        const now = new Date();
        let expiresAt: string | null = null;

        if (planType === 'monthly') {
          expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
        } else if (planType === 'yearly') {
          expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
        } else if (planType === 'lifetime' || planType === 'lifetime_referral') {
          expiresAt = null; // Permanent lifetime
        } else if (planType === 'custom' && customDays) {
          expiresAt = new Date(now.getTime() + parseInt(customDays, 10) * 24 * 3600 * 1000).toISOString();
        }

        const isLifetime = planType === 'lifetime' || planType === 'lifetime_referral';

        // 1. Direct Postgres Update
        await tryDirectQuery(async (pool) => {
          // Update profile
          await pool.query(`
            UPDATE public.profiles SET 
              is_verified = true, 
              lifetime_blue_eligible = CASE WHEN $1 = 'lifetime_referral' THEN true ELSE lifetime_blue_eligible END,
              updated_at = NOW() 
            WHERE id = $2
          `, [planType, userId]);

          // Upsert verification record
          await pool.query(`
            INSERT INTO public.user_verifications (
              user_id, badge_type, status, is_active, plan_type, badge_label, verification_reason, verified_at, expires_at, updated_at
            ) VALUES (
              $1, 'blue_tick', 'verified', true, $2, $3, $4, NOW(), $5, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              is_active = true,
              status = 'verified',
              plan_type = EXCLUDED.plan_type,
              badge_label = EXCLUDED.badge_label,
              verification_reason = EXCLUDED.verification_reason,
              verified_at = NOW(),
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()
          `, [userId, planType, badgeLabel, reason, expiresAt]);

          // Record in subscriptions table
          try {
            await pool.query(`
              INSERT INTO public.subscriptions (
                user_id, plan_type, status, starts_at, expires_at, is_active, created_at, updated_at
              ) VALUES (
                $1, $2, 'active', NOW(), $3, true, NOW(), NOW()
              )
            `, [userId, planType, expiresAt]);
          } catch {
            // ignore
          }

          // In-App Notification
          try {
            const planText = planType === 'monthly' ? 'Monthly Plan (30 Days)' :
                             planType === 'yearly' ? 'Yearly Plan (1 Year)' :
                             planType === 'lifetime_referral' ? '100-Referrals Lifetime Legend 🏆' : 'Permanent Lifetime Badge ⭐';
            await pool.query(`
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
            `, [userId, planText]);
          } catch {
            // ignore
          }
        });

        // 2. Supabase HTTPS Sync
        await supabaseAdmin.from('profiles').update({
          is_verified: true,
          ...(planType === 'lifetime_referral' ? { lifetime_blue_eligible: true } : {}),
          updated_at: now.toISOString(),
        }).eq('id', userId);

        await supabaseAdmin.from('user_verifications').upsert({
          user_id: userId,
          badge_type: 'blue_tick',
          status: 'verified',
          is_active: true,
          plan_type: planType,
          badge_label: badgeLabel,
          verification_reason: reason,
          verified_at: now.toISOString(),
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        });

        await supabaseAdmin.from('subscriptions').insert({
          user_id: userId,
          plan_type: planType,
          status: 'active',
          is_active: true,
          starts_at: now.toISOString(),
          expires_at: expiresAt,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: isLifetime 
            ? 'Lifetime Blue Badge granted permanently' 
            : `Blue Badge subscription granted (${planType}, expires ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'})`,
          expires_at: expiresAt,
        });
      }

      case 'REVOKE_SUBSCRIPTION': {
        if (!userId) {
          return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        const nowIso = new Date().toISOString();

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(`UPDATE public.profiles SET is_verified = false, updated_at = NOW() WHERE id = $1`, [userId]);
          await pool.query(`
            UPDATE public.user_verifications 
            SET is_active = false, status = 'revoked', updated_at = NOW()
            WHERE user_id = $1
          `, [userId]);
          await pool.query(`
            UPDATE public.subscriptions 
            SET is_active = false, status = 'cancelled', updated_at = NOW()
            WHERE user_id = $1
          `, [userId]);
        });

        // 2. Supabase HTTPS Sync
        await supabaseAdmin.from('profiles').update({ is_verified: false, updated_at: nowIso }).eq('id', userId);
        await supabaseAdmin.from('user_verifications').update({ is_active: false, status: 'revoked', updated_at: nowIso }).eq('user_id', userId);
        await supabaseAdmin.from('subscriptions').update({ is_active: false, status: 'cancelled', updated_at: nowIso }).eq('user_id', userId);

        return NextResponse.json({
          success: true,
          message: 'Blue Badge revoked and subscription cancelled',
        });
      }

      case 'SYNC_EXPIRED': {
        const nowIso = new Date().toISOString();
        let revokedCount = 0;

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          const expiredRes = await pool.query(`
            SELECT user_id 
            FROM public.user_verifications 
            WHERE is_active = true AND expires_at IS NOT NULL AND expires_at < NOW()
          `);

          if (expiredRes.rows.length > 0) {
            revokedCount = expiredRes.rows.length;
            const ids = expiredRes.rows.map((r: { user_id: string }) => r.user_id);
            await pool.query(`
              UPDATE public.user_verifications 
              SET is_active = false, status = 'expired', updated_at = NOW()
              WHERE user_id = ANY($1::uuid[])
            `, [ids]);
            await pool.query(`
              UPDATE public.profiles 
              SET is_verified = false, updated_at = NOW()
              WHERE id = ANY($1::uuid[])
            `, [ids]);
            await pool.query(`
              UPDATE public.subscriptions 
              SET is_active = false, status = 'expired', updated_at = NOW()
              WHERE user_id = ANY($1::uuid[])
            `, [ids]);
          }
        });

        // 2. Supabase HTTPS Sync
        const { data: expRows } = await supabaseAdmin
          .from('user_verifications')
          .select('user_id')
          .eq('is_active', true)
          .not('expires_at', 'is', null)
          .lt('expires_at', nowIso);

        if (expRows && expRows.length > 0) {
          revokedCount = Math.max(revokedCount, expRows.length);
          const ids = expRows.map((r: { user_id: string }) => r.user_id);
          await supabaseAdmin.from('user_verifications').update({ is_active: false, status: 'expired', updated_at: nowIso }).in('user_id', ids);
          await supabaseAdmin.from('profiles').update({ is_verified: false, updated_at: nowIso }).in('id', ids);
          await supabaseAdmin.from('subscriptions').update({ is_active: false, status: 'expired', updated_at: nowIso }).in('user_id', ids);
        }

        return NextResponse.json({
          success: true,
          message: revokedCount > 0 
            ? `Successfully scanned and revoked ${revokedCount} expired blue badge subscription(s)` 
            : 'All active subscriptions are in good standing. Zero expired badges detected.',
          revokedCount,
        });
      }

      case 'UPDATE_REFERRAL_COUNT': {
        const { referralCount = 0 } = payload;
        const newCount = Math.max(0, parseInt(referralCount, 10));
        const isEligible = newCount >= 100;
        const nowIso = new Date().toISOString();

        if (!userId) {
          return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(`
            UPDATE public.profiles SET 
              referral_count = $1,
              lifetime_blue_eligible = $2,
              updated_at = NOW()
            WHERE id = $3
          `, [newCount, isEligible, userId]);
        });

        // 2. Supabase HTTPS Sync
        await supabaseAdmin.from('profiles').update({
          referral_count: newCount,
          lifetime_blue_eligible: isEligible,
          updated_at: nowIso,
        }).eq('id', userId);

        return NextResponse.json({
          success: true,
          message: `Referral count updated to ${newCount}. ${isEligible ? '⭐ 100 Milestone Reached! Eligible for Lifetime Blue Badge.' : ''}`,
          referral_count: newCount,
          is_eligible: isEligible,
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action specified' }, { status: 400 });
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

