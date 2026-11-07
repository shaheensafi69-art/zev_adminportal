import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'active'; // active, lifted, all

  try {
    const pool = getDbPool();

    let whereClause = '';
    const values: string[] = [];

    if (status && status !== 'all') {
      values.push(status);
      whereClause = 'WHERE ur.status = $1';
    }

    const query = `
      SELECT 
        ur.id,
        ur.user_id,
        ur.type,
        ur.warning_level,
        ur.reason,
        ur.details,
        ur.duration_hours,
        ur.expires_at,
        ur.status,
        ur.created_by,
        ur.created_at,
        p.first_name,
        p.last_name,
        p.username,
        p.email,
        p.avatar_url,
        COALESCE(p.is_verified, false) AS is_verified,
        COALESCE(p.warning_count, 0) AS current_warning_count,
        COALESCE(p.is_restricted, false) AS is_restricted,
        p.restricted_until
      FROM public.user_restrictions ur
      LEFT JOIN public.profiles p ON ur.user_id = p.id
      ${whereClause}
      ORDER BY ur.created_at DESC
      LIMIT 100
    `;

    const res = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      restrictions: res.rows,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching user restrictions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}
