import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || 'all';

  try {
    const directResult = await tryDirectQuery(async (pool) => {
      let filter = '';
      const params: string[] = [];
      if (status !== 'all') {
        params.push(status);
        filter = `WHERE t.status = $1`;
      }

      const sql = `
        SELECT 
          t.*,
          p.username,
          p.first_name,
          p.last_name,
          p.avatar_url,
          p.email AS profile_email
        FROM public.user_support_tickets t
        LEFT JOIN public.profiles p ON t.user_id = p.id
        ${filter}
        ORDER BY t.created_at DESC
        LIMIT 100
      `;

      const res = await pool.query(sql, params);
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        tickets: directResult,
      });
    }

    // Fallback: Supabase HTTPS
    let query = supabaseAdmin
      .from('user_support_tickets')
      .select('*, profiles:user_id(username, first_name, last_name, avatar_url, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      source: 'supabase_https',
      tickets: data || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching support tickets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch support tickets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { ticketId, status, adminNotes } = body;

    if (!ticketId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing ticketId or status' },
        { status: 400 }
      );
    }

    const directOk = await tryDirectQuery(async (pool) => {
      await pool.query(
        `UPDATE public.user_support_tickets 
         SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW() 
         WHERE id = $3`,
        [status, adminNotes || null, ticketId]
      );
      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (admin_id, action, target_resource_id, details, created_at)
           VALUES ($1, 'UPDATE_SUPPORT_TICKET', $2, $3, NOW())`,
          [auth.admin.name, String(ticketId), JSON.stringify({ status, hasNotes: Boolean(adminNotes) })]
        );
      } catch {
        // ignore audit log error
      }
      return true;
    });

    if (!directOk) {
      await supabaseAdmin
        .from('user_support_tickets')
        .update({ status, admin_notes: adminNotes || null, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    }

    return NextResponse.json({
      success: true,
      message: `Ticket marked as ${status}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error updating support ticket:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update ticket' },
      { status: 500 }
    );
  }
}

