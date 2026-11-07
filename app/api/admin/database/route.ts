import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tableName = searchParams.get('table');

  try {
    const pool = getDbPool();

    // If specific table requested, return sample rows and schema
    if (tableName) {
      // Validate table name is alphanumeric/underscore only to avoid SQL injection
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return NextResponse.json({ success: false, error: 'Invalid table name' }, { status: 400 });
      }

      const columnsRes = await pool.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      const rowsRes = await pool.query(`SELECT * FROM public."${tableName}" ORDER BY 1 DESC LIMIT 25`);

      return NextResponse.json({
        success: true,
        table: tableName,
        columns: columnsRes.rows,
        rows: rowsRes.rows,
      });
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

    return NextResponse.json({
      success: true,
      tables: tablesRes.rows,
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
