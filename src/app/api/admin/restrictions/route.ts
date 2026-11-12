import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'active'; // active, lifted, all

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
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
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        restrictions: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    let q = supabaseAdmin
      .from('user_restrictions')
      .select(`
        id,
        user_id,
        type,
        warning_level,
        reason,
        details,
        duration_hours,
        expires_at,
        status,
        created_at,
        profiles (
          first_name,
          last_name,
          username,
          email,
          avatar_url,
          is_verified,
          warning_count,
          is_restricted,
          restricted_until
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) throw error;

    const formatted = (data || []).map((r: any) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles || {};
      return {
        id: r.id,
        user_id: r.user_id,
        type: r.type,
        warning_level: r.warning_level,
        reason: r.reason,
        details: r.details,
        duration_hours: r.duration_hours,
        expires_at: r.expires_at,
        status: r.status,
        created_at: r.created_at,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || null,
        email: p.email || null,
        avatar_url: p.avatar_url || null,
        is_verified: Boolean(p.is_verified),
        current_warning_count: p.warning_count || 0,
        is_restricted: Boolean(p.is_restricted),
        restricted_until: p.restricted_until || null,
      };
    });

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      restrictions: formatted,
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
