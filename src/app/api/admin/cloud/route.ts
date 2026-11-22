import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category') || 'all'; // notes, media, documents, links, audio, all
  const userId = searchParams.get('user_id') || '';
  const query = searchParams.get('q') || '';

  try {
    const result = await tryDirectQuery(async (pool) => {
      // 1. Overall Cloud Storage KPIs
      const kpisQuery = await pool.query(`
        SELECT 
          COUNT(*) as "totalItems",
          COALESCE(SUM(file_size), 0) as "totalBytes",
          COUNT(*) FILTER (WHERE category = 'notes') as "notesCount",
          COUNT(*) FILTER (WHERE category = 'media') as "mediaCount",
          COALESCE(SUM(file_size) FILTER (WHERE category = 'media'), 0) as "mediaBytes",
          COUNT(*) FILTER (WHERE category = 'documents') as "docsCount",
          COALESCE(SUM(file_size) FILTER (WHERE category = 'documents'), 0) as "docsBytes",
          COUNT(*) FILTER (WHERE category = 'links') as "linksCount",
          COUNT(*) FILTER (WHERE category = 'audio') as "audioCount",
          COALESCE(SUM(file_size) FILTER (WHERE category = 'audio'), 0) as "audioBytes",
          (SELECT COUNT(*) FROM user_cloud_folders) as "totalFolders",
          (SELECT COUNT(DISTINCT user_id) FROM user_cloud_items) as "activeStorageUsers"
        FROM user_cloud_items
      `);
      const kpis = kpisQuery.rows[0];

      // 2. Top Storage Consumers (Users who use the most cloud space)
      const topConsumersQuery = await pool.query(`
        SELECT 
          uci.user_id,
          p.username,
          p.first_name,
          p.last_name,
          p.avatar_url,
          p.is_verified,
          COUNT(uci.id) as items_count,
          COALESCE(SUM(uci.file_size), 0) as total_bytes,
          (SELECT COUNT(*) FROM user_cloud_folders WHERE user_id = uci.user_id) as folders_count
        FROM user_cloud_items uci
        LEFT JOIN profiles p ON p.id = uci.user_id
        GROUP BY uci.user_id, p.username, p.first_name, p.last_name, p.avatar_url, p.is_verified
        ORDER BY total_bytes DESC, items_count DESC
        LIMIT 20
      `);

      // 3. Filtered cloud items list
      let whereClauses: string[] = [];
      let params: any[] = [];

      if (category !== 'all') {
        params.push(category);
        whereClauses.push(`uci.category = $${params.length}`);
      }

      if (userId) {
        params.push(userId);
        whereClauses.push(`uci.user_id = $${params.length}`);
      }

      if (query) {
        params.push(`%${query}%`);
        whereClauses.push(`(
          uci.title ILIKE $${params.length} OR 
          uci.file_name ILIKE $${params.length} OR 
          uci.content ILIKE $${params.length} OR 
          p.username ILIKE $${params.length}
        )`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const itemsQuery = await pool.query(`
        SELECT 
          uci.*,
          ucf.name as folder_name,
          ucf.color as folder_color,
          p.username,
          p.first_name,
          p.last_name,
          p.avatar_url,
          p.is_verified
        FROM user_cloud_items uci
        LEFT JOIN user_cloud_folders ucf ON ucf.id = uci.folder_id
        LEFT JOIN profiles p ON p.id = uci.user_id
        ${whereSql}
        ORDER BY uci.is_pinned DESC, uci.created_at DESC
        LIMIT 100
      `, params);

      return {
        kpis,
        topConsumers: topConsumersQuery.rows,
        items: itemsQuery.rows,
      };
    });

    if (result) {
      return NextResponse.json({ success: true, ...result });
    }

    // Supabase fallback
    const { count: totalItems } = await supabaseAdmin.from('user_cloud_items').select('*', { count: 'exact', head: true });
    const { data: items } = await supabaseAdmin
      .from('user_cloud_items')
      .select('*, profiles:user_id(username, first_name, avatar_url, is_verified)')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      kpis: {
        totalItems: totalItems || 0,
        totalBytes: 0,
        notesCount: 0,
        mediaCount: 0,
        mediaBytes: 0,
        docsCount: 0,
        docsBytes: 0,
        linksCount: 0,
        audioCount: 0,
        audioBytes: 0,
        totalFolders: 0,
        activeStorageUsers: 0,
      },
      topConsumers: [],
      items: items || [],
    });
  } catch (err: any) {
    console.error('Error in cloud route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, id } = body;

    const directRes = await tryDirectQuery(async (pool) => {
      if (action === 'delete_item') {
        if (!id) throw new Error('Item ID required');
        await pool.query('DELETE FROM user_cloud_items WHERE id = $1', [id]);
        return { message: 'Cloud item removed permanently' };
      }

      if (action === 'toggle_pin') {
        const { is_pinned } = body;
        if (!id) throw new Error('Item ID required');
        await pool.query('UPDATE user_cloud_items SET is_pinned = $2, updated_at = NOW() WHERE id = $1', [id, is_pinned]);
        return { message: is_pinned ? 'Item pinned' : 'Item unpinned' };
      }

      throw new Error(`Unknown action: ${action}`);
    });

    if (directRes) {
      return NextResponse.json({ success: true, ...directRes });
    }

    if (action === 'delete_item') {
      await supabaseAdmin.from('user_cloud_items').delete().eq('id', id);
      return NextResponse.json({ success: true, message: 'Cloud item removed' });
    }

    return NextResponse.json({ success: true, message: 'Action completed' });
  } catch (err: any) {
    console.error('Error handling cloud action:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
