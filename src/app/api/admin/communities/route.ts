import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const tab = searchParams.get('tab') || 'communities';
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const communityId = searchParams.get('community_id') || '';
  const postType = searchParams.get('post_type') || 'all';

  try {
    const result = await tryDirectQuery(async (pool) => {
      // 1. Overall stats & KPIs
      const kpisQuery = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM communities) as "totalCommunities",
          (SELECT COUNT(*) FROM community_members) as "totalMembers",
          (SELECT COUNT(*) FROM community_posts) as "totalPosts",
          (SELECT COUNT(*) FROM community_posts WHERE post_type = 'question' AND is_solved = true) as "solvedQuestions",
          (SELECT COUNT(*) FROM community_posts WHERE post_type = 'question') as "totalQuestions",
          (SELECT COUNT(*) FROM community_comments) as "totalComments",
          (SELECT COUNT(*) FROM communities WHERE is_private = true) as "privateCommunities"
      `);
      const kpis = kpisQuery.rows[0];

      if (tab === 'communities') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (category !== 'all') {
          params.push(category);
          whereClauses.push(`c.category = $${params.length}`);
        }

        if (query) {
          params.push(`%${query}%`);
          whereClauses.push(`(c.name ILIKE $${params.length} OR c.slug ILIKE $${params.length} OR p.username ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const commsQuery = await pool.query(`
          SELECT 
            c.*,
            p.username as creator_username,
            p.first_name as creator_first_name,
            p.last_name as creator_last_name,
            p.avatar_url as creator_avatar_url,
            p.is_verified as creator_is_verified
          FROM communities c
          LEFT JOIN profiles p ON p.id = c.creator_id
          ${whereSql}
          ORDER BY c.members_count DESC, c.created_at DESC
          LIMIT 100
        `, params);

        return {
          kpis,
          communities: commsQuery.rows,
        };
      }

      if (tab === 'posts') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (communityId) {
          params.push(communityId);
          whereClauses.push(`cp.community_id = $${params.length}`);
        }

        if (postType !== 'all') {
          params.push(postType);
          whereClauses.push(`cp.post_type = $${params.length}`);
        }

        if (query) {
          params.push(`%${query}%`);
          whereClauses.push(`(cp.title ILIKE $${params.length} OR cp.content ILIKE $${params.length} OR p.username ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const postsQuery = await pool.query(`
          SELECT 
            cp.*,
            c.name as community_name,
            c.slug as community_slug,
            c.category as community_category,
            p.username as author_username,
            p.first_name as author_first_name,
            p.last_name as author_last_name,
            p.avatar_url as author_avatar_url,
            p.is_verified as author_is_verified
          FROM community_posts cp
          LEFT JOIN communities c ON c.id = cp.community_id
          LEFT JOIN profiles p ON p.id = cp.user_id
          ${whereSql}
          ORDER BY cp.is_pinned DESC, cp.created_at DESC
          LIMIT 100
        `, params);

        return {
          kpis,
          posts: postsQuery.rows,
        };
      }

      if (tab === 'comments') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (query) {
          params.push(`%${query}%`);
          whereClauses.push(`(cc.content ILIKE $${params.length} OR p.username ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const commentsQuery = await pool.query(`
          SELECT 
            cc.*,
            cp.title as post_title,
            cp.post_type as post_type,
            c.name as community_name,
            p.username as author_username,
            p.avatar_url as author_avatar_url,
            p.is_verified as author_is_verified
          FROM community_comments cc
          LEFT JOIN community_posts cp ON cp.id = cc.post_id
          LEFT JOIN communities c ON c.id = cp.community_id
          LEFT JOIN profiles p ON p.id = cc.user_id
          ${whereSql}
          ORDER BY cc.created_at DESC
          LIMIT 100
        `, params);

        return {
          kpis,
          comments: commentsQuery.rows,
        };
      }

      if (tab === 'members') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (communityId) {
          params.push(communityId);
          whereClauses.push(`cm.community_id = $${params.length}`);
        }

        if (query) {
          params.push(`%${query}%`);
          whereClauses.push(`(p.username ILIKE $${params.length} OR p.first_name ILIKE $${params.length} OR p.last_name ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const membersQuery = await pool.query(`
          SELECT 
            cm.*,
            c.name as community_name,
            p.username,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.is_verified,
            p.followers_count
          FROM community_members cm
          LEFT JOIN communities c ON c.id = cm.community_id
          LEFT JOIN profiles p ON p.id = cm.user_id
          ${whereSql}
          ORDER BY (CASE WHEN cm.role = 'admin' THEN 1 WHEN cm.role = 'moderator' THEN 2 ELSE 3 END), cm.joined_at DESC
          LIMIT 100
        `, params);

        return {
          kpis,
          members: membersQuery.rows,
        };
      }

      return { kpis };
    });

    if (result) {
      return NextResponse.json({ success: true, ...result });
    }

    // 2. Supabase REST fallback
    const { count: totalCommunities } = await supabaseAdmin.from('communities').select('*', { count: 'exact', head: true });
    const { count: totalMembers } = await supabaseAdmin.from('community_members').select('*', { count: 'exact', head: true });
    const { count: totalPosts } = await supabaseAdmin.from('community_posts').select('*', { count: 'exact', head: true });
    const { count: totalComments } = await supabaseAdmin.from('community_comments').select('*', { count: 'exact', head: true });

    let commsQuery = supabaseAdmin
      .from('communities')
      .select('*, profiles!creator_id(username, first_name, last_name, avatar_url, is_verified)')
      .order('members_count', { ascending: false })
      .limit(100);

    if (category !== 'all') commsQuery = commsQuery.eq('category', category);
    if (query) commsQuery = commsQuery.ilike('name', `%${query}%`);

    const { data: communities } = await commsQuery;

    return NextResponse.json({
      success: true,
      kpis: {
        totalCommunities: totalCommunities || 0,
        totalMembers: totalMembers || 0,
        totalPosts: totalPosts || 0,
        totalComments: totalComments || 0,
      },
      communities: communities || [],
    });
  } catch (err: any) {
    console.error('Error in communities route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    // Direct Postgres execution with fallback
    const directRes = await tryDirectQuery(async (pool) => {
      if (action === 'delete_community') {
        const { id } = body;
        if (!id) throw new Error('Community ID is required');

        await pool.query('DELETE FROM communities WHERE id = $1', [id]);
        return { message: 'Community deleted successfully' };
      }

      if (action === 'update_community') {
        const { id, name, description, category, is_private, rules } = body;
        if (!id) throw new Error('Community ID is required');

        await pool.query(`
          UPDATE communities
          SET 
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            category = COALESCE($4, category),
            is_private = COALESCE($5, is_private),
            rules = COALESCE($6, rules),
            updated_at = NOW()
          WHERE id = $1
        `, [id, name, description, category, is_private, rules]);

        return { message: 'Community updated successfully' };
      }

      if (action === 'delete_post') {
        const { id } = body;
        if (!id) throw new Error('Post ID is required');

        await pool.query('DELETE FROM community_posts WHERE id = $1', [id]);
        return { message: 'Community post removed successfully' };
      }

      if (action === 'toggle_pin_post') {
        const { id, is_pinned } = body;
        if (!id) throw new Error('Post ID is required');

        await pool.query('UPDATE community_posts SET is_pinned = $2, updated_at = NOW() WHERE id = $1', [id, is_pinned]);
        return { message: is_pinned ? 'Post pinned' : 'Post unpinned' };
      }

      if (action === 'toggle_solve_question') {
        const { id, is_solved } = body;
        if (!id) throw new Error('Post ID is required');

        await pool.query('UPDATE community_posts SET is_solved = $2, updated_at = NOW() WHERE id = $1', [id, is_solved]);
        return { message: is_solved ? 'Question marked as solved' : 'Question reopened' };
      }

      if (action === 'delete_comment') {
        const { id } = body;
        if (!id) throw new Error('Comment ID is required');

        await pool.query('DELETE FROM community_comments WHERE id = $1', [id]);
        return { message: 'Comment removed successfully' };
      }

      if (action === 'update_member_role') {
        const { id, role } = body;
        if (!id || !role) throw new Error('Member ID and role are required');

        await pool.query('UPDATE community_members SET role = $2 WHERE id = $1', [id, role]);
        return { message: `Member role updated to ${role}` };
      }

      if (action === 'remove_member') {
        const { id } = body;
        if (!id) throw new Error('Member ID is required');

        await pool.query('DELETE FROM community_members WHERE id = $1', [id]);
        return { message: 'Member removed from community' };
      }

      throw new Error(`Unknown action: ${action}`);
    });

    if (directRes) {
      return NextResponse.json({ success: true, ...directRes });
    }

    // Fallback using Supabase client
    if (action === 'delete_community') {
      const { error } = await supabaseAdmin.from('communities').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Community deleted successfully' });
    }

    if (action === 'delete_post') {
      const { error } = await supabaseAdmin.from('community_posts').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Community post removed' });
    }

    return NextResponse.json({ success: true, message: 'Action completed' });
  } catch (err: any) {
    console.error('Error handling community action:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
