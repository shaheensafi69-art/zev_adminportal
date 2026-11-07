import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {

    const pool = getDbPool();

    // 1. Fetch User Posts (discussion_posts)
    const postsRes = await pool.query(`
      SELECT 
        dp.id,
        dp.title,
        dp.content,
        dp.image_url,
        dp.created_at,
        COALESCE(likes.cnt, 0)::int AS likes_count,
        COALESCE(comments.cnt, 0)::int AS comments_count
      FROM public.discussion_posts dp
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt 
        FROM public.discussion_likes 
        GROUP BY post_id
      ) likes ON likes.post_id = dp.id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt 
        FROM public.discussion_comments 
        GROUP BY post_id
      ) comments ON comments.post_id = dp.id
      WHERE dp.student_id = $1
      ORDER BY dp.created_at DESC
      LIMIT 100
    `, [userId]);

    // 2. Fetch User Reels (reels)
    const reelsRes = await pool.query(`
      SELECT 
        id,
        title,
        description,
        video_url,
        thumbnail_url,
        category,
        duration_seconds,
        COALESCE(views_count, 0) AS views_count,
        COALESCE(likes_count, 0) AS likes_count,
        COALESCE(comments_count, 0) AS comments_count,
        is_published,
        created_at
      FROM public.reels
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // 3. Fetch User Followers (who follows this user)
    const followersRes = await pool.query(`
      SELECT 
        uf.id,
        uf.follower_id AS user_id,
        p.first_name,
        p.last_name,
        p.username,
        p.avatar_url,
        p.email,
        COALESCE(p.is_verified, false) AS is_verified,
        uf.created_at
      FROM public.user_follows uf
      LEFT JOIN public.profiles p ON uf.follower_id = p.id
      WHERE uf.following_id = $1
      ORDER BY uf.created_at DESC
      LIMIT 100
    `, [userId]);

    // 4. Fetch Following (who this user follows)
    const followingRes = await pool.query(`
      SELECT 
        uf.id,
        uf.following_id AS user_id,
        p.first_name,
        p.last_name,
        p.username,
        p.avatar_url,
        p.email,
        COALESCE(p.is_verified, false) AS is_verified,
        uf.created_at
      FROM public.user_follows uf
      LEFT JOIN public.profiles p ON uf.following_id = p.id
      WHERE uf.follower_id = $1
      ORDER BY uf.created_at DESC
      LIMIT 100
    `, [userId]);

    // 5. Fetch Stories (user_stories)
    const storiesRes = await pool.query(`
      SELECT 
        id,
        media_url,
        media_type,
        caption,
        duration_seconds,
        expires_at,
        created_at
      FROM public.user_stories
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // 6. Fetch Raw Complete Database Record (profiles + auth.users metadata)
    const rawProfileRes = await pool.query(`
      SELECT 
        p.*,
        u.email_confirmed_at,
        u.banned_until,
        u.last_sign_in_at,
        u.created_at AS auth_created_at,
        u.raw_app_meta_data,
        u.raw_user_meta_data
      FROM auth.users u
      LEFT JOIN public.profiles p ON u.id = p.id
      WHERE u.id = $1
    `, [userId]);

    return NextResponse.json({
      success: true,
      activity: {
        posts: postsRes.rows,
        reels: reelsRes.rows,
        followers: followersRes.rows,
        following: followingRes.rows,
        stories: storiesRes.rows,
        rawProfile: rawProfileRes.rows[0] || {},
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
