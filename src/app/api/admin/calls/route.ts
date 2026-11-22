import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'all'; // voice, video, all
  const status = searchParams.get('status') || 'all'; // ended, missed, rejected, ringing, accepted, all
  const isGroup = searchParams.get('is_group') || 'all'; // true, false, all
  const query = searchParams.get('q') || '';
  const sessionId = searchParams.get('session_id') || '';

  try {
    const result = await tryDirectQuery(async (pool) => {
      // 1. If fetching single session participants
      if (sessionId) {
        const participants = await pool.query(`
          SELECT 
            cp.*,
            p.username,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.is_verified
          FROM call_participants cp
          LEFT JOIN profiles p ON p.id = cp.user_id
          WHERE cp.call_session_id = $1
          ORDER BY cp.joined_at ASC
        `, [sessionId]);

        return { participants: participants.rows };
      }

      // 2. Aggregate RTC Call metrics
      const kpisQuery = await pool.query(`
        SELECT 
          COUNT(*) as "totalCalls",
          COUNT(*) FILTER (WHERE call_type = 'voice') as "voiceCalls",
          COUNT(*) FILTER (WHERE call_type = 'video') as "videoCalls",
          COUNT(*) FILTER (WHERE is_group = true) as "groupCalls",
          COUNT(*) FILTER (WHERE status = 'ended' AND duration_seconds > 0) as "completedCalls",
          COUNT(*) FILTER (WHERE status = 'missed') as "missedCalls",
          COUNT(*) FILTER (WHERE status = 'rejected') as "rejectedCalls",
          COUNT(*) FILTER (WHERE status IN ('ringing', 'accepted')) as "activeCalls",
          COALESCE(SUM(duration_seconds), 0) as "totalDurationSeconds",
          ROUND(COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0), 0)) as "avgDurationSeconds"
        FROM call_sessions
      `);
      const kpis = kpisQuery.rows[0];

      // 3. Filtered call sessions list
      let whereClauses: string[] = [];
      let params: any[] = [];

      if (type !== 'all') {
        params.push(type);
        whereClauses.push(`cs.call_type = $${params.length}`);
      }

      if (status !== 'all') {
        params.push(status);
        whereClauses.push(`cs.status = $${params.length}`);
      }

      if (isGroup === 'true') {
        whereClauses.push(`cs.is_group = true`);
      } else if (isGroup === 'false') {
        whereClauses.push(`(cs.is_group = false OR cs.is_group IS NULL)`);
      }

      if (query) {
        params.push(`%${query}%`);
        whereClauses.push(`(
          p1.username ILIKE $${params.length} OR 
          p1.first_name ILIKE $${params.length} OR 
          p2.username ILIKE $${params.length} OR 
          p2.first_name ILIKE $${params.length} OR 
          cs.agora_channel ILIKE $${params.length}
        )`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const sessionsQuery = await pool.query(`
        SELECT 
          cs.*,
          p1.username as caller_username,
          p1.first_name as caller_first_name,
          p1.last_name as caller_last_name,
          p1.avatar_url as caller_avatar_url,
          p1.is_verified as caller_is_verified,
          p2.username as callee_username,
          p2.first_name as callee_first_name,
          p2.last_name as callee_last_name,
          p2.avatar_url as callee_avatar_url,
          p2.is_verified as callee_is_verified,
          (SELECT COUNT(*) FROM call_participants WHERE call_session_id = cs.id) as participants_count
        FROM call_sessions cs
        LEFT JOIN profiles p1 ON p1.id = cs.caller_id
        LEFT JOIN profiles p2 ON p2.id = cs.callee_id
        ${whereSql}
        ORDER BY cs.created_at DESC
        LIMIT 100
      `, params);

      return {
        kpis,
        sessions: sessionsQuery.rows,
      };
    });

    if (result) {
      return NextResponse.json({ success: true, ...result });
    }

    // Supabase fallback
    const { count: totalCalls } = await supabaseAdmin.from('call_sessions').select('*', { count: 'exact', head: true });
    const { data: sessions } = await supabaseAdmin
      .from('call_sessions')
      .select('*, caller:caller_id(username, first_name, avatar_url, is_verified), callee:callee_id(username, first_name, avatar_url, is_verified)')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      kpis: {
        totalCalls: totalCalls || 0,
        voiceCalls: 0,
        videoCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        rejectedCalls: 0,
        activeCalls: 0,
        totalDurationSeconds: 0,
        avgDurationSeconds: 0,
      },
      sessions: sessions || [],
    });
  } catch (err: any) {
    console.error('Error in calls route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, id } = body;

    const directRes = await tryDirectQuery(async (pool) => {
      if (action === 'end_session') {
        if (!id) throw new Error('Call session ID required');
        await pool.query(`
          UPDATE call_sessions 
          SET status = 'ended', end_reason = 'admin_terminated', ended_at = NOW(), updated_at = NOW() 
          WHERE id = $1
        `, [id]);
        return { message: 'Call session terminated' };
      }

      if (action === 'delete_call_log') {
        if (!id) throw new Error('Call session ID required');
        await pool.query('DELETE FROM call_sessions WHERE id = $1', [id]);
        return { message: 'Call record deleted' };
      }

      throw new Error(`Unknown action: ${action}`);
    });

    if (directRes) {
      return NextResponse.json({ success: true, ...directRes });
    }

    if (action === 'delete_call_log') {
      await supabaseAdmin.from('call_sessions').delete().eq('id', id);
      return NextResponse.json({ success: true, message: 'Call record deleted' });
    }

    return NextResponse.json({ success: true, message: 'Action completed' });
  } catch (err: any) {
    console.error('Error handling call action:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
