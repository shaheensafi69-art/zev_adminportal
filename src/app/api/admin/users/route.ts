import { NextRequest, NextResponse } from 'next/server';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const tab = searchParams.get('tab') || 'all'; // all, verified, unverified, restricted, banned, unconfirmed
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  try {
    // 1. Try Direct PostgreSQL query first
    const directResult = await tryDirectQuery(async (pool) => {
      const conditions: string[] = ['u.deleted_at IS NULL'];
      const values: (string | number | boolean)[] = [];
      let paramIndex = 1;

      // Search filter
      if (search.trim()) {
        values.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`(
          LOWER(u.email) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.username, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.first_name, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.last_name, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(p.phone_number, '')) LIKE $${paramIndex} OR
          u.id::text LIKE $${paramIndex}
        )`);
        paramIndex++;
      }

      // Tab filter
      if (tab === 'verified') {
        conditions.push(`p.is_verified = true`);
      } else if (tab === 'pending_verification') {
        conditions.push(`EXISTS (SELECT 1 FROM public.user_verifications uv WHERE uv.user_id = u.id AND uv.status = 'pending')`);
      } else if (tab === 'unverified') {
        conditions.push(`(p.is_verified IS NULL OR p.is_verified = false)`);
      } else if (tab === 'restricted') {
        conditions.push(`p.is_restricted = true`);
      } else if (tab === 'banned') {
        conditions.push(`(u.banned_until IS NOT NULL AND u.banned_until > NOW())`);
      } else if (tab === 'unconfirmed') {
        conditions.push(`u.email_confirmed_at IS NULL`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total Count Query
      const countSql = `
        SELECT COUNT(*) AS total
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        ${whereClause}
      `;
      const countRes = await pool.query(countSql, values);
      const totalUsers = parseInt(countRes.rows[0]?.total || '0', 10);

      // Data Query
      const querySql = `
        SELECT 
          u.id,
          u.email,
          (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
          u.email_confirmed_at,
          (u.banned_until IS NOT NULL AND u.banned_until > NOW()) AS is_banned,
          u.banned_until,
          u.created_at AS auth_created_at,
          p.first_name,
          p.last_name,
          p.username,
          p.phone_number,
          p.country,
          p.avatar_url,
          COALESCE(p.is_verified, false) AS is_verified,
          COALESCE(p.is_online, false) AS is_online,
          COALESCE(p.is_restricted, false) AS is_restricted,
          p.restricted_until,
          p.restriction_reason,
          COALESCE(p.warning_count, 0)::int AS warning_count,
          p.last_warning_at,
          p.last_warning_reason,
          p.bio,
          COALESCE(p.created_at, u.created_at) AS created_at,
          p.last_seen_at AS last_seen,
          COALESCE(dp_count.cnt, 0)::int AS posts_count,
          COALESCE(reels_count.cnt, 0)::int AS reels_count,
          COALESCE(followers_count.cnt, 0)::int AS followers_count,
          COALESCE(following_count.cnt, 0)::int AS following_count,
          COALESCE(stories_count.cnt, 0)::int AS stories_count,
          (
            SELECT row_to_json(uv_sub) FROM (
              SELECT uv.id, uv.user_id, uv.badge_type, uv.status, uv.is_active, uv.verification_reason, uv.badge_label, uv.verified_at, uv.created_at
              FROM public.user_verifications uv
              WHERE uv.user_id = u.id AND uv.is_active = true
              ORDER BY uv.created_at DESC
              LIMIT 1
            ) uv_sub
          ) AS verification_info
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN (
          SELECT student_id, COUNT(*) AS cnt 
          FROM public.discussion_posts 
          GROUP BY student_id
        ) dp_count ON dp_count.student_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt 
          FROM public.reels 
          GROUP BY user_id
        ) reels_count ON reels_count.user_id = u.id
        LEFT JOIN (
          SELECT following_id, COUNT(*) AS cnt 
          FROM public.user_follows 
          GROUP BY following_id
        ) followers_count ON followers_count.following_id = u.id
        LEFT JOIN (
          SELECT follower_id, COUNT(*) AS cnt 
          FROM public.user_follows 
          GROUP BY follower_id
        ) following_count ON following_count.follower_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt 
          FROM public.user_stories 
          GROUP BY user_id
        ) stories_count ON stories_count.user_id = u.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const dataRes = await pool.query(querySql, values);

      return {
        users: dataRes.rows,
        total: totalUsers,
      };
    });

    if (directResult) {
      return NextResponse.json({
        success: true,
        source: 'direct_postgres',
        users: directResult.users,
        pagination: {
          page,
          limit,
          total: directResult.total,
          totalPages: Math.ceil(directResult.total / limit),
        },
      });
    }

    // 2. Fallback: Supabase HTTPS Service Role (Guaranteed to work on Vercel/Hostinger/serverless)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw authErr;

    const authUsers = (authData?.users || []).filter((u) => !u.deleted_at);
    const userIds = authUsers.map((u) => u.id);

    const [profsRes, verifsRes, postsRes, reelsRes, followsRes, storiesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('user_verifications').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('discussion_posts').select('student_id'),
      supabaseAdmin.from('reels').select('user_id'),
      supabaseAdmin.from('user_follows').select('follower_id, following_id'),
      supabaseAdmin.from('user_stories').select('user_id'),
    ]);

    const profileMap = new Map((profsRes.data || []).map((p) => [p.id, p]));
    const verifMap = new Map((verifsRes.data || []).map((v) => [v.user_id, v]));

    // Counts mapping
    const postCounts = new Map<string, number>();
    (postsRes.data || []).forEach((r) => postCounts.set(r.student_id, (postCounts.get(r.student_id) || 0) + 1));

    const reelCounts = new Map<string, number>();
    (reelsRes.data || []).forEach((r) => reelCounts.set(r.user_id, (reelCounts.get(r.user_id) || 0) + 1));

    const followerCounts = new Map<string, number>();
    const followingCounts = new Map<string, number>();
    (followsRes.data || []).forEach((r) => {
      followerCounts.set(r.following_id, (followerCounts.get(r.following_id) || 0) + 1);
      followingCounts.set(r.follower_id, (followingCounts.get(r.follower_id) || 0) + 1);
    });

    const storyCounts = new Map<string, number>();
    (storiesRes.data || []).forEach((r) => storyCounts.set(r.user_id, (storyCounts.get(r.user_id) || 0) + 1));

    const now = new Date();

    let merged = authUsers.map((u) => {
      const p = profileMap.get(u.id) || {};
      const v = verifMap.get(u.id) || null;
      const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > now);

      return {
        id: u.id,
        email: u.email || '',
        email_confirmed: Boolean(u.email_confirmed_at),
        email_confirmed_at: u.email_confirmed_at || null,
        is_banned: isBanned,
        banned_until: u.banned_until || null,
        auth_created_at: u.created_at,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        username: p.username || null,
        phone_number: p.phone_number || null,
        country: p.country || null,
        avatar_url: p.avatar_url || null,
        is_verified: Boolean(p.is_verified),
        is_online: Boolean(p.is_online),
        is_restricted: Boolean(p.is_restricted),
        restricted_until: p.restricted_until || null,
        restriction_reason: p.restriction_reason || null,
        warning_count: p.warning_count || 0,
        last_warning_at: p.last_warning_at || null,
        last_warning_reason: p.last_warning_reason || null,
        bio: p.bio || null,
        created_at: p.created_at || u.created_at,
        last_seen: p.last_seen_at || null,
        posts_count: postCounts.get(u.id) || 0,
        reels_count: reelCounts.get(u.id) || 0,
        followers_count: followerCounts.get(u.id) || 0,
        following_count: followingCounts.get(u.id) || 0,
        stories_count: storyCounts.get(u.id) || 0,
        verification_info: v,
      };
    });

    // Apply Search Filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter((u) =>
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.first_name && u.first_name.toLowerCase().includes(q)) ||
        (u.last_name && u.last_name.toLowerCase().includes(q)) ||
        (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
    }

    // Apply Tab Filter
    if (tab === 'verified') {
      merged = merged.filter((u) => u.is_verified);
    } else if (tab === 'pending_verification') {
      merged = merged.filter((u) => u.verification_info?.status === 'pending');
    } else if (tab === 'unverified') {
      merged = merged.filter((u) => !u.is_verified);
    } else if (tab === 'restricted') {
      merged = merged.filter((u) => u.is_restricted);
    } else if (tab === 'banned') {
      merged = merged.filter((u) => u.is_banned);
    } else if (tab === 'unconfirmed') {
      merged = merged.filter((u) => !u.email_confirmed);
    }

    // Sort by created_at DESC
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalUsers = merged.length;
    const paginatedUsers = merged.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      source: 'supabase_https_service_role',
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit) || 1,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, payload = {} } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Execute actions with dual-engine persistence (Direct Postgres + Supabase Service Role)
    switch (action) {
      case 'TOGGLE_BLUE_TICK': {
        const { isVerified, badgeLabel = 'Verified Official', reason = 'Official accreditation by ZEV Admin Team' } = payload;
        const newStatus = Boolean(isVerified);

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET is_verified = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, userId]
          );
          if (newStatus) {
            await pool.query(
              `INSERT INTO public.user_verifications (
                user_id, badge_type, status, is_active, badge_label, verification_reason, verified_at, updated_at
              ) VALUES ($1, 'blue_tick', 'verified', true, $2, $3, NOW(), NOW())`,
              [userId, badgeLabel, reason]
            );
          } else {
            await pool.query(
              `UPDATE public.user_verifications SET is_active = false, status = 'revoked', updated_at = NOW() WHERE user_id = $1`,
              [userId]
            );
          }
        });

        // 2. Supabase HTTPS Service Role Sync
        await supabaseAdmin.from('profiles').update({ is_verified: newStatus, updated_at: new Date().toISOString() }).eq('id', userId);
        if (newStatus) {
          await supabaseAdmin.from('user_verifications').upsert({
            user_id: userId,
            badge_type: 'blue_tick',
            status: 'verified',
            is_active: true,
            badge_label: badgeLabel,
            verification_reason: reason,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await supabaseAdmin.from('user_notifications').insert({
            user_id: userId,
            title: 'Official Verification Badge Granted ⭐',
            message: 'Congratulations! Your ZEV account has been officially verified with the Blue Badge.',
            notification_type: 'verification',
            app_source: 'zev',
            is_read: false,
          });
        } else {
          await supabaseAdmin.from('user_verifications').update({ is_active: false, status: 'revoked', updated_at: new Date().toISOString() }).eq('user_id', userId);
        }

        return NextResponse.json({
          success: true,
          message: newStatus ? 'Official Blue Badge granted' : 'Blue Badge revoked',
          is_verified: newStatus,
        });
      }

      case 'CONFIRM_EMAIL': {
        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE id = $1`,
            [userId]
          );
        });

        // 2. Supabase Auth API
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });

        return NextResponse.json({
          success: true,
          message: 'User email confirmed instantly in database',
        });
      }

      case 'BAN_USER': {
        const { durationHours = 876000, reason = 'Violating community guidelines' } = payload;

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE auth.users SET banned_until = NOW() + ($2 || ' hours')::interval WHERE id = $1`,
            [userId, durationHours]
          );
        });

        // 2. Supabase Auth API
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: `${durationHours}h`,
        });

        // 3. User notification
        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: 'Account Suspended ⚠️',
          message: `Your ZEV account has been suspended by administration. Reason: ${reason}`,
          notification_type: 'security_alert',
          app_source: 'zev',
          is_read: false,
        });

        return NextResponse.json({
          success: true,
          message: 'User account has been banned immediately in database',
        });
      }

      case 'WARN_USER': {
        const { reason = 'Violation of community policies', details = '', warningLevel = 1 } = payload;

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET 
              warning_count = COALESCE(warning_count, 0) + 1,
              last_warning_at = NOW(),
              last_warning_reason = $1,
              updated_at = NOW()
            WHERE id = $2`,
            [reason, userId]
          );
          await pool.query(
            `INSERT INTO public.user_restrictions (
              user_id, type, warning_level, reason, details, status, created_at
            ) VALUES ($1, 'WARNING', $2, $3, $4, 'active', NOW())`,
            [userId, warningLevel, reason, details]
          );
        });

        // 2. Supabase HTTPS Sync
        const { data: prof } = await supabaseAdmin.from('profiles').select('warning_count').eq('id', userId).single();
        const nextCount = (prof?.warning_count || 0) + 1;
        await supabaseAdmin.from('profiles').update({
          warning_count: nextCount,
          last_warning_at: new Date().toISOString(),
          last_warning_reason: reason,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        await supabaseAdmin.from('user_restrictions').insert({
          user_id: userId,
          type: 'WARNING',
          warning_level: warningLevel,
          reason,
          details,
          status: 'active',
          created_at: new Date().toISOString(),
        });

        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: `⚠️ Official Policy Notice (Strike #${warningLevel})`,
          message: `Your account has received a warning for violating ZEV Community Guidelines: ${reason}. Please maintain respectful interactions.`,
          notification_type: 'policy_warning',
          app_source: 'zev',
          is_read: false,
        });

        return NextResponse.json({
          success: true,
          message: `Official Policy Warning #${warningLevel} dispatched to user`,
        });
      }

      case 'RESTRICT_USER': {
        const { reason = 'Violation of community guidelines', durationHours = 72, details = '' } = payload;
        const expiresAt = durationHours ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString() : null;

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          const durationInterval = durationHours ? `${durationHours} hours` : null;
          await pool.query(
            `UPDATE public.profiles SET 
              is_restricted = TRUE,
              restricted_until = ${durationInterval ? `NOW() + interval '${durationInterval}'` : 'NULL'},
              restriction_reason = $1,
              warning_count = COALESCE(warning_count, 0) + 1,
              last_warning_at = NOW(),
              last_warning_reason = $1,
              updated_at = NOW()
            WHERE id = $2`,
            [reason, userId]
          );
          await pool.query(
            `INSERT INTO public.user_restrictions (
              user_id, type, warning_level, reason, details, duration_hours, expires_at, status, created_at
            ) VALUES (
              $1, 'RESTRICTION', 2, $2, $3, $4, 
              ${durationInterval ? `NOW() + interval '${durationInterval}'` : 'NULL'}, 
              'active', NOW()
            )`,
            [userId, reason, details, durationHours || null]
          );
        });

        // 2. Supabase HTTPS Sync
        const { data: prof } = await supabaseAdmin.from('profiles').select('warning_count').eq('id', userId).single();
        const nextCount = (prof?.warning_count || 0) + 1;
        await supabaseAdmin.from('profiles').update({
          is_restricted: true,
          restricted_until: expiresAt,
          restriction_reason: reason,
          warning_count: nextCount,
          last_warning_at: new Date().toISOString(),
          last_warning_reason: reason,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        await supabaseAdmin.from('user_restrictions').insert({
          user_id: userId,
          type: 'RESTRICTION',
          warning_level: 2,
          reason,
          details,
          duration_hours: durationHours || null,
          expires_at: expiresAt,
          status: 'active',
          created_at: new Date().toISOString(),
        });

        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: 'Account Restriction Notice 🚫',
          message: `Your ZEV account has been temporarily restricted due to policy violation: ${reason}. Certain features are limited until review.`,
          notification_type: 'account_restricted',
          app_source: 'zev',
          is_read: false,
        });

        return NextResponse.json({
          success: true,
          message: 'User account has been placed under restriction',
        });
      }

      case 'UNRESTRICT_USER': {
        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET 
              is_restricted = FALSE,
              restricted_until = NULL,
              restriction_reason = NULL,
              updated_at = NOW()
            WHERE id = $1`,
            [userId]
          );
          await pool.query(
            `UPDATE public.user_restrictions SET status = 'lifted' WHERE user_id = $1 AND status = 'active'`,
            [userId]
          );
        });

        // 2. Supabase HTTPS Sync
        await supabaseAdmin.from('profiles').update({
          is_restricted: false,
          restricted_until: null,
          restriction_reason: null,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        await supabaseAdmin.from('user_restrictions').update({ status: 'lifted' }).eq('user_id', userId).eq('status', 'active');

        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: 'Account Restriction Lifted ✅',
          message: 'Your account restrictions have been cleared. Full access to all ZEV features has been restored.',
          notification_type: 'policy_resolved',
          app_source: 'zev',
          is_read: false,
        });

        return NextResponse.json({
          success: true,
          message: 'Account restriction lifted successfully',
        });
      }

      case 'UNBAN_USER': {
        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(`UPDATE auth.users SET banned_until = NULL WHERE id = $1`, [userId]);
        });

        // 2. Supabase Auth API
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        // 3. Notification
        await supabaseAdmin.from('user_notifications').insert({
          user_id: userId,
          title: 'Account Suspension Lifted ✅',
          message: 'Your account suspension has been lifted by administration. Full access has been restored.',
          notification_type: 'security_alert',
          app_source: 'zev',
          is_read: false,
        });

        return NextResponse.json({
          success: true,
          message: 'User suspension has been lifted immediately in database',
        });
      }

      case 'DELETE_USER': {
        // 1. Try Direct Postgres Cascade Purge
        await tryDirectQuery(async (pool) => {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM public.discussion_likes WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.discussion_comments WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.discussion_posts WHERE student_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_likes WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_comments WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reel_views WHERE viewer_id = $1`, [userId]);
            await client.query(`DELETE FROM public.reels WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.story_views WHERE viewer_id = $1`, [userId]);
            await client.query(`DELETE FROM public.story_likes WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_stories WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_follows WHERE follower_id = $1 OR following_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_reports WHERE reporter_id = $1 OR reported_user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_verifications WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_restrictions WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.user_notifications WHERE user_id = $1 OR sender_id = $1`, [userId]);
            await client.query(`DELETE FROM public.push_subscriptions WHERE user_id = $1`, [userId]);
            await client.query(`DELETE FROM public.direct_messages WHERE sender_id = $1 OR receiver_id = $1`, [userId]);
            await client.query(`DELETE FROM public.chat_pins WHERE user_id = $1 OR peer_id = $1`, [userId]);
            await client.query(`DELETE FROM public.profiles WHERE id = $1`, [userId]);
            await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
            await client.query('COMMIT');
          } catch (delErr) {
            await client.query('ROLLBACK');
            throw delErr;
          } finally {
            client.release();
          }
        });

        // 2. Cascade cleanup via Supabase HTTPS Service Role
        await Promise.allSettled([
          supabaseAdmin.from('profiles').delete().eq('id', userId),
          supabaseAdmin.from('discussion_posts').delete().eq('student_id', userId),
          supabaseAdmin.from('reels').delete().eq('user_id', userId),
          supabaseAdmin.from('user_stories').delete().eq('user_id', userId),
          supabaseAdmin.from('user_verifications').delete().eq('user_id', userId),
          supabaseAdmin.from('user_restrictions').delete().eq('user_id', userId),
          supabaseAdmin.from('user_notifications').delete().eq('user_id', userId),
          supabaseAdmin.auth.admin.deleteUser(userId),
        ]);

        return NextResponse.json({
          success: true,
          message: 'User and all associated database records permanently purged',
        });
      }

      case 'UPDATE_PROFILE': {
        const { firstName, lastName, username, bio, phoneNumber, country } = payload;

        // 1. Direct Postgres
        await tryDirectQuery(async (pool) => {
          await pool.query(
            `UPDATE public.profiles SET 
              first_name = COALESCE($1, first_name),
              last_name = COALESCE($2, last_name),
              username = COALESCE($3, username),
              bio = COALESCE($4, bio),
              phone_number = COALESCE($5, phone_number),
              country = COALESCE($6, country),
              updated_at = NOW()
            WHERE id = $7`,
            [
              firstName !== undefined ? firstName : null,
              lastName !== undefined ? lastName : null,
              username !== undefined ? username : null,
              bio !== undefined ? bio : null,
              phoneNumber !== undefined ? phoneNumber : null,
              country !== undefined ? country : null,
              userId,
            ]
          );
        });

        // 2. Supabase HTTPS Sync
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (firstName !== undefined) updateData.first_name = firstName;
        if (lastName !== undefined) updateData.last_name = lastName;
        if (username !== undefined) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
        if (country !== undefined) updateData.country = country;

        await supabaseAdmin.from('profiles').update(updateData).eq('id', userId);
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            username: username,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'User profile updated instantly in database',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling user action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
