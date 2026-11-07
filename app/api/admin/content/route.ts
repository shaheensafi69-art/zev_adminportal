import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'posts'; // posts, reels
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
  const search = searchParams.get('search') || '';

  try {
    const pool = getDbPool();

    if (type === 'reels') {
      let whereClause = '';
      const values: (string | number)[] = [limit];

      if (search.trim()) {
        values.push(`%${search.trim().toLowerCase()}%`);
        whereClause = `WHERE LOWER(COALESCE(r.title, '') || ' ' || COALESCE(r.description, '')) LIKE $2`;
      }

      const query = `
        SELECT 
          r.id,
          r.user_id,
          r.title,
          r.description,
          r.video_url,
          r.thumbnail_url,
          r.category,
          r.duration_seconds,
          COALESCE(r.views_count, 0) AS views_count,
          COALESCE(r.likes_count, 0) AS likes_count,
          COALESCE(r.comments_count, 0) AS comments_count,
          COALESCE(r.is_published, true) AS is_published,
          r.created_at,
          p.first_name AS author_first_name,
          p.last_name AS author_last_name,
          p.username AS author_username,
          p.avatar_url AS author_avatar,
          COALESCE(p.is_verified, false) AS author_is_verified
        FROM public.reels r
        LEFT JOIN public.profiles p ON r.user_id = p.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $1
      `;
      const res = await pool.query(query, values);
      return NextResponse.json({ success: true, items: res.rows });
    } else {
      let whereClause = '';
      const values: (string | number)[] = [limit];

      if (search.trim()) {
        values.push(`%${search.trim().toLowerCase()}%`);
        whereClause = `WHERE LOWER(COALESCE(dp.title, '') || ' ' || COALESCE(dp.content, '')) LIKE $2`;
      }

      const query = `
        SELECT 
          dp.id,
          dp.student_id AS user_id,
          dp.title,
          dp.content,
          dp.image_url,
          dp.created_at,
          COALESCE(likes.cnt, 0)::int AS likes_count,
          COALESCE(comments.cnt, 0)::int AS comments_count,
          p.first_name AS author_first_name,
          p.last_name AS author_last_name,
          p.username AS author_username,
          p.avatar_url AS author_avatar,
          COALESCE(p.is_verified, false) AS author_is_verified
        FROM public.discussion_posts dp
        LEFT JOIN public.profiles p ON dp.student_id = p.id
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
        ${whereClause}
        ORDER BY dp.created_at DESC
        LIMIT $1
      `;
      const res = await pool.query(query, values);
      return NextResponse.json({ success: true, items: res.rows });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching platform content:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // post, reel
  const id = searchParams.get('id');

  if (!type || !id) {
    return NextResponse.json(
      { success: false, error: 'Type (post/reel) and content ID are required' },
      { status: 400 }
    );
  }

  try {
    const pool = getDbPool();

    if (type === 'reel') {
      await pool.query(`DELETE FROM public.reel_likes WHERE reel_id = $1`, [id]);
      await pool.query(`DELETE FROM public.reel_comments WHERE reel_id = $1`, [id]);
      await pool.query(`DELETE FROM public.reels WHERE id = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM public.discussion_likes WHERE post_id = $1`, [id]);
      await pool.query(`DELETE FROM public.discussion_comments WHERE post_id = $1`, [id]);
      await pool.query(`DELETE FROM public.discussion_posts WHERE id = $1`, [id]);
    }

    // Log admin action
    try {
      await pool.query(
        `INSERT INTO public.admin_audit_logs (action, target_resource_id, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [`DELETE_${type.toUpperCase()}`, id, JSON.stringify({ type, id })]
      );
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: `${type.toUpperCase()} removed from platform by moderation`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete content' },
      { status: 500 }
    );
  }
}
