import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
  const action = searchParams.get('action') || '';

  try {
    const pool = getDbPool();

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

    return NextResponse.json({
      success: true,
      logs: res.rows,
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
