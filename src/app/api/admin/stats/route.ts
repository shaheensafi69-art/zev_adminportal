import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';


export async function GET() {
  try {
    const pool = getDbPool();

    const statsRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) AS total_users,
        (SELECT COUNT(*) FROM public.profiles WHERE is_verified = true) AS verified_users,
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL AND deleted_at IS NULL) AS unconfirmed_users,
        (SELECT COUNT(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > NOW() AND deleted_at IS NULL) AS banned_users,
        (SELECT COUNT(*) FROM public.discussion_posts) AS total_posts,
        (SELECT COUNT(*) FROM public.reels) AS total_reels,
        (SELECT COUNT(*) FROM public.profiles WHERE is_online = true) AS online_users
    `);

    const row = statsRes.rows[0];

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: parseInt(row.total_users || '0', 10),
        verifiedUsers: parseInt(row.verified_users || '0', 10),
        unconfirmedUsers: parseInt(row.unconfirmed_users || '0', 10),
        bannedUsers: parseInt(row.banned_users || '0', 10),
        totalPosts: parseInt(row.total_posts || '0', 10),
        totalReels: parseInt(row.total_reels || '0', 10),
        onlineUsers: parseInt(row.online_users || '0', 10),
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
