import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

interface OpenApiSpec {
  definitions?: Record<
    string,
    {
      properties?: Record<string, { type?: string; format?: string }>;
      required?: string[];
    }
  >;
}

async function fetchOpenApiSchema(): Promise<OpenApiSpec | null> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;

  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as OpenApiSpec;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const tableName = searchParams.get('table');
  if (tableName && !/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return NextResponse.json({ success: false, error: 'Invalid table name' }, { status: 400 });
  }

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      if (tableName) {
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

    // 2. Fallback: Dynamic Supabase OpenAPI Schema + Service-Role REST
    const spec = await fetchOpenApiSchema();
    const defs = spec?.definitions || {};

    if (tableName) {
      const defProps = defs[tableName]?.properties || {};
      const requiredSet = new Set(defs[tableName]?.required || []);
      let query = supabaseAdmin.from(tableName).select('*').limit(25);
      if ('created_at' in defProps) {
        query = query.order('created_at', { ascending: false });
      } else if ('applied_at' in defProps) {
        query = query.order('applied_at', { ascending: false });
      } else if ('updated_at' in defProps) {
        query = query.order('updated_at', { ascending: false });
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const propKeys = Object.keys(defProps);
      const sampleRow = rows && rows.length > 0 ? (rows[0] as Record<string, unknown>) : {};
      const colNames = propKeys.length > 0 ? propKeys : Object.keys(sampleRow);

      const columns = colNames.map((key) => ({
        column_name: key,
        data_type: defProps[key]?.format || defProps[key]?.type || typeof sampleRow[key],
        is_nullable: requiredSet.has(key) ? 'NO' : 'YES',
      }));

      return NextResponse.json({
        success: true,
        source: 'supabase_https_service_role',
        table: tableName,
        columns,
        rows: rows || [],
      });
    }

    const tableNames = Object.keys(defs).sort();
    const tables = tableNames.map((t) => ({
      table_name: t,
      estimated_rows: 'live',
      columns_count: Object.keys(defs[t]?.properties || {}).length,
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
