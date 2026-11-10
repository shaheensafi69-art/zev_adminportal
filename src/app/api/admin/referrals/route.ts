import { NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      // 1. Total network referrals
      const totalRes = await pool.query(`SELECT COUNT(*) AS total FROM public.referrals;`);
      const totalReferrals = parseInt(totalRes.rows[0]?.total || '0', 10);

      // 2. Free Blue Earners (referral_count >= 100 or lifetime_blue_eligible = true)
      const eligibleRes = await pool.query(`
        SELECT id, username, first_name, last_name, avatar_url, referral_code, referral_count, is_verified, created_at
        FROM public.profiles
        WHERE referral_count >= 100 OR lifetime_blue_eligible = true
        ORDER BY referral_count DESC
        LIMIT 50;
      `);

      // 3. Leaderboard (Top 25 referrers)
      const leadersRes = await pool.query(`
        SELECT id, username, first_name, last_name, avatar_url, referral_code, COALESCE(referral_count, 0) AS referral_count, is_verified, created_at
        FROM public.profiles
        WHERE referral_count > 0
        ORDER BY referral_count DESC
        LIMIT 25;
      `);

      // 4. Recent Referral Stream (joining referrer and referee)
      const streamRes = await pool.query(`
        SELECT 
          r.id,
          r.referral_code,
          r.status,
          r.created_at,
          r.referrer_id,
          r.referee_id,
          p1.username AS referrer_username,
          p1.first_name AS referrer_first_name,
          p1.last_name AS referrer_last_name,
          p1.avatar_url AS referrer_avatar_url,
          p2.username AS referee_username,
          p2.first_name AS referee_first_name,
          p2.last_name AS referee_last_name,
          p2.avatar_url AS referee_avatar_url
        FROM public.referrals r
        LEFT JOIN public.profiles p1 ON r.referrer_id = p1.id
        LEFT JOIN public.profiles p2 ON r.referee_id = p2.id
        ORDER BY r.created_at DESC
        LIMIT 50;
      `);

      return {
        totalReferrals,
        eligibleEarners: eligibleRes.rows,
        leaderboard: leadersRes.rows,
        recentReferrals: streamRes.rows,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS
    const [totalRes, eligibleRes, leaderboardRes, streamRes] = await Promise.all([
      supabaseAdmin.from('referrals').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('id, username, first_name, last_name, avatar_url, referral_code, referral_count, is_verified').gte('referral_count', 100).limit(50),
      supabaseAdmin.from('profiles').select('id, username, first_name, last_name, avatar_url, referral_code, referral_count, is_verified').gt('referral_count', 0).order('referral_count', { ascending: false }).limit(25),
      supabaseAdmin.from('referrals').select('*, referrer:referrer_id(username, first_name, last_name), referee:referee_id(username, first_name, last_name)').order('created_at', { ascending: false }).limit(50),
    ]);

    return NextResponse.json({
      success: true,
      source: 'supabase_https',
      totalReferrals: totalRes.count || 0,
      eligibleEarners: eligibleRes.data || [],
      leaderboard: leaderboardRes.data || [],
      recentReferrals: streamRes.data || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching referral stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch referral ecosystem stats' },
      { status: 500 }
    );
  }
}

