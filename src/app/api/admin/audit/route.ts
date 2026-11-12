import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
  const action = searchParams.get('action') || '';

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      let whereClause = '';
      const values: (string | number)[] = [limit];

      if (action.trim()) {
        values.push(action.trim().toUpperCase());
        whereClause = 'WHERE al.action = $2';
      }

      const query = `
        SELECT 
          al.id,
          al.admin_id,
          al.action,
          al.target_user_id,
          al.target_resource_id,
          al.details,
          al.ip_address,
          al.created_at,
          p.first_name AS target_first_name,
          p.last_name AS target_last_name,
          p.username AS target_username,
          p.email AS target_email
        FROM public.admin_audit_logs al
        LEFT JOIN public.profiles p ON al.target_user_id = p.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $1
      `;

      const res = await pool.query(query, values);
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        logs: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    let q = supabaseAdmin.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (action.trim()) {
      q = q.eq('action', action.trim().toUpperCase());
    }

    const { data: logsData } = await q;
    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      logs: logsData || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
