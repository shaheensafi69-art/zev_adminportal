import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProfileSummaryRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const rawType = searchParams.get('type') || 'posts';
  const type = ['posts', 'reels', 'stories', 'hashtags'].includes(rawType) ? rawType : 'posts';
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 50;
  const search = (searchParams.get('search') || '').trim();

  try {
    // 1. Direct PG
    const directResult = await tryDirectQuery(async (pool) => {
      if (type === 'reels') {
        const conditions: string[] = ['r.deleted_at IS NULL'];
        const values: (string | number)[] = [limit];
        if (search) {
          values.push(`%${search.toLowerCase()}%`);
          conditions.push(`LOWER(COALESCE(r.title, '') || ' ' || COALESCE(r.description, '')) LIKE $2`);
        }
        const res = await pool.query(
          `SELECT
            r.id, r.user_id, r.title, r.description, r.video_url, r.thumbnail_url,
            r.category, r.duration_seconds,
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
          WHERE ${conditions.join(' AND ')}
          ORDER BY r.created_at DESC
          LIMIT $1`,
          values
        );
        return { items: res.rows };
      }

      if (type === 'stories') {
        const conditions: string[] = ['s.deleted_at IS NULL'];
        const values: (string | number)[] = [limit];
        if (search) {
          values.push(`%${search.toLowerCase()}%`);
          conditions.push(`LOWER(COALESCE(s.caption, '') || ' ' || COALESCE(p.username, '')) LIKE $2`);
        }
        const res = await pool.query(
          `SELECT
            s.id, s.user_id, s.media_url, s.media_type, s.caption, s.duration_seconds,
            COALESCE(s.visibility, 'public') AS visibility,
            COALESCE(s.views_count, 0)::int AS views_count,
            COALESCE(s.likes_count, 0)::int AS likes_count,
            COALESCE(s.replies_count, 0)::int AS replies_count,
            s.expires_at, s.created_at,
            p.first_name AS author_first_name,
            p.last_name AS author_last_name,
            p.username AS author_username,
            p.avatar_url AS author_avatar,
            COALESCE(p.is_verified, false) AS author_is_verified
          FROM public.user_stories s
          LEFT JOIN public.profiles p ON s.user_id = p.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY s.created_at DESC
          LIMIT $1`,
          values
        );
        return { items: res.rows };
      }

      if (type === 'hashtags') {
        const [tagsRes, trendsRes] = await Promise.all([
          pool.query(
            `SELECT id, tag, COALESCE(posts_count, 0)::int AS posts_count, COALESCE(reels_count, 0)::int AS reels_count, created_at, updated_at
             FROM public.hashtags
             ${search ? `WHERE LOWER(tag) LIKE $1` : ''}
             ORDER BY (COALESCE(posts_count, 0) + COALESCE(reels_count, 0)) DESC, updated_at DESC
             LIMIT 100`,
            search ? [`%${search.toLowerCase()}%`] : []
          ),
          pool.query(
            `SELECT id, topic, category, COALESCE(score, 0)::numeric AS score, COALESCE(posts_count, 0)::int AS posts_count, COALESCE(reels_count, 0)::int AS reels_count, created_at, updated_at
             FROM public.trending_topics
             ORDER BY score DESC, created_at DESC
             LIMIT 50`
          ),
        ]);
        return { items: [], hashtags: tagsRes.rows, trendingTopics: trendsRes.rows };
      }

      // Default: posts (with post_media + Phase 9 metadata)
      const conditions: string[] = ['dp.deleted_at IS NULL'];
      const values: (string | number)[] = [limit];
      if (search) {
        values.push(`%${search.toLowerCase()}%`);
        conditions.push(`LOWER(COALESCE(dp.title, '') || ' ' || COALESCE(dp.content, '')) LIKE $2`);
      }

      const postsRes = await pool.query(
        `SELECT
          dp.id, dp.student_id AS user_id, dp.title, dp.content, dp.image_url,
          dp.post_type, dp.visibility, dp.location, dp.is_draft, dp.scheduled_at, dp.published_at,
          dp.created_at,
          COALESCE(dp.likes_count, 0)::int AS likes_count,
          COALESCE(dp.comments_count, 0)::int AS comments_count,
          COALESCE(dp.reposts_count, 0)::int AS reposts_count,
          COALESCE(dp.bookmarks_count, 0)::int AS bookmarks_count,
          COALESCE(dp.views_count, 0)::int AS views_count,
          dp.collaborator_ids, dp.tagged_user_ids,
          p.first_name AS author_first_name,
          p.last_name AS author_last_name,
          p.username AS author_username,
          p.avatar_url AS author_avatar,
          COALESCE(p.is_verified, false) AS author_is_verified,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', pm.id, 'media_type', pm.media_type, 'media_url', pm.media_url,
              'thumbnail_url', pm.thumbnail_url, 'sort_order', pm.sort_order
            ) ORDER BY pm.sort_order ASC)
            FROM public.post_media pm WHERE pm.post_id = dp.id),
            '[]'::json
          ) AS media_items
        FROM public.discussion_posts dp
        LEFT JOIN public.profiles p ON dp.student_id = p.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY dp.created_at DESC
        LIMIT $1`,
        values
      );

      return { items: postsRes.rows };
    });

    if (directResult) {
      return NextResponse.json({ success: true, source: 'direct_postgres', ...directResult });
    }

    const postgrestSearch = search.replace(/[,()]/g, ' ').trim();

    // 2. Fallback: Supabase HTTPS Service Role
    if (type === 'hashtags') {
      let tagQuery = supabaseAdmin
        .from('hashtags')
        .select('*')
        .order('posts_count', { ascending: false })
        .limit(100);
      if (postgrestSearch) {
        tagQuery = tagQuery.ilike('tag', `%${postgrestSearch}%`);
      }

      const [tagsRes, trendsRes] = await Promise.all([
        tagQuery,
        supabaseAdmin.from('trending_topics').select('*').order('score', { ascending: false }).limit(50),
      ]);
      if (tagsRes.error) throw tagsRes.error;
      if (trendsRes.error) throw trendsRes.error;

      return NextResponse.json({
        success: true,
        source: 'supabase_https_service_role',
        items: [],
        hashtags: tagsRes.data || [],
        trendingTopics: trendsRes.data || [],
      });
    }

    if (type === 'stories') {
      const q = supabaseAdmin
        .from('user_stories')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      const { data: storiesData, error } = await q;
      if (error) throw error;

      const stories = (storiesData || []) as Array<Record<string, unknown>>;
      const userIds = Array.from(new Set(stories.map((s) => String(s.user_id)).filter(Boolean)));
      const profMap = new Map<string, ProfileSummaryRow>();
      if (userIds.length > 0) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, username, avatar_url, is_verified')
          .in('id', userIds);
        for (const p of (profData || []) as ProfileSummaryRow[]) profMap.set(p.id, p);
      }

      const items = stories
        .map((s) => {
          const p = profMap.get(String(s.user_id));
          return {
            id: String(s.id),
            user_id: String(s.user_id),
            media_url: String(s.media_url || ''),
            media_type: String(s.media_type || 'image'),
            caption: (s.caption as string) ?? null,
            duration_seconds: Number(s.duration_seconds || 5),
            visibility: String(s.visibility || 'public'),
            views_count: Number(s.views_count || 0),
            likes_count: Number(s.likes_count || 0),
            replies_count: Number(s.replies_count || 0),
            expires_at: String(s.expires_at),
            created_at: String(s.created_at),
            author_first_name: p?.first_name || null,
            author_last_name: p?.last_name || null,
            author_username: p?.username || null,
            author_avatar: p?.avatar_url || null,
            author_is_verified: Boolean(p?.is_verified),
          };
        })
        .filter((s) =>
          !postgrestSearch ||
          `${s.caption || ''} ${s.author_username || ''}`.toLowerCase().includes(postgrestSearch.toLowerCase())
        );

      return NextResponse.json({ success: true, source: 'supabase_https_service_role', items });
    }

    if (type === 'reels') {
      let q = supabaseAdmin
        .from('reels')
        .select('id, user_id, title, description, video_url, thumbnail_url, category, duration_seconds, views_count, likes_count, comments_count, is_published, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (postgrestSearch) {
        q = q.or(`title.ilike.%${postgrestSearch}%,description.ilike.%${postgrestSearch}%`);
      }
      const { data: reelsData, error } = await q;
      if (error) throw error;

      const reels = (reelsData || []) as Array<Record<string, unknown>>;
      const userIds = Array.from(new Set(reels.map((r) => String(r.user_id)).filter(Boolean)));
      const profMap = new Map<string, ProfileSummaryRow>();
      if (userIds.length > 0) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, username, avatar_url, is_verified')
          .in('id', userIds);
        for (const p of (profData || []) as ProfileSummaryRow[]) profMap.set(p.id, p);
      }

      const items = reels.map((r) => {
        const p = profMap.get(String(r.user_id));
        return {
          ...r,
          views_count: Number(r.views_count || 0),
          likes_count: Number(r.likes_count || 0),
          comments_count: Number(r.comments_count || 0),
          is_published: r.is_published ?? true,
          author_first_name: p?.first_name || null,
          author_last_name: p?.last_name || null,
          author_username: p?.username || null,
          author_avatar: p?.avatar_url || null,
          author_is_verified: Boolean(p?.is_verified),
        };
      });

      return NextResponse.json({ success: true, source: 'supabase_https_service_role', items });
    }

    // Default posts fallback
    let q = supabaseAdmin
      .from('discussion_posts')
      .select('id, student_id, title, content, image_url, post_type, visibility, location, is_draft, scheduled_at, published_at, created_at, likes_count, comments_count, reposts_count, bookmarks_count, views_count, collaborator_ids, tagged_user_ids')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (postgrestSearch) {
      q = q.or(`title.ilike.%${postgrestSearch}%,content.ilike.%${postgrestSearch}%`);
    }
    const { data: postsData, error } = await q;
    if (error) throw error;

    const posts = (postsData || []) as Array<Record<string, unknown>>;
    const userIds = Array.from(new Set(posts.map((p) => String(p.student_id)).filter(Boolean)));
    const postIds = posts.map((p) => String(p.id));

    const [profsRes, mediaRes] = await Promise.all([
      userIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, first_name, last_name, username, avatar_url, is_verified').in('id', userIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabaseAdmin.from('post_media').select('id, post_id, media_type, media_url, thumbnail_url, sort_order').in('post_id', postIds).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const profMap = new Map<string, ProfileSummaryRow>();
    for (const p of (profsRes.data || []) as ProfileSummaryRow[]) profMap.set(p.id, p);

    const mediaMap = new Map<string, Array<Record<string, unknown>>>();
    for (const m of (mediaRes.data || []) as Array<Record<string, unknown>>) {
      const pid = String(m.post_id);
      if (!mediaMap.has(pid)) mediaMap.set(pid, []);
      mediaMap.get(pid)!.push(m);
    }

    const items = posts.map((dp) => {
      const p = profMap.get(String(dp.student_id));
      return {
        id: dp.id,
        user_id: dp.student_id,
        title: dp.title ?? null,
        content: dp.content ?? null,
        image_url: dp.image_url ?? null,
        post_type: dp.post_type ?? null,
        visibility: dp.visibility ?? 'public',
        location: dp.location ?? null,
        is_draft: Boolean(dp.is_draft),
        scheduled_at: dp.scheduled_at ?? null,
        published_at: dp.published_at ?? null,
        created_at: dp.created_at,
        likes_count: Number(dp.likes_count || 0),
        comments_count: Number(dp.comments_count || 0),
        reposts_count: Number(dp.reposts_count || 0),
        bookmarks_count: Number(dp.bookmarks_count || 0),
        views_count: Number(dp.views_count || 0),
        collaborator_ids: dp.collaborator_ids ?? [],
        tagged_user_ids: dp.tagged_user_ids ?? [],
        media_items: mediaMap.get(String(dp.id)) || [],
        author_first_name: p?.first_name || null,
        author_last_name: p?.last_name || null,
        author_username: p?.username || null,
        author_avatar: p?.avatar_url || null,
        author_is_verified: Boolean(p?.is_verified),
      };
    });

    return NextResponse.json({ success: true, source: 'supabase_https_service_role', items });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching platform content:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      action?: string;
      topic?: string;
      category?: string;
      score?: number;
    };

    if (body.action === 'ADD_TRENDING_TOPIC') {
      const topic = String(body.topic || '').trim().replace(/^#/, '');
      const category = String(body.category || 'general').trim() || 'general';
      const score = Number.isFinite(Number(body.score)) ? Number(body.score) : 100;
      if (!topic) {
        return NextResponse.json({ success: false, error: 'Topic text is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin.from('trending_topics').upsert(
        {
          topic,
          category,
          score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'topic' }
      );
      if (error) throw error;

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'ADD_TRENDING_TOPIC',
        details: { topic, category, score },
      });

      return NextResponse.json({ success: true, message: `Trending topic "${topic}" saved` });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update content settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // post, reel, story, trending
  const id = searchParams.get('id');

  if (!type || !['post', 'reel', 'story', 'trending'].includes(type) || !id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { success: false, error: 'Valid type (post/reel/story/trending) and UUID content ID are required' },
      { status: 400 }
    );
  }

  try {
    const directOk = await tryDirectQuery(async (pool) => {
      if (type === 'reel') {
        await pool.query(`DELETE FROM public.reel_likes WHERE reel_id = $1`, [id]);
        await pool.query(`DELETE FROM public.reel_comments WHERE reel_id = $1`, [id]);
        await pool.query(`DELETE FROM public.reels WHERE id = $1`, [id]);
      } else if (type === 'story') {
        await pool.query(`DELETE FROM public.story_likes WHERE story_id = $1`, [id]);
        await pool.query(`DELETE FROM public.story_views WHERE story_id = $1`, [id]);
        await pool.query(`DELETE FROM public.story_reactions WHERE story_id = $1`, [id]);
        await pool.query(`DELETE FROM public.story_replies WHERE story_id = $1`, [id]);
        await pool.query(`DELETE FROM public.user_stories WHERE id = $1`, [id]);
      } else if (type === 'trending') {
        await pool.query(`DELETE FROM public.trending_topics WHERE id = $1`, [id]);
      } else {
        await pool.query(`DELETE FROM public.discussion_likes WHERE post_id = $1`, [id]);
        await pool.query(`DELETE FROM public.discussion_comments WHERE post_id = $1`, [id]);
        await pool.query(`DELETE FROM public.post_media WHERE post_id = $1`, [id]);
        await pool.query(`DELETE FROM public.discussion_posts WHERE id = $1`, [id]);
      }

      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (admin_id, action, target_resource_id, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [auth.admin.name, `DELETE_${type.toUpperCase()}`, id, JSON.stringify({ type })]
        );
      } catch {
        // ignore audit log error
      }
      return true;
    });

    if (!directOk) {
      if (type === 'reel') {
        await supabaseAdmin.from('reel_likes').delete().eq('reel_id', id);
        await supabaseAdmin.from('reel_comments').delete().eq('reel_id', id);
        const { error: rErr } = await supabaseAdmin.from('reels').delete().eq('id', id);
        if (rErr) throw rErr;
      } else if (type === 'story') {
        await supabaseAdmin.from('story_likes').delete().eq('story_id', id);
        await supabaseAdmin.from('story_views').delete().eq('story_id', id);
        await supabaseAdmin.from('story_reactions').delete().eq('story_id', id);
        await supabaseAdmin.from('story_replies').delete().eq('story_id', id);
        const { error: sErr } = await supabaseAdmin.from('user_stories').delete().eq('id', id);
        if (sErr) throw sErr;
      } else if (type === 'trending') {
        const { error: tErr } = await supabaseAdmin.from('trending_topics').delete().eq('id', id);
        if (tErr) throw tErr;
      } else {
        await supabaseAdmin.from('discussion_likes').delete().eq('post_id', id);
        await supabaseAdmin.from('discussion_comments').delete().eq('post_id', id);
        await supabaseAdmin.from('post_media').delete().eq('post_id', id);
        const { error: pErr } = await supabaseAdmin.from('discussion_posts').delete().eq('id', id);
        if (pErr) throw pErr;
      }
      try {
        await supabaseAdmin.from('admin_audit_logs').insert({
          admin_id: auth.admin.name,
          action: `DELETE_${type.toUpperCase()}`,
          target_resource_id: id,
          details: { type },
        });
      } catch {
        // ignore
      }
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
