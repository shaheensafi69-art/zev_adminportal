import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      const statsRes = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) AS total_users,
          (SELECT COUNT(*) FROM public.profiles WHERE is_verified = true) AS verified_users,
          (SELECT COUNT(*) FROM public.profiles WHERE is_restricted = true) AS restricted_users,
          (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL AND deleted_at IS NULL) AS unconfirmed_users,
          (
            SELECT COUNT(*) FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            WHERE ((u.banned_until IS NOT NULL AND u.banned_until > NOW()) OR COALESCE(p.is_banned, false) = true)
              AND u.deleted_at IS NULL
          ) AS banned_users,
          (SELECT COUNT(*) FROM public.discussion_posts WHERE deleted_at IS NULL) AS total_posts,
          (SELECT COUNT(*) FROM public.reels WHERE deleted_at IS NULL) AS total_reels,
          (SELECT COUNT(*) FROM public.profiles WHERE is_online = true) AS online_users,
          (SELECT COUNT(*) FROM public.user_reports WHERE status = 'pending') AS pending_reports,
          (SELECT COUNT(*) FROM public.post_reports WHERE status = 'pending') AS pending_post_reports,
          (SELECT COUNT(*) FROM public.user_restrictions WHERE status = 'active' AND type = 'WARNING') AS active_warnings,
          (SELECT COUNT(*) FROM public.appeals WHERE status IN ('pending', 'under_review')) AS pending_appeals,
          (SELECT COUNT(*) FROM public.user_devices WHERE is_active = true) AS active_devices,
          (SELECT COUNT(*) FROM public.live_streams WHERE status = 'live') AS active_live_streams,
          (SELECT COUNT(*) FROM public.ad_campaigns WHERE status = 'pending_review') AS pending_campaigns,
          (SELECT COUNT(*) FROM public.advertisers WHERE status = 'pending') AS pending_advertisers,
          (SELECT COUNT(*) FROM public.user_support_tickets WHERE status IN ('open', 'in_progress')) AS pending_support_tickets,
          (SELECT COUNT(*) FROM public.account_deletions WHERE status IN ('requested', 'pending')) AS pending_deletions,
          (SELECT COUNT(*) FROM public.user_sessions WHERE is_active = true) AS active_sessions,
          (SELECT COUNT(*) FROM public.user_stories WHERE deleted_at IS NULL AND expires_at > NOW()) AS total_stories,
          (SELECT COUNT(*) FROM public.media_deletion_queue WHERE status <> 'completed') AS queued_media_deletions,
          (SELECT COALESCE(SUM(sent_count), 0) FROM public.notification_deliveries) AS push_sent_total,
          (SELECT COALESCE(SUM(failed_count), 0) FROM public.notification_deliveries) AS push_failed_total,
          (SELECT COUNT(*) FROM public.conversations) AS total_conversations,
          (SELECT COUNT(*) FROM public.hashtags) AS trending_hashtags_count
      `);
      return statsRes.rows[0];
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        stats: {
          totalUsers: parseInt(directResult.total_users || '0', 10),
          verifiedUsers: parseInt(directResult.verified_users || '0', 10),
          restrictedUsers: parseInt(directResult.restricted_users || '0', 10),
          unconfirmedUsers: parseInt(directResult.unconfirmed_users || '0', 10),
          bannedUsers: parseInt(directResult.banned_users || '0', 10),
          totalPosts: parseInt(directResult.total_posts || '0', 10),
          totalReels: parseInt(directResult.total_reels || '0', 10),
          onlineUsers: parseInt(directResult.online_users || '0', 10),
          pendingReports: parseInt(directResult.pending_reports || '0', 10),
          pendingPostReports: parseInt(directResult.pending_post_reports || '0', 10),
          activeWarnings: parseInt(directResult.active_warnings || '0', 10),
          pendingAppeals: parseInt(directResult.pending_appeals || '0', 10),
          activeDevices: parseInt(directResult.active_devices || '0', 10),
          activeLiveStreams: parseInt(directResult.active_live_streams || '0', 10),
          pendingCampaigns: parseInt(directResult.pending_campaigns || '0', 10),
          pendingAdvertisers: parseInt(directResult.pending_advertisers || '0', 10),
          pendingSupportTickets: parseInt(directResult.pending_support_tickets || '0', 10),
          pendingDeletions: parseInt(directResult.pending_deletions || '0', 10),
          activeSessions: parseInt(directResult.active_sessions || '0', 10),
          totalStories: parseInt(directResult.total_stories || '0', 10),
          queuedMediaDeletions: parseInt(directResult.queued_media_deletions || '0', 10),
          pushSentTotal: parseInt(directResult.push_sent_total || '0', 10),
          pushFailedTotal: parseInt(directResult.push_failed_total || '0', 10),
          totalConversations: parseInt(directResult.total_conversations || '0', 10),
          trendingHashtagsCount: parseInt(directResult.trending_hashtags_count || '0', 10),
          dbMode: 'direct_postgres',
        },
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role
    const nowIso = new Date().toISOString();
    const [
      usersAuthRes,
      verifiedRes,
      restrictedRes,
      postsRes,
      reelsRes,
      reportsRes,
      postReportsRes,
      warningsRes,
      onlineRes,
      appealsRes,
      devicesRes,
      liveRes,
      campaignsRes,
      advertisersRes,
      ticketsRes,
      deletionsRes,
      sessionsRes,
      storiesRes,
      mediaQueueRes,
      deliveriesRes,
      conversationsRes,
      hashtagsRes,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_restricted', true),
      supabaseAdmin.from('discussion_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabaseAdmin.from('reels').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabaseAdmin.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('post_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('user_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('type', 'WARNING'),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
      supabaseAdmin.from('appeals').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
      supabaseAdmin.from('user_devices').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('live_streams').select('id', { count: 'exact', head: true }).eq('status', 'live'),
      supabaseAdmin.from('ad_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabaseAdmin.from('advertisers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('user_support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      supabaseAdmin.from('account_deletions').select('id', { count: 'exact', head: true }).in('status', ['requested', 'pending']),
      supabaseAdmin.from('user_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('user_stories').select('id', { count: 'exact', head: true }).is('deleted_at', null).gt('expires_at', nowIso),
      supabaseAdmin.from('media_deletion_queue').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
      supabaseAdmin.from('notification_deliveries').select('sent_count, failed_count').limit(500),
      supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('hashtags').select('id', { count: 'exact', head: true }),
    ]);

    const allAuthUsers = usersAuthRes.data?.users || [];
    const totalUsers = ((usersAuthRes.data as unknown as { total?: number })?.total) ?? allAuthUsers.length;
    const now = new Date();
    const bannedUsers = allAuthUsers.filter((u) => u.banned_until && new Date(u.banned_until) > now).length;
    const unconfirmedUsers = allAuthUsers.filter((u) => !u.email_confirmed_at).length;

    const deliveryRows = (deliveriesRes.data || []) as Array<{ sent_count?: number; failed_count?: number }>;
    const pushSentTotal = deliveryRows.reduce((sum, r) => sum + Number(r.sent_count || 0), 0);
    const pushFailedTotal = deliveryRows.reduce((sum, r) => sum + Number(r.failed_count || 0), 0);

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      stats: {
        totalUsers,
        verifiedUsers: verifiedRes.count || 0,
        restrictedUsers: restrictedRes.count || 0,
        unconfirmedUsers,
        bannedUsers,
        totalPosts: postsRes.count || 0,
        totalReels: reelsRes.count || 0,
        onlineUsers: onlineRes.count || 0,
        pendingReports: reportsRes.count || 0,
        pendingPostReports: postReportsRes.count || 0,
        activeWarnings: warningsRes.count || 0,
        pendingAppeals: appealsRes.count || 0,
        activeDevices: devicesRes.count || 0,
        activeLiveStreams: liveRes.count || 0,
        pendingCampaigns: campaignsRes.count || 0,
        pendingAdvertisers: advertisersRes.count || 0,
        pendingSupportTickets: ticketsRes.count || 0,
        pendingDeletions: deletionsRes.count || 0,
        activeSessions: sessionsRes.count || 0,
        totalStories: storiesRes.count || 0,
        queuedMediaDeletions: mediaQueueRes.count || 0,
        pushSentTotal,
        pushFailedTotal,
        totalConversations: conversationsRes.count || 0,
        trendingHashtagsCount: hashtagsRes.count || 0,
        dbMode: 'supabase_https_service_role',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
