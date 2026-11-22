import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const tab = searchParams.get('tab') || 'summary';
  const query = searchParams.get('q') || '';
  const gateway = searchParams.get('gateway') || 'all';
  const status = searchParams.get('status') || 'all';

  try {
    // 1. Direct PostgreSQL Query with fallback to Supabase
    const result = await tryDirectQuery(async (pool) => {
      if (tab === 'summary') {
        const statsQuery = await pool.query(`
          SELECT 
            (SELECT COALESCE(SUM(coins_balance), 0) FROM profiles) as "totalCoinsCirculating",
            (SELECT COALESCE(SUM(usd_amount), 0) FROM coin_purchases WHERE payment_status = 'completed') as "grossRevenueUsd",
            (SELECT COALESCE(SUM(coins_amount), 0) FROM coin_purchases WHERE payment_status = 'completed') as "totalCoinsPurchased",
            (SELECT COALESCE(SUM(gross_usd), 0) FROM gift_transactions) as "totalGiftsValueUsd",
            (SELECT COALESCE(SUM(platform_usd), 0) FROM gift_transactions) as "platformEarningsUsd",
            (SELECT COALESCE(SUM(creator_usd), 0) FROM gift_transactions) as "creatorEarningsUsd",
            (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as "pendingPayoutsCount",
            (SELECT COALESCE(SUM(amount_usd), 0) FROM payout_requests WHERE status = 'pending') as "pendingPayoutsUsd",
            (SELECT COUNT(*) FROM coin_packages WHERE is_active = true) as "activePackagesCount"
        `);

        return {
          tab: 'summary',
          summary: statsQuery.rows[0],
        };
      }

      if (tab === 'packages') {
        const pkgs = await pool.query(`
          SELECT * FROM coin_packages 
          ORDER BY sort_order ASC, coins ASC
        `);
        return { tab: 'packages', packages: pkgs.rows };
      }

      if (tab === 'purchases') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (gateway !== 'all') {
          params.push(gateway);
          whereClauses.push(`cp.payment_gateway = $${params.length}`);
        }

        if (status !== 'all') {
          params.push(status);
          whereClauses.push(`cp.payment_status = $${params.length}`);
        }

        if (query.trim()) {
          params.push(`%${query.trim()}%`);
          whereClauses.push(`(cp.order_id ILIKE $${params.length} OR p.username ILIKE $${params.length} OR b.username ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const purchases = await pool.query(`
          SELECT 
            cp.*,
            p.username,
            p.first_name,
            p.last_name,
            p.avatar_url,
            b.username as buyer_username
          FROM coin_purchases cp
          LEFT JOIN profiles p ON cp.user_id = p.id
          LEFT JOIN profiles b ON cp.buyer_user_id = b.id
          ${whereSql}
          ORDER BY cp.created_at DESC
          LIMIT 100
        `, params);

        return { tab: 'purchases', purchases: purchases.rows };
      }

      if (tab === 'gifts') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (query.trim()) {
          params.push(`%${query.trim()}%`);
          whereClauses.push(`(s.username ILIKE $${params.length} OR r.username ILIKE $${params.length} OR gt.gift_name ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const gifts = await pool.query(`
          SELECT 
            gt.*,
            s.username as sender_username,
            s.avatar_url as sender_avatar,
            r.username as receiver_username,
            r.avatar_url as receiver_avatar
          FROM gift_transactions gt
          LEFT JOIN profiles s ON gt.sender_id = s.id
          LEFT JOIN profiles r ON gt.receiver_id = r.id
          ${whereSql}
          ORDER BY gt.created_at DESC
          LIMIT 100
        `, params);

        return { tab: 'gifts', gifts: gifts.rows };
      }

      if (tab === 'payouts') {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (status !== 'all') {
          params.push(status);
          whereClauses.push(`pr.status = $${params.length}`);
        }

        if (query.trim()) {
          params.push(`%${query.trim()}%`);
          whereClauses.push(`(p.username ILIKE $${params.length} OR pr.destination_account ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const payouts = await pool.query(`
          SELECT 
            pr.*,
            p.username,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.earnings_usd
          FROM payout_requests pr
          LEFT JOIN profiles p ON pr.user_id = p.id
          ${whereSql}
          ORDER BY pr.created_at DESC
          LIMIT 100
        `, params);

        return { tab: 'payouts', payouts: payouts.rows };
      }

      if (tab === 'user_search') {
        if (!query.trim()) return { tab: 'user_search', users: [] };
        const users = await pool.query(`
          SELECT 
            id, username, first_name, last_name, avatar_url, is_verified,
            coins_balance, earnings_usd, earnings_coins, total_coins_purchased, total_coins_spent
          FROM profiles
          WHERE username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
          ORDER BY is_verified DESC, coins_balance DESC
          LIMIT 15
        `, [`%${query.trim()}%`]);
        return { tab: 'user_search', users: users.rows };
      }

      return null;
    });

    if (result) {
      return NextResponse.json({ success: true, source: 'pg_direct', ...result });
    }

    // Fallback via Supabase REST
    if (tab === 'packages') {
      const { data, error } = await supabaseAdmin
        .from('coin_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ success: true, source: 'supabase_https', tab: 'packages', packages: data || [] });
    }

    if (tab === 'purchases') {
      const { data, error } = await supabaseAdmin
        .from('coin_purchases')
        .select(`
          *,
          user:profiles!user_id(username, first_name, last_name, avatar_url),
          buyer:profiles!buyer_user_id(username)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const formatted = (data || []).map((cp: any) => ({
        ...cp,
        username: cp.user?.username,
        first_name: cp.user?.first_name,
        last_name: cp.user?.last_name,
        avatar_url: cp.user?.avatar_url,
        buyer_username: cp.buyer?.username,
      }));
      return NextResponse.json({ success: true, source: 'supabase_https', tab: 'purchases', purchases: formatted });
    }

    return NextResponse.json({ success: true, message: 'Ready' });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error in coins admin GET:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch coins data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action parameter' }, { status: 400 });
    }

    // 1. CREATE PACKAGE
    if (action === 'CREATE_PACKAGE') {
      const { id, coins, usd_price, discount_percent, badge, is_popular, is_active, sort_order } = body;
      if (!id || !coins || !usd_price) {
        return NextResponse.json({ success: false, error: 'Package ID, coins, and usd_price are required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('coin_packages')
        .insert({
          id: id.trim().toLowerCase().replace(/\s+/g, '_'),
          coins: Number(coins),
          usd_price: Number(usd_price),
          discount_percent: Number(discount_percent || 0),
          badge: badge ? badge.trim() : null,
          is_popular: Boolean(is_popular),
          is_active: is_active !== false,
          sort_order: Number(sort_order || 0),
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit trail
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'CREATE_COIN_PACKAGE',
        target_resource_id: id,
        details: { coins, usd_price, badge },
      });

      return NextResponse.json({ success: true, package: data });
    }

    // 2. UPDATE PACKAGE
    if (action === 'UPDATE_PACKAGE') {
      const { id, coins, usd_price, discount_percent, badge, is_popular, is_active, sort_order } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Package ID is required' }, { status: 400 });
      }

      const updateData: any = {};
      if (coins !== undefined) updateData.coins = Number(coins);
      if (usd_price !== undefined) updateData.usd_price = Number(usd_price);
      if (discount_percent !== undefined) updateData.discount_percent = Number(discount_percent);
      if (badge !== undefined) updateData.badge = badge ? badge.trim() : null;
      if (is_popular !== undefined) updateData.is_popular = Boolean(is_popular);
      if (is_active !== undefined) updateData.is_active = Boolean(is_active);
      if (sort_order !== undefined) updateData.sort_order = Number(sort_order);

      const { data, error } = await supabaseAdmin
        .from('coin_packages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'UPDATE_COIN_PACKAGE',
        target_resource_id: id,
        details: updateData,
      });

      return NextResponse.json({ success: true, package: data });
    }

    // 3. DELETE PACKAGE
    if (action === 'DELETE_PACKAGE') {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: 'Package ID required' }, { status: 400 });

      const { error } = await supabaseAdmin.from('coin_packages').delete().eq('id', id);
      if (error) throw error;

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: 'DELETE_COIN_PACKAGE',
        target_resource_id: id,
      });

      return NextResponse.json({ success: true, deleted: id });
    }

    // 4. MANUAL ADJUST USER COINS (Credit or Debit)
    if (action === 'ADJUST_COINS') {
      const { userId, amount, mode, reason } = body;
      if (!userId || !amount || !['credit', 'debit'].includes(mode)) {
        return NextResponse.json({ success: false, error: 'userId, amount, and mode (credit|debit) required' }, { status: 400 });
      }

      const delta = mode === 'credit' ? Math.abs(Number(amount)) : -Math.abs(Number(amount));

      // Direct Postgres atomic update or supabase RPC
      const updated = await tryDirectQuery(async (pool) => {
        const res = await pool.query(`
          UPDATE profiles
          SET coins_balance = GREATEST(0, COALESCE(coins_balance, 0) + $1)
          WHERE id = $2
          RETURNING id, username, coins_balance
        `, [delta, userId]);
        return res.rows[0];
      });

      if (!updated) {
        // Fallback Supabase
        const { data: user } = await supabaseAdmin.from('profiles').select('coins_balance').eq('id', userId).single();
        const current = user?.coins_balance ?? 0;
        const newBalance = Math.max(0, current + delta);
        await supabaseAdmin.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
      }

      // Record manual purchase/adjustment log in coin_purchases so user has record
      await supabaseAdmin.from('coin_purchases').insert({
        user_id: userId,
        coins_amount: Math.abs(delta),
        usd_amount: 0.00,
        payment_gateway: mode === 'credit' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        payment_status: 'completed',
        order_id: `admin_adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        metadata: {
          admin: auth.admin.name,
          mode,
          reason: reason || 'Manual Admin Balance Adjustment',
          delta,
        },
      });

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: `MANUAL_COINS_${mode.toUpperCase()}`,
        target_user_id: userId,
        details: { amount: delta, reason, mode },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully ${mode === 'credit' ? 'added' : 'deducted'} ${Math.abs(delta).toLocaleString()} coins.`,
        newBalance: updated?.coins_balance,
      });
    }

    // 5. UPDATE CREATOR PAYOUT STATUS
    if (action === 'UPDATE_PAYOUT') {
      const { payoutId, status: newStatus, adminNotes } = body;
      if (!payoutId || !['pending', 'processing', 'completed', 'rejected'].includes(newStatus)) {
        return NextResponse.json({ success: false, error: 'payoutId and valid status required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('payout_requests')
        .update({
          status: newStatus,
          admin_notes: adminNotes || null,
          processed_at: ['completed', 'rejected'].includes(newStatus) ? new Date().toISOString() : null,
        })
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: auth.admin.name,
        action: `PAYOUT_${newStatus.toUpperCase()}`,
        target_resource_id: payoutId,
        details: { status: newStatus, adminNotes },
      });

      return NextResponse.json({ success: true, payout: data });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error in coins admin POST:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}
