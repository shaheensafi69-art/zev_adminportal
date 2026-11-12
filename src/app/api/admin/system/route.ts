import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const [
      migrationsRes,
      mediaQueueRes,
      conversationsCount,
      messagesCount,
      requestsCount,
      notesCount,
      highlightsCount,
      followsCount,
      followRequestsCount,
      closeFriendsCount,
      blocksCount,
      mutesCount,
      postMediaCount,
      hashtagsCount,
      trendingCount,
      searchesCount,
    ] = await Promise.all([
      supabaseAdmin.from('schema_migrations').select('*').order('version', { ascending: true }),
      supabaseAdmin.from('media_deletion_queue').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('direct_messages').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('message_requests').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_notes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_highlights').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_follows').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('follow_requests').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('close_friends').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_blocks').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_mutes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('post_media').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('hashtags').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('trending_topics').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('search_history').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      success: true,
      migrations: migrationsRes.data || [],
      mediaQueue: mediaQueueRes.data || [],
      ecosystemCounts: {
        conversations: conversationsCount.count || 0,
        directMessages: messagesCount.count || 0,
        messageRequests: requestsCount.count || 0,
        userNotes: notesCount.count || 0,
        userHighlights: highlightsCount.count || 0,
        userFollows: followsCount.count || 0,
        followRequests: followRequestsCount.count || 0,
        closeFriends: closeFriendsCount.count || 0,
        userBlocks: blocksCount.count || 0,
        userMutes: mutesCount.count || 0,
        postMedia: postMediaCount.count || 0,
        hashtags: hashtagsCount.count || 0,
        trendingTopics: trendingCount.count || 0,
        searchHistory: searchesCount.count || 0,
      },
      environmentHealth: {
        hasSupabaseServiceRole: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
        hasFirebaseServiceAccount: Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()),
        hasR2Credentials: Boolean(
          (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim() &&
            (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim()
        ),
        hasZevWebUrl: Boolean((process.env.ZEV_WEB_URL || '').trim()),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error loading system health:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load system health' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      action?: string;
      queueId?: string;
      status?: string;
    };

    const action = String(body.action || '').toUpperCase();

    if (action === 'RECONCILE_COUNTERS') {
      let result: unknown = null;
      const directResult = await tryDirectQuery(async (pool) => {
        const res = await pool.query(`SELECT public.reconcile_all_counters() AS result`);
        return res.rows[0]?.result ?? null;
      });

      if (directResult !== null) {
        result = directResult;
      } else {
        const { data, error } = await supabaseAdmin.rpc('reconcile_all_counters');
        if (error) throw error;
        result = data;
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'RECONCILE_ALL_COUNTERS',
        details: (typeof result === 'object' && result !== null ? result : { result }) as Record<string, unknown>,
      });

      return NextResponse.json({
        success: true,
        result,
        message: 'Atomic counter reconciliation completed across posts, reels, profiles, stories & hashtags',
      });
    }

    if (action === 'EXPIRE_STALE_SUBSCRIPTIONS') {
      let result: unknown = null;
      const directResult = await tryDirectQuery(async (pool) => {
        const res = await pool.query(`SELECT public.expire_stale_subscriptions() AS result`);
        return res.rows[0]?.result ?? null;
      });
      if (directResult !== null) {
        result = directResult;
      } else {
        const { data, error } = await supabaseAdmin.rpc('expire_stale_subscriptions');
        if (error) throw error;
        result = data;
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'EXPIRE_STALE_SUBSCRIPTIONS',
        details: { result },
      });

      return NextResponse.json({
        success: true,
        result,
        message: 'Stale subscriptions sweep executed (lifetime referral badges preserved)',
      });
    }

    if (action === 'UPDATE_MEDIA_QUEUE') {
      const queueId = String(body.queueId || '').trim();
      const status = String(body.status || 'completed').trim();
      if (!queueId || !UUID_REGEX.test(queueId)) {
        return NextResponse.json({ success: false, error: 'Valid UUID queueId required' }, { status: 400 });
      }
      await supabaseAdmin
        .from('media_deletion_queue')
        .update({
          status,
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return NextResponse.json({ success: true, message: `Media queue item updated to ${status}` });
    }

    return NextResponse.json({ success: false, error: 'Unsupported system action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'System health action failed' },
      { status: 500 }
    );
  }
}

