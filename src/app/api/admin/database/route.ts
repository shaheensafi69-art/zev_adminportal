import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const KNOWN_PUBLIC_TABLES = [
  'profiles', 'discussion_posts', 'discussion_comments', 'discussion_likes',
  'reels', 'reel_likes', 'reel_comments', 'reel_views',
  'user_stories', 'story_likes', 'story_views',
  'user_follows', 'user_blocks', 'user_reports',
  'user_verifications', 'user_restrictions', 'user_notifications',
  'push_subscriptions', 'direct_messages', 'chat_pins',
  'admin_audit_logs', 'app_settings', 'categories',
  'post_tags', 'tags', 'media_assets', 'storage_objects'
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tableName = searchParams.get('table');

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      // If specific table requested, return sample rows and schema
      if (tableName) {
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
          throw new Error('Invalid table name');
        }

        const columnsRes = await pool.query(
          `SELECT column_name, data_type, is_nullable 
           FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName]
        );

        const rowsRes = await pool.query(`SELECT * FROM public."${tableName}" ORDER BY 1 DESC LIMIT 25`);

        return {
          table: tableName,
          columns: columnsRes.rows,
          rows: rowsRes.rows,
        };
      }

      // Otherwise list all public tables with statistics
      const tablesRes = await pool.query(`
        SELECT 
          t.table_name,
          COALESCE(c.reltuples::bigint, 0) AS estimated_rows,
          (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = t.table_name
          ) AS columns_count
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name ASC
      `);

      return {
        tables: tablesRes.rows,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    if (tableName) {
      const { data: rows, error } = await supabaseAdmin.from(tableName).select('*').limit(25);
      if (error) throw error;

      const sampleRow = rows && rows.length > 0 ? rows[0] : {};
      const columns = Object.keys(sampleRow).map((key) => ({
        column_name: key,
        data_type: typeof sampleRow[key],
        is_nullable: 'YES',
      }));

      return NextResponse.json({
        success: true,
        source: 'supabase_https_service_role',
        table: tableName,
        columns,
        rows: rows || [],
      });
    }

    // Return known tables list with quick counts
    const tables = KNOWN_PUBLIC_TABLES.map((t) => ({
      table_name: t,
      estimated_rows: '—',
      columns_count: '—',
    }));

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      tables,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching database inspection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database inspection failed' },
      { status: 500 }
    );
  }
}
