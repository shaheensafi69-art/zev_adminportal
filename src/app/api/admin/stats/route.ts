import { NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      const statsRes = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) AS total_users,
          (SELECT COUNT(*) FROM public.profiles WHERE is_verified = true) AS verified_users,
          (SELECT COUNT(*) FROM public.profiles WHERE is_restricted = true) AS restricted_users,
          (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL AND deleted_at IS NULL) AS unconfirmed_users,
          (SELECT COUNT(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > NOW() AND deleted_at IS NULL) AS banned_users,
          (SELECT COUNT(*) FROM public.discussion_posts) AS total_posts,
          (SELECT COUNT(*) FROM public.reels) AS total_reels,
          (SELECT COUNT(*) FROM public.profiles WHERE is_online = true) AS online_users,
          (SELECT COUNT(*) FROM public.user_reports WHERE status = 'pending') AS pending_reports,
          (SELECT COUNT(*) FROM public.user_restrictions WHERE status = 'active' AND type = 'WARNING') AS active_warnings
      `);
      return statsRes.rows[0];
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        stats: {
          totalUsers: parseInt(directResult.total_users || '0', 10),
          verifiedUsers: parseInt(directResult.verified_users || '0', 10),
          restrictedUsers: parseInt(directResult.restricted_users || '0', 10),
          unconfirmedUsers: parseInt(directResult.unconfirmed_users || '0', 10),
          bannedUsers: parseInt(directResult.banned_users || '0', 10),
          totalPosts: parseInt(directResult.total_posts || '0', 10),
          totalReels: parseInt(directResult.total_reels || '0', 10),
          onlineUsers: parseInt(directResult.online_users || '0', 10),
          pendingReports: parseInt(directResult.pending_reports || '0', 10),
          activeWarnings: parseInt(directResult.active_warnings || '0', 10),
        },
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role (Guaranteed to work in 100% of cloud environments)
    const [
      usersAuthRes,
      verifiedRes,
      restrictedRes,
      postsRes,
      reelsRes,
      reportsRes,
      warningsRes,
      onlineRes,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_restricted', true),
      supabaseAdmin.from('discussion_posts').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('reels').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('user_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('type', 'WARNING'),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
    ]);

    const allAuthUsers = usersAuthRes.data?.users || [];
    const totalUsers = ((usersAuthRes.data as unknown as { total?: number })?.total) ?? allAuthUsers.length;
    const now = new Date();
    const bannedUsers = allAuthUsers.filter((u) => u.banned_until && new Date(u.banned_until) > now).length;
    const unconfirmedUsers = allAuthUsers.filter((u) => !u.email_confirmed_at).length;

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      stats: {
        totalUsers: totalUsers,
        verifiedUsers: verifiedRes.count || 0,
        restrictedUsers: restrictedRes.count || 0,
        unconfirmedUsers,
        bannedUsers,
        totalPosts: postsRes.count || 0,
        totalReels: reelsRes.count || 0,
        onlineUsers: onlineRes.count || 0,
        pendingReports: reportsRes.count || 0,
        activeWarnings: warningsRes.count || 0,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
