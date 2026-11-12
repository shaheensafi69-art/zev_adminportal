import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';
import { dispatchAdminPush } from '@/lib/push';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const directResult = await tryDirectQuery(async (pool) => {
      const [advRes, campRes, invRes, kpiRes] = await Promise.all([
        pool.query(`
          SELECT
            a.*,
            p.username,
            p.first_name,
            p.last_name,
            p.email,
            p.avatar_url,
            COALESCE(p.is_verified, false) AS is_verified,
            COUNT(c.id)::int AS campaigns_count,
            COALESCE(SUM(c.spent_amount), 0)::numeric(14,2) AS total_spent
          FROM public.advertisers a
          LEFT JOIN public.profiles p ON p.id = a.user_id
          LEFT JOIN public.ad_campaigns c ON c.advertiser_id = a.id
          GROUP BY a.id, p.id
          ORDER BY a.created_at DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            c.*,
            a.user_id AS owner_user_id,
            a.business_name,
            a.status AS advertiser_status,
            a.balance AS advertiser_balance,
            p.username AS owner_username,
            cr.id AS creative_id,
            cr.title AS creative_title,
            cr.body AS creative_body,
            cr.media_url AS creative_media_url,
            cr.media_type AS creative_media_type,
            cr.cta_label AS creative_cta_label,
            cr.destination_url AS creative_destination_url,
            cr.status AS creative_status,
            t.countries AS target_countries,
            t.languages AS target_languages,
            t.interests AS target_interests,
            t.min_age AS target_min_age,
            t.max_age AS target_max_age,
            t.gender AS target_gender
          FROM public.ad_campaigns c
          JOIN public.advertisers a ON a.id = c.advertiser_id
          LEFT JOIN public.profiles p ON p.id = a.user_id
          LEFT JOIN LATERAL (
            SELECT * FROM public.ad_creatives cr0
            WHERE cr0.campaign_id = c.id
            ORDER BY cr0.created_at DESC
            LIMIT 1
          ) cr ON true
          LEFT JOIN public.ad_targeting t ON t.campaign_id = c.id
          ORDER BY
            CASE c.status WHEN 'pending_review' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
            c.created_at DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            i.*,
            a.business_name,
            a.user_id AS owner_user_id,
            c.name AS campaign_name
          FROM public.ad_invoices i
          JOIN public.advertisers a ON a.id = i.advertiser_id
          LEFT JOIN public.ad_campaigns c ON c.id = i.campaign_id
          ORDER BY i.created_at DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM public.advertisers) AS total_advertisers,
            (SELECT COUNT(*)::int FROM public.advertisers WHERE status = 'pending') AS pending_advertisers,
            (SELECT COUNT(*)::int FROM public.ad_campaigns WHERE status = 'active') AS active_campaigns,
            (SELECT COUNT(*)::int FROM public.ad_campaigns WHERE status = 'pending_review') AS pending_campaigns,
            (SELECT COALESCE(SUM(impressions_count), 0)::bigint FROM public.ad_campaigns) AS total_impressions,
            (SELECT COALESCE(SUM(clicks_count), 0)::bigint FROM public.ad_campaigns) AS total_clicks,
            (SELECT COALESCE(SUM(conversions_count), 0)::bigint FROM public.ad_campaigns) AS total_conversions,
            (SELECT COALESCE(SUM(spent_amount), 0)::numeric(14,2) FROM public.ad_campaigns) AS total_ad_revenue,
            (SELECT COUNT(*)::int FROM public.ad_impressions WHERE is_flagged = true)
              + (SELECT COUNT(*)::int FROM public.ad_clicks WHERE is_flagged = true) AS fraud_flagged_events
        `),
      ]);

      const k = kpiRes.rows[0] || {};
      const totalImpr = Number(k.total_impressions || 0);
      const totalClicks = Number(k.total_clicks || 0);

      return {
        advertisers: advRes.rows,
        campaigns: campRes.rows,
        invoices: invRes.rows,
        kpis: {
          totalAdvertisers: Number(k.total_advertisers || 0),
          pendingAdvertisers: Number(k.pending_advertisers || 0),
          activeCampaigns: Number(k.active_campaigns || 0),
          pendingCampaigns: Number(k.pending_campaigns || 0),
          totalImpressions: totalImpr,
          totalClicks,
          totalConversions: Number(k.total_conversions || 0),
          totalAdRevenue: Number(k.total_ad_revenue || 0),
          ctrPercent: totalImpr > 0 ? Number(((totalClicks / totalImpr) * 100).toFixed(2)) : 0,
          fraudFlaggedEvents: Number(k.fraud_flagged_events || 0),
        },
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        ...directResult,
      });
    }

    // Fallback via Supabase HTTPS Service Role
    const [advRes, campRes, crRes, invRes, flagImpRes, flagClkRes] = await Promise.all([
      supabaseAdmin.from('advertisers').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('ad_creatives').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('ad_invoices').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('ad_impressions').select('id', { count: 'exact', head: true }).eq('is_flagged', true),
      supabaseAdmin.from('ad_clicks').select('id', { count: 'exact', head: true }).eq('is_flagged', true),
    ]);

    const advList = advRes.data || [];
    const campList = campRes.data || [];
    const crMap = new Map<string, Record<string, unknown>>();
    for (const cr of (crRes.data || []) as Record<string, unknown>[]) {
      const cid = String(cr.campaign_id);
      if (!crMap.has(cid)) crMap.set(cid, cr);
    }
    const advMap = new Map<string, Record<string, unknown>>(
      advList.map((a: Record<string, unknown>) => [String(a.id), a])
    );

    const campaigns = campList.map((c: Record<string, unknown>) => {
      const adv = advMap.get(String(c.advertiser_id)) || {};
      const cr = crMap.get(String(c.id)) || {};
      return {
        ...c,
        owner_user_id: adv.user_id,
        business_name: adv.business_name,
        advertiser_status: adv.status,
        advertiser_balance: adv.balance ?? 0,
        creative_id: cr.id,
        creative_title: cr.title,
        creative_body: cr.body,
        creative_media_url: cr.media_url,
        creative_media_type: cr.media_type,
        creative_cta_label: cr.cta_label,
        creative_destination_url: cr.destination_url,
        creative_status: cr.status,
      };
    });

    const totalImpr = campList.reduce((acc, c: Record<string, unknown>) => acc + Number(c.impressions_count || 0), 0);
    const totalClicks = campList.reduce((acc, c: Record<string, unknown>) => acc + Number(c.clicks_count || 0), 0);

    return NextResponse.json({
      success: true,
      source: 'supabase_https',
      advertisers: advList,
      campaigns,
      invoices: invRes.data || [],
      kpis: {
        totalAdvertisers: advList.length,
        pendingAdvertisers: advList.filter((a: Record<string, unknown>) => a.status === 'pending').length,
        activeCampaigns: campList.filter((c: Record<string, unknown>) => c.status === 'active').length,
        pendingCampaigns: campList.filter((c: Record<string, unknown>) => c.status === 'pending_review').length,
        totalImpressions: totalImpr,
        totalClicks,
        totalConversions: campList.reduce((acc, c: Record<string, unknown>) => acc + Number(c.conversions_count || 0), 0),
        totalAdRevenue: Number(
          campList.reduce((acc, c: Record<string, unknown>) => acc + Number(c.spent_amount || 0), 0).toFixed(2)
        ),
        ctrPercent: totalImpr > 0 ? Number(((totalClicks / totalImpr) * 100).toFixed(2)) : 0,
        fraudFlaggedEvents: (flagImpRes.count || 0) + (flagClkRes.count || 0),
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error loading ads dashboard:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load ads telemetry' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, targetId, payload = {} } = body as {
      action?: string;
      targetId?: string;
      payload?: Record<string, unknown>;
    };

    if (!action || !targetId) {
      return NextResponse.json({ success: false, error: 'Missing action or targetId' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    let ownerUserId: string | null = null;
    let notifTitle = '';
    let notifMessage = '';

    const directOk = await tryDirectQuery(async (pool) => {
      switch (action) {
        case 'APPROVE_ADVERTISER': {
          const r = await pool.query(
            `UPDATE public.advertisers SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING user_id, business_name`,
            [targetId]
          );
          ownerUserId = r.rows[0]?.user_id || null;
          notifTitle = 'Advertiser Account Approved';
          notifMessage = `Your ZEV Ads account (${r.rows[0]?.business_name || ''}) is approved! Your reviewed campaigns can now run live.`;
          break;
        }
        case 'SUSPEND_ADVERTISER': {
          const r = await pool.query(
            `UPDATE public.advertisers SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING user_id`,
            [targetId]
          );
          await pool.query(
            `UPDATE public.ad_campaigns SET status = 'paused', updated_at = NOW() WHERE advertiser_id = $1 AND status = 'active'`,
            [targetId]
          );
          ownerUserId = r.rows[0]?.user_id || null;
          notifTitle = 'Advertiser Account Suspended';
          notifMessage = 'Your ZEV Ads advertiser account has been suspended pending compliance review.';
          break;
        }
        case 'TOP_UP_BALANCE': {
          const amount = Math.max(0.01, Number(payload.amount || 0));
          const r = await pool.query(
            `UPDATE public.advertisers SET balance = balance + $2, status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END, updated_at = NOW() WHERE id = $1 RETURNING user_id, balance`,
            [targetId, amount]
          );
          ownerUserId = r.rows[0]?.user_id || null;
          notifTitle = 'Ad Wallet Credited';
          notifMessage = `$${amount.toFixed(2)} was added to your ZEV Ads balance (Current balance: $${Number(r.rows[0]?.balance || amount).toFixed(2)}).`;
          break;
        }
        case 'APPROVE_CAMPAIGN': {
          const cRes = await pool.query(
            `UPDATE public.ad_campaigns
             SET status = 'active', approved_at = NOW(), rejection_reason = NULL, updated_at = NOW()
             WHERE id = $1
             RETURNING advertiser_id, name`,
            [targetId]
          );
          await pool.query(
            `UPDATE public.ad_creatives SET status = 'approved', updated_at = NOW() WHERE campaign_id = $1`,
            [targetId]
          );
          if (cRes.rows[0]?.advertiser_id) {
            const aRes = await pool.query(
              `UPDATE public.advertisers
               SET status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END, updated_at = NOW()
               WHERE id = $1
               RETURNING user_id`,
              [cRes.rows[0].advertiser_id]
            );
            ownerUserId = aRes.rows[0]?.user_id || null;
          }
          notifTitle = 'Ad Campaign Approved & Live!';
          notifMessage = `Your campaign "${cRes.rows[0]?.name || ''}" passed review and is now actively delivering on ZEV.`;
          break;
        }
        case 'REJECT_CAMPAIGN': {
          const reason = String(payload.reason || 'Does not meet ZEV Advertising Policy guidelines.').trim();
          const cRes = await pool.query(
            `UPDATE public.ad_campaigns
             SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING advertiser_id, name`,
            [targetId, reason]
          );
          await pool.query(
            `UPDATE public.ad_creatives SET status = 'rejected', updated_at = NOW() WHERE campaign_id = $1`,
            [targetId]
          );
          if (cRes.rows[0]?.advertiser_id) {
            const aRes = await pool.query(`SELECT user_id FROM public.advertisers WHERE id = $1`, [cRes.rows[0].advertiser_id]);
            ownerUserId = aRes.rows[0]?.user_id || null;
          }
          notifTitle = 'Ad Campaign Rejected';
          notifMessage = `Your campaign "${cRes.rows[0]?.name || ''}" was not approved: ${reason}`;
          break;
        }
        case 'PAUSE_CAMPAIGN': {
          await pool.query(`UPDATE public.ad_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`, [targetId]);
          break;
        }
        case 'RESUME_CAMPAIGN': {
          await pool.query(
            `UPDATE public.ad_campaigns
             SET status = 'active', approved_at = COALESCE(approved_at, NOW()), updated_at = NOW()
             WHERE id = $1`,
            [targetId]
          );
          await pool.query(
            `UPDATE public.ad_creatives SET status = 'approved', updated_at = NOW() WHERE campaign_id = $1 AND status = 'pending_review'`,
            [targetId]
          );
          break;
        }
        case 'MARK_INVOICE_PAID': {
          await pool.query(`UPDATE public.ad_invoices SET status = 'paid' WHERE id = $1`, [targetId]);
          break;
        }
        case 'VOID_INVOICE': {
          await pool.query(`UPDATE public.ad_invoices SET status = 'void' WHERE id = $1`, [targetId]);
          break;
        }
      }

      if (ownerUserId && notifTitle) {
        await pool.query(
          `INSERT INTO public.user_notifications (user_id, title, message, notification_type, app_source, is_read, created_at)
           VALUES ($1, $2, $3, 'system', 'zev', false, NOW())`,
          [ownerUserId, notifTitle, notifMessage]
        );
        void dispatchAdminPush({
          userId: ownerUserId,
          title: notifTitle,
          body: notifMessage,
          notificationType: 'system',
          deepLink: '/notifications',
        });
      }

      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, target_resource_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [auth.admin.name, `ADS_${action}`, ownerUserId, targetId, JSON.stringify({ payload, nowIso })]
        );
      } catch {
        // ignore audit log error
      }
      return true;
    });

    // Supabase HTTPS fallback ONLY when direct PG pool is unavailable
    if (!directOk) {
      if (action === 'APPROVE_ADVERTISER') {
        await supabaseAdmin.from('advertisers').update({ status: 'approved', updated_at: nowIso }).eq('id', targetId);
      } else if (action === 'SUSPEND_ADVERTISER') {
        await supabaseAdmin.from('advertisers').update({ status: 'suspended', updated_at: nowIso }).eq('id', targetId);
        await supabaseAdmin.from('ad_campaigns').update({ status: 'paused', updated_at: nowIso }).eq('advertiser_id', targetId).eq('status', 'active');
      } else if (action === 'TOP_UP_BALANCE') {
        const amount = Math.max(0.01, Number(payload.amount || 0));
        const { data: advRow } = await supabaseAdmin.from('advertisers').select('balance, status').eq('id', targetId).maybeSingle();
        if (advRow) {
          const nextBal = Number(advRow.balance || 0) + amount;
          await supabaseAdmin
            .from('advertisers')
            .update({
              balance: nextBal,
              status: advRow.status === 'pending' ? 'approved' : advRow.status,
              updated_at: nowIso,
            })
            .eq('id', targetId);
        }
      } else if (action === 'APPROVE_CAMPAIGN') {
        await supabaseAdmin.from('ad_campaigns').update({ status: 'active', approved_at: nowIso, rejection_reason: null, updated_at: nowIso }).eq('id', targetId);
        await supabaseAdmin.from('ad_creatives').update({ status: 'approved', updated_at: nowIso }).eq('campaign_id', targetId);
      } else if (action === 'REJECT_CAMPAIGN') {
        const reason = String(payload.reason || 'Does not meet ZEV Advertising Policy guidelines.').trim();
        await supabaseAdmin.from('ad_campaigns').update({ status: 'rejected', rejection_reason: reason, updated_at: nowIso }).eq('id', targetId);
        await supabaseAdmin.from('ad_creatives').update({ status: 'rejected', updated_at: nowIso }).eq('campaign_id', targetId);
      } else if (action === 'PAUSE_CAMPAIGN') {
        await supabaseAdmin.from('ad_campaigns').update({ status: 'paused', updated_at: nowIso }).eq('id', targetId);
      } else if (action === 'RESUME_CAMPAIGN') {
        await supabaseAdmin.from('ad_campaigns').update({ status: 'active', updated_at: nowIso }).eq('id', targetId);
      } else if (action === 'MARK_INVOICE_PAID') {
        await supabaseAdmin.from('ad_invoices').update({ status: 'paid' }).eq('id', targetId);
      } else if (action === 'VOID_INVOICE') {
        await supabaseAdmin.from('ad_invoices').update({ status: 'void' }).eq('id', targetId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ads action ${action} executed successfully`,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error performing ads admin action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ads admin action failed' },
      { status: 500 }
    );
  }
}
