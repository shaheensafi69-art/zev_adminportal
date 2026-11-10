import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || 'all'; // all, pending, active, cancelled

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      let statusFilter = '';
      const params: string[] = [];
      if (status !== 'all') {
        params.push(status);
        statusFilter = `WHERE s.status = $1`;
      }

      const sql = `
        SELECT 
          s.id,
          s.user_id,
          COALESCE(s.plan_type, s.plan) AS plan_type,
          COALESCE(s.plan_price, '$' || s.amount::text, '$0.00') AS plan_price,
          s.status,
          COALESCE(s.contact_phone, p.phone_number) AS contact_phone,
          s.notes,
          s.starts_at,
          s.expires_at,
          s.created_at,
          s.updated_at,
          p.username,
          p.first_name,
          p.last_name,
          p.email,
          p.avatar_url,
          COALESCE(p.is_verified, false) AS is_verified,
          p.referral_code,
          COALESCE(p.referral_count, 0) AS referral_count
        FROM public.subscriptions s
        LEFT JOIN public.profiles p ON s.user_id = p.id
        ${statusFilter}
        ORDER BY s.created_at DESC
        LIMIT 100
      `;

      const res = await pool.query(sql, params);
      return res.rows;
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        subscriptions: directResult,
      });
    }

    // 2. Fallback: Supabase HTTPS
    let query = supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        profiles:user_id (
          username, first_name, last_name, email, avatar_url, is_verified, referral_code, referral_count
        )
      `)
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
      subscriptions: data || [],
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, subscriptionId, userId, notes } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing action or userId' },
        { status: 400 }
      );
    }

    const isApprove = action === 'APPROVE_SUBSCRIPTION';

    // 1. Direct Postgres
    await tryDirectQuery(async (pool) => {
      if (isApprove) {
        // Activate subscription
        await pool.query(
          `UPDATE public.subscriptions 
           SET status = 'active', is_active = true, updated_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        );

        // Activate verification
        await pool.query(
          `INSERT INTO public.user_verifications (
             user_id, badge_type, status, is_active, badge_label, verification_reason, verified_at, updated_at
           ) VALUES ($1, 'blue_tick', 'verified', true, 'Verified Creator', 'Approved ZEV Blue Subscription', NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET 
             status = 'verified',
             is_active = true,
             badge_label = 'Verified Creator',
             verification_reason = 'Approved ZEV Blue Subscription',
             verified_at = NOW(),
             updated_at = NOW()`,
          [userId]
        );

        // Update profile
        await pool.query(
          `UPDATE public.profiles SET is_verified = true, updated_at = NOW() WHERE id = $1`,
          [userId]
        );
      } else {
        // Cancel / Reject
        await pool.query(
          `UPDATE public.subscriptions 
           SET status = 'cancelled', is_active = false, updated_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        );
        await pool.query(
          `UPDATE public.user_verifications 
           SET status = 'revoked', is_active = false, updated_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        );
        await pool.query(
          `UPDATE public.profiles SET is_verified = false, updated_at = NOW() WHERE id = $1`,
          [userId]
        );
      }
    });

    // 2. Supabase HTTPS Sync
    if (isApprove) {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'active', is_active: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      await supabaseAdmin
        .from('user_verifications')
        .upsert({
          user_id: userId,
          badge_type: 'blue_tick',
          status: 'verified',
          is_active: true,
          badge_label: 'Verified Creator',
          verification_reason: 'Approved ZEV Blue Subscription',
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      await supabaseAdmin
        .from('profiles')
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq('id', userId);

      await supabaseAdmin.from('user_notifications').insert({
        user_id: userId,
        title: 'ZEV Blue Activated! ⭐',
        message: 'Your ZEV Blue subscription has been approved! The verified Blue Badge is now active on your profile.',
        notification_type: 'verification',
        app_source: 'zev',
        is_read: false,
      });
    } else {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      await supabaseAdmin
        .from('user_verifications')
        .update({ status: 'revoked', is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      await supabaseAdmin
        .from('profiles')
        .update({ is_verified: false, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return NextResponse.json({
      success: true,
      message: isApprove ? 'Subscription approved and Blue Badge granted!' : 'Subscription rejected',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error modifying subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}

