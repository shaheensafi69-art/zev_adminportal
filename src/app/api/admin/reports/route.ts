import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all'; // all, pending, resolved, dismissed

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
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
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        reports: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    let q = supabaseAdmin.from('user_reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (status && status !== 'all') {
      q = q.eq('status', status);
    }
    const { data: reportsData, error: reportsErr } = await q;
    if (reportsErr) throw reportsErr;

    const reports = reportsData || [];
    const userIds = Array.from(new Set([
      ...reports.map((r: any) => r.reporter_id),
      ...reports.map((r: any) => r.reported_user_id),
    ].filter(Boolean)));

    const { data: profs } = await supabaseAdmin.from('profiles').select('*').in('id', userIds);
    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

    const formatted = reports.map((r: any) => {
      const rp = profMap.get(r.reporter_id) || {};
      const ru = profMap.get(r.reported_user_id) || {};
      return {
        id: r.id,
        reporter_id: r.reporter_id,
        reported_user_id: r.reported_user_id,
        reason: r.reason,
        details: r.details,
        status: r.status || 'pending',
        created_at: r.created_at,
        reporter_first_name: rp.first_name || null,
        reporter_last_name: rp.last_name || null,
        reporter_username: rp.username || null,
        reporter_avatar: rp.avatar_url || null,
        reported_first_name: ru.first_name || null,
        reported_last_name: ru.last_name || null,
        reported_username: ru.username || null,
        reported_email: ru.email || null,
        reported_avatar: ru.avatar_url || null,
        reported_is_verified: Boolean(ru.is_verified),
      };
    });

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      reports: formatted,
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

    // 1. Direct Postgres
    await tryDirectQuery(async (pool) => {
      await pool.query(
        `UPDATE public.user_reports SET status = $1 WHERE id = $2`,
        [status, reportId]
      );
    });

    // 2. Supabase HTTPS Service Role
    await supabaseAdmin.from('user_reports').update({ status }).eq('id', reportId);

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

