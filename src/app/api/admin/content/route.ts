import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'posts'; // posts, reels
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
  const search = searchParams.get('search') || '';

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
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
        return res.rows;
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
        return res.rows;
      }
    });

    if (directResult) {
      return NextResponse.json({ success: true, source: 'direct_postgres', items: directResult });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    if (type === 'reels') {
      let q = supabaseAdmin.from('reels').select('*').order('created_at', { ascending: false }).limit(limit);
      if (search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
      }
      const { data: reelsData, error } = await q;
      if (error) throw error;

      const reels = reelsData || [];
      const userIds = Array.from(new Set(reels.map((r: any) => r.user_id).filter(Boolean)));
      const { data: profs } = await supabaseAdmin.from('profiles').select('*').in('id', userIds);
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

      const items = reels.map((r: any) => {
        const p = profMap.get(r.user_id) || {};
        return {
          id: r.id,
          user_id: r.user_id,
          title: r.title,
          description: r.description,
          video_url: r.video_url,
          thumbnail_url: r.thumbnail_url,
          category: r.category,
          duration_seconds: r.duration_seconds,
          views_count: r.views_count || 0,
          likes_count: r.likes_count || 0,
          comments_count: r.comments_count || 0,
          is_published: r.is_published ?? true,
          created_at: r.created_at,
          author_first_name: p.first_name || null,
          author_last_name: p.last_name || null,
          author_username: p.username || null,
          author_avatar: p.avatar_url || null,
          author_is_verified: Boolean(p.is_verified),
        };
      });

      return NextResponse.json({ success: true, source: 'supabase_https_service_role', items });
    } else {
      let q = supabaseAdmin.from('discussion_posts').select('*').order('created_at', { ascending: false }).limit(limit);
      if (search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`);
      }
      const { data: postsData, error } = await q;
      if (error) throw error;

      const posts = postsData || [];
      const userIds = Array.from(new Set(posts.map((p: any) => p.student_id).filter(Boolean)));
      const { data: profs } = await supabaseAdmin.from('profiles').select('*').in('id', userIds);
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

      const items = posts.map((dp: any) => {
        const p = profMap.get(dp.student_id) || {};
        return {
          id: dp.id,
          user_id: dp.student_id,
          title: dp.title,
          content: dp.content,
          image_url: dp.image_url,
          created_at: dp.created_at,
          likes_count: 0,
          comments_count: 0,
          author_first_name: p.first_name || null,
          author_last_name: p.last_name || null,
          author_username: p.username || null,
          author_avatar: p.avatar_url || null,
          author_is_verified: Boolean(p.is_verified),
        };
      });

      return NextResponse.json({ success: true, source: 'supabase_https_service_role', items });
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
    // 1. Direct Postgres
    await tryDirectQuery(async (pool) => {
      if (type === 'reel') {
        await pool.query(`DELETE FROM public.reel_likes WHERE reel_id = $1`, [id]);
        await pool.query(`DELETE FROM public.reel_comments WHERE reel_id = $1`, [id]);
        await pool.query(`DELETE FROM public.reels WHERE id = $1`, [id]);
      } else {
        await pool.query(`DELETE FROM public.discussion_likes WHERE post_id = $1`, [id]);
        await pool.query(`DELETE FROM public.discussion_comments WHERE post_id = $1`, [id]);
        await pool.query(`DELETE FROM public.discussion_posts WHERE id = $1`, [id]);
      }
    });

    // 2. Supabase HTTPS Sync
    if (type === 'reel') {
      await supabaseAdmin.from('reel_likes').delete().eq('reel_id', id);
      await supabaseAdmin.from('reel_comments').delete().eq('reel_id', id);
      await supabaseAdmin.from('reels').delete().eq('id', id);
    } else {
      await supabaseAdmin.from('discussion_likes').delete().eq('post_id', id);
      await supabaseAdmin.from('discussion_comments').delete().eq('post_id', id);
      await supabaseAdmin.from('discussion_posts').delete().eq('id', id);
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
