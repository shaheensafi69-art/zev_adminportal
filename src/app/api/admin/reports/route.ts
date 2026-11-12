import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all'; // all, pending, resolved, dismissed
  const kind = searchParams.get('kind') || 'all'; // all, users, content

  try {
    // 1. Direct Postgres
    const directResult = await tryDirectQuery(async (pool) => {
      const values: string[] = [];
      let userWhere = '';
      let postWhere = '';
      if (status && status !== 'all') {
        values.push(status);
        userWhere = 'WHERE ur.status = $1';
        postWhere = 'WHERE pr.status = $1';
      }

      const [userReportsRes, postReportsRes] = await Promise.all([
        kind === 'content'
          ? Promise.resolve({ rows: [] })
          : pool.query(
              `SELECT
                ur.id, ur.reporter_id, ur.reported_user_id, ur.reason, ur.details,
                COALESCE(ur.status, 'pending') AS status, ur.created_at,
                rp.first_name AS reporter_first_name, rp.last_name AS reporter_last_name,
                rp.username AS reporter_username, rp.avatar_url AS reporter_avatar,
                ru.first_name AS reported_first_name, ru.last_name AS reported_last_name,
                ru.username AS reported_username, ru.email AS reported_email,
                ru.avatar_url AS reported_avatar, ru.is_verified AS reported_is_verified
              FROM public.user_reports ur
              LEFT JOIN public.profiles rp ON ur.reporter_id = rp.id
              LEFT JOIN public.profiles ru ON ur.reported_user_id = ru.id
              ${userWhere}
              ORDER BY ur.created_at DESC
              LIMIT 100`,
              values
            ),
        kind === 'users'
          ? Promise.resolve({ rows: [] })
          : pool.query(
              `SELECT
                pr.id, pr.reporter_id, pr.target_type, pr.target_id, pr.reported_user_id,
                pr.reason, pr.details, COALESCE(pr.status, 'pending') AS status,
                pr.created_at, pr.updated_at,
                rp.first_name AS reporter_first_name, rp.last_name AS reporter_last_name,
                rp.username AS reporter_username, rp.avatar_url AS reporter_avatar,
                ru.first_name AS reported_first_name, ru.last_name AS reported_last_name,
                ru.username AS reported_username, ru.email AS reported_email,
                ru.avatar_url AS reported_avatar, COALESCE(ru.is_verified, false) AS reported_is_verified,
                CASE
                  WHEN pr.target_type = 'post' THEN (SELECT COALESCE(dp.title, dp.content) FROM public.discussion_posts dp WHERE dp.id = pr.target_id)
                  WHEN pr.target_type = 'reel' THEN (SELECT COALESCE(r.title, r.description) FROM public.reels r WHERE r.id = pr.target_id)
                  WHEN pr.target_type = 'story' THEN (SELECT us.caption FROM public.user_stories us WHERE us.id = pr.target_id)
                  WHEN pr.target_type = 'message' THEN (SELECT dm.message_text FROM public.direct_messages dm WHERE dm.id = pr.target_id)
                  WHEN pr.target_type = 'comment' THEN (
                    SELECT COALESCE(
                      (SELECT dc.comment_text FROM public.discussion_comments dc WHERE dc.id = pr.target_id),
                      (SELECT rc.comment_text FROM public.reel_comments rc WHERE rc.id = pr.target_id)
                    )
                  )
                  ELSE NULL
                END AS target_preview,
                CASE
                  WHEN pr.target_type = 'post' THEN (SELECT dp.image_url FROM public.discussion_posts dp WHERE dp.id = pr.target_id)
                  WHEN pr.target_type = 'reel' THEN (SELECT r.thumbnail_url FROM public.reels r WHERE r.id = pr.target_id)
                  WHEN pr.target_type = 'story' THEN (SELECT us.media_url FROM public.user_stories us WHERE us.id = pr.target_id)
                  ELSE NULL
                END AS target_media_url
              FROM public.post_reports pr
              LEFT JOIN public.profiles rp ON pr.reporter_id = rp.id
              LEFT JOIN public.profiles ru ON pr.reported_user_id = ru.id
              ${postWhere}
              ORDER BY pr.created_at DESC
              LIMIT 100`,
              values
            ),
      ]);

      return {
        reports: userReportsRes.rows,
        postReports: postReportsRes.rows,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    let uq = supabaseAdmin.from('user_reports').select('*').order('created_at', { ascending: false }).limit(100);
    let pq = supabaseAdmin.from('post_reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (status && status !== 'all') {
      uq = uq.eq('status', status);
      pq = pq.eq('status', status);
    }

    const [urRes, prRes] = await Promise.all([
      kind === 'content' ? Promise.resolve({ data: [], error: null }) : uq,
      kind === 'users' ? Promise.resolve({ data: [], error: null }) : pq,
    ]);
    if (urRes.error) throw urRes.error;
    if (prRes.error) throw prRes.error;

    const rawUserReports = (urRes.data || []) as Array<Record<string, unknown>>;
    const rawPostReports = (prRes.data || []) as Array<Record<string, unknown>>;

    const userIds = Array.from(
      new Set(
        [
          ...rawUserReports.flatMap((r) => [r.reporter_id, r.reported_user_id]),
          ...rawPostReports.flatMap((r) => [r.reporter_id, r.reported_user_id]),
        ]
          .map((x) => (x ? String(x) : ''))
          .filter(Boolean)
      )
    );

    const profMap = new Map<string, Record<string, unknown>>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, username, email, avatar_url, is_verified')
        .in('id', userIds);
      for (const p of (profs || []) as Array<Record<string, unknown>>) {
        profMap.set(String(p.id), p);
      }
    }

    const reports = rawUserReports.map((r) => {
      const rp = profMap.get(String(r.reporter_id || '')) || {};
      const ru = profMap.get(String(r.reported_user_id || '')) || {};
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

    // Enrich post_reports target preview cleanly
    const postIds = rawPostReports.filter((r) => r.target_type === 'post').map((r) => String(r.target_id));
    const reelIds = rawPostReports.filter((r) => r.target_type === 'reel').map((r) => String(r.target_id));
    const storyIds = rawPostReports.filter((r) => r.target_type === 'story').map((r) => String(r.target_id));
    const msgIds = rawPostReports.filter((r) => r.target_type === 'message').map((r) => String(r.target_id));

    const [pData, rData, sData, mData] = await Promise.all([
      postIds.length ? supabaseAdmin.from('discussion_posts').select('id, title, content, image_url').in('id', postIds) : Promise.resolve({ data: [] }),
      reelIds.length ? supabaseAdmin.from('reels').select('id, title, description, thumbnail_url').in('id', reelIds) : Promise.resolve({ data: [] }),
      storyIds.length ? supabaseAdmin.from('user_stories').select('id, caption, media_url').in('id', storyIds) : Promise.resolve({ data: [] }),
      msgIds.length ? supabaseAdmin.from('direct_messages').select('id, message_text, attachment_url').in('id', msgIds) : Promise.resolve({ data: [] }),
    ]);

    const targetMap = new Map<string, { preview: string | null; media: string | null }>();
    for (const row of (pData.data || []) as Array<Record<string, unknown>>) {
      targetMap.set(`post:${row.id}`, { preview: String(row.title || row.content || ''), media: (row.image_url as string) || null });
    }
    for (const row of (rData.data || []) as Array<Record<string, unknown>>) {
      targetMap.set(`reel:${row.id}`, { preview: String(row.title || row.description || ''), media: (row.thumbnail_url as string) || null });
    }
    for (const row of (sData.data || []) as Array<Record<string, unknown>>) {
      targetMap.set(`story:${row.id}`, { preview: String(row.caption || 'Story item'), media: (row.media_url as string) || null });
    }
    for (const row of (mData.data || []) as Array<Record<string, unknown>>) {
      targetMap.set(`message:${row.id}`, { preview: String(row.message_text || '[Attachment]'), media: (row.attachment_url as string) || null });
    }

    const postReports = rawPostReports.map((r) => {
      const rp = profMap.get(String(r.reporter_id || '')) || {};
      const ru = profMap.get(String(r.reported_user_id || '')) || {};
      const tgt = targetMap.get(`${r.target_type}:${r.target_id}`);
      return {
        id: r.id,
        reporter_id: r.reporter_id,
        target_type: r.target_type,
        target_id: r.target_id,
        reported_user_id: r.reported_user_id,
        reason: r.reason,
        details: r.details,
        status: r.status || 'pending',
        created_at: r.created_at,
        updated_at: r.updated_at,
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
        target_preview: tgt?.preview || null,
        target_media_url: tgt?.media || null,
      };
    });

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      reports,
      postReports,
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
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      reportId?: string;
      status?: string;
      reportSource?: 'user_reports' | 'post_reports';
      deleteTarget?: boolean;
      targetType?: string;
      targetId?: string;
    };
    const { reportId, status, reportSource = 'user_reports', deleteTarget, targetType, targetId } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { success: false, error: 'Report ID and new status are required' },
        { status: 400 }
      );
    }

    const allowedStatuses = ['pending', 'resolved', 'dismissed'];
    if (!allowedStatuses.includes(String(status))) {
      return NextResponse.json(
        { success: false, error: 'Invalid report status' },
        { status: 400 }
      );
    }

    const table = reportSource === 'post_reports' ? 'post_reports' : 'user_reports';
    const nowIso = new Date().toISOString();

    if (deleteTarget && targetType && targetId) {
      if (targetType === 'post') {
        await supabaseAdmin.from('discussion_posts').update({ deleted_at: nowIso }).eq('id', targetId);
      } else if (targetType === 'reel') {
        await supabaseAdmin.from('reels').update({ deleted_at: nowIso, is_published: false }).eq('id', targetId);
      } else if (targetType === 'story') {
        await supabaseAdmin.from('user_stories').update({ deleted_at: nowIso }).eq('id', targetId);
      } else if (targetType === 'comment') {
        await supabaseAdmin.from('discussion_comments').update({ deleted_at: nowIso }).eq('id', targetId);
        await supabaseAdmin.from('reel_comments').update({ deleted_at: nowIso }).eq('id', targetId);
      } else if (targetType === 'message') {
        await supabaseAdmin.from('direct_messages').update({ deleted_at: nowIso, message_text: '[Removed by Moderation]' }).eq('id', targetId);
      }
    }

    const directOk = await tryDirectQuery(async (pool) => {
      if (table === 'post_reports') {
        await pool.query(`UPDATE public.post_reports SET status = $1, updated_at = NOW() WHERE id = $2`, [status, reportId]);
      } else {
        await pool.query(`UPDATE public.user_reports SET status = $1 WHERE id = $2`, [status, reportId]);
      }
      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (admin_id, action, target_resource_id, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            auth.admin.name,
            deleteTarget ? 'MODERATION_DELETE_REPORTED_CONTENT' : 'UPDATE_REPORT_STATUS',
            String(reportId),
            JSON.stringify({ status, table, targetType, targetId, deleteTarget }),
          ]
        );
      } catch {
        // ignore audit log error
      }
      return true;
    });

    if (!directOk) {
      await supabaseAdmin
        .from(table)
        .update(table === 'post_reports' ? { status, updated_at: nowIso } : { status })
        .eq('id', reportId);

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: deleteTarget ? 'MODERATION_DELETE_REPORTED_CONTENT' : 'UPDATE_REPORT_STATUS',
        target_resource_id: String(reportId),
        details: { status, table, targetType, targetId, deleteTarget },
      });
    }

    return NextResponse.json({
      success: true,
      message: deleteTarget ? `Reported ${targetType} removed & report marked ${status}` : `Report marked as ${status}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update report' },
      { status: 500 }
    );
  }
}
