import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all'; // all, pending, resolved, dismissed

  try {

    const pool = getDbPool();

    let statusCondition = '';
    const values: string[] = [];

    if (status && status !== 'all') {
      values.push(status);
      statusCondition = 'WHERE ur.status = $1';
    }

    const query = `
      SELECT 
        ur.id,
        ur.reporter_id,
        ur.reported_user_id,
        ur.reason,
        ur.details,
        COALESCE(ur.status, 'pending') AS status,
        ur.created_at,
        rp.first_name AS reporter_first_name,
        rp.last_name AS reporter_last_name,
        rp.username AS reporter_username,
        rp.avatar_url AS reporter_avatar,
        ru.first_name AS reported_first_name,
        ru.last_name AS reported_last_name,
        ru.username AS reported_username,
        ru.email AS reported_email,
        ru.avatar_url AS reported_avatar,
        ru.is_verified AS reported_is_verified
      FROM public.user_reports ur
      LEFT JOIN public.profiles rp ON ur.reporter_id = rp.id
      LEFT JOIN public.profiles ru ON ur.reported_user_id = ru.id
      ${statusCondition}
      ORDER BY ur.created_at DESC
      LIMIT 100
    `;

    const res = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      reports: res.rows,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch moderation reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, status } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { success: false, error: 'Report ID and new status are required' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    await pool.query(
      `UPDATE public.user_reports SET status = $1 WHERE id = $2`,
      [status, reportId]
    );

    return NextResponse.json({
      success: true,
      message: `Report marked as ${status}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update report' },
      { status: 500 }
    );
  }
}

