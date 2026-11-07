import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const tab = searchParams.get('tab') || 'all'; // all, verified, unverified, banned, unconfirmed
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  try {

    const pool = getDbPool();

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

    return NextResponse.json({
      success: true,
      users: dataRes.rows,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
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

    const pool = getDbPool();

    switch (action) {
      case 'TOGGLE_BLUE_TICK': {
        const { isVerified, badgeLabel = 'Verified Official', reason = 'Official accreditation by ZEV Admin Team' } = payload;
        const newStatus = Boolean(isVerified);

        // 1. Update profiles table
        await pool.query(
          `UPDATE public.profiles SET is_verified = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, userId]
        );

        if (newStatus) {
          // 2. Insert or update verification in user_verifications
          await pool.query(
            `
            INSERT INTO public.user_verifications (
              user_id, badge_type, status, is_active, badge_label, verification_reason, verified_at, updated_at
            ) VALUES ($1, 'blue_tick', 'verified', true, $2, $3, NOW(), NOW())
            `,
            [userId, badgeLabel, reason]
          );

          // 3. Send in-app notification in English
          try {
            await pool.query(
              `
              INSERT INTO public.user_notifications (
                user_id, title, message, notification_type, app_source, is_read, created_at
              ) VALUES (
                $1,
                'Official Verification Badge Granted ⭐',
                'Congratulations! Your ZEV account has been officially verified with the Blue Badge.',
                'verification',
                'zev',
                false,
                NOW()
              )
              `,
              [userId]
            );
          } catch (notifErr) {
            console.warn('Failed to insert notification:', notifErr);
          }
        } else {
          // Deactivate any active verification
          await pool.query(
            `
            UPDATE public.user_verifications 
            SET is_active = false, status = 'revoked', updated_at = NOW()
            WHERE user_id = $1
            `,
            [userId]
          );
        }

        return NextResponse.json({
          success: true,
          message: newStatus ? 'Official Blue Badge granted' : 'Blue Badge revoked',
          is_verified: newStatus,
        });
      }

      case 'CONFIRM_EMAIL': {
        // Confirm user in Supabase Auth
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });

        if (authErr) {
          await pool.query(
            `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()), confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = $1`,
            [userId]
          );
        }

        return NextResponse.json({
          success: true,
          message: 'User email confirmed successfully',
        });
      }

      case 'BAN_USER': {
        const { durationHours = 876000, reason = 'Violating community guidelines' } = payload;
        
        // Supabase Auth ban
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: `${durationHours}h`,
        });

        if (banErr) {
          await pool.query(
            `UPDATE auth.users SET banned_until = NOW() + ($2 || ' hours')::interval WHERE id = $1`,
            [userId, durationHours]
          );
        }

        // Send notification about restriction
        try {
          await pool.query(
            `
            INSERT INTO public.user_notifications (
              user_id, title, message, notification_type, app_source, is_read, created_at
            ) VALUES (
              $1,
              'Account Suspended ⚠️',
              $2,
              'security_alert',
              'zev',
              false,
              NOW()
            )
            `,
            [userId, `Your ZEV account has been restricted. Reason: ${reason}`]
          );
        } catch {
          // Ignore notification error
        }

        return NextResponse.json({
          success: true,
          message: 'User account has been banned',
        });
      }

      case 'WARN_USER': {
        const { reason = 'Violation of community policies', details = '', warningLevel = 1 } = payload;
        
        // 1. Update warning count on profiles
        await pool.query(
          `
          UPDATE public.profiles SET 
            warning_count = COALESCE(warning_count, 0) + 1,
            last_warning_at = NOW(),
            last_warning_reason = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [reason, userId]
        );

        // 2. Insert into user_restrictions table as WARNING
        await pool.query(
          `
          INSERT INTO public.user_restrictions (
            user_id, type, warning_level, reason, details, status, created_at
          ) VALUES ($1, 'WARNING', $2, $3, $4, 'active', NOW())
          `,
          [userId, warningLevel, reason, details]
        );

        // 3. Dispatch in-app warning notification
        try {
          await pool.query(
            `
            INSERT INTO public.user_notifications (
              user_id, title, message, notification_type, app_source, is_read, created_at
            ) VALUES (
              $1,
              '⚠️ Official Policy Notice (Strike #' || $2 || ')',
              'Your account has received a warning for violating ZEV Community Guidelines: ' || $3 || '. Please maintain respectful interactions to prevent temporary restriction or ban.',
              'policy_warning',
              'zev',
              false,
              NOW()
            )
            `,
            [userId, warningLevel, reason]
          );
        } catch (notifErr) {
          console.warn('Notification insert error:', notifErr);
        }

        // 4. Log to admin audit trail
        try {
          await pool.query(
            `
            INSERT INTO public.admin_audit_logs (
              action, target_user_id, details, created_at
            ) VALUES ('WARN_USER', $1, $2, NOW())
            `,
            [userId, JSON.stringify({ reason, warningLevel, details })]
          );
        } catch {
          // ignore audit err
        }

        return NextResponse.json({
          success: true,
          message: `Official Policy Warning #${warningLevel} dispatched to user`,
        });
      }

      case 'RESTRICT_USER': {
        const { reason = 'Violation of community guidelines', durationHours = 72, details = '' } = payload;
        const durationInterval = durationHours ? `${durationHours} hours` : null;

        // 1. Update profile restriction state
        await pool.query(
          `
          UPDATE public.profiles SET 
            is_restricted = TRUE,
            restricted_until = ${durationInterval ? `NOW() + interval '${durationInterval}'` : 'NULL'},
            restriction_reason = $1,
            warning_count = COALESCE(warning_count, 0) + 1,
            last_warning_at = NOW(),
            last_warning_reason = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [reason, userId]
        );

        // 2. Insert record in user_restrictions
        await pool.query(
          `
          INSERT INTO public.user_restrictions (
            user_id, type, warning_level, reason, details, duration_hours, expires_at, status, created_at
          ) VALUES (
            $1, 'RESTRICTION', 2, $2, $3, $4, 
            ${durationInterval ? `NOW() + interval '${durationInterval}'` : 'NULL'}, 
            'active', NOW()
          )
          `,
          [userId, reason, details, durationHours || null]
        );

        // 3. Dispatch in-app restriction notice
        try {
          await pool.query(
            `
            INSERT INTO public.user_notifications (
              user_id, title, message, notification_type, app_source, is_read, created_at
            ) VALUES (
              $1,
              'Account Restriction Notice 🚫',
              'Your ZEV account has been temporarily restricted due to policy violation: ' || $2 || '. Certain features are limited until review.',
              'account_restricted',
              'zev',
              false,
              NOW()
            )
            `,
            [userId, reason]
          );
        } catch (notifErr) {
          console.warn('Notification insert error:', notifErr);
        }

        // 4. Log to admin audit trail
        try {
          await pool.query(
            `
            INSERT INTO public.admin_audit_logs (
              action, target_user_id, details, created_at
            ) VALUES ('RESTRICT_USER', $1, $2, NOW())
            `,
            [userId, JSON.stringify({ reason, durationHours, details })]
          );
        } catch {
          // ignore audit err
        }

        return NextResponse.json({
          success: true,
          message: 'User account has been placed under restriction',
        });
      }

      case 'UNRESTRICT_USER': {
        // 1. Lift restriction on profile
        await pool.query(
          `
          UPDATE public.profiles SET 
            is_restricted = FALSE,
            restricted_until = NULL,
            restriction_reason = NULL,
            updated_at = NOW()
          WHERE id = $1
          `,
          [userId]
        );

        // 2. Update active restrictions
        await pool.query(
          `
          UPDATE public.user_restrictions 
          SET status = 'lifted' 
          WHERE user_id = $1 AND status = 'active'
          `,
          [userId]
        );

        // 3. Dispatch lift notification
        try {
          await pool.query(
            `
            INSERT INTO public.user_notifications (
              user_id, title, message, notification_type, app_source, is_read, created_at
            ) VALUES (
              $1,
              'Account Restriction Lifted ✅',
              'Your account restrictions have been cleared. Full access to all ZEV features has been restored.',
              'policy_resolved',
              'zev',
              false,
              NOW()
            )
            `,
            [userId]
          );
        } catch {
          // ignore
        }

        // 4. Audit log
        try {
          await pool.query(
            `
            INSERT INTO public.admin_audit_logs (
              action, target_user_id, details, created_at
            ) VALUES ('UNRESTRICT_USER', $1, '{}'::jsonb, NOW())
            `,
            [userId]
          );
        } catch {
          // ignore
        }

        return NextResponse.json({
          success: true,
          message: 'Account restriction lifted successfully',
        });
      }

      case 'UNBAN_USER': {
        // Supabase Auth unban
        const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        if (unbanErr) {
          await pool.query(`UPDATE auth.users SET banned_until = NULL WHERE id = $1`, [userId]);
        }

        return NextResponse.json({
          success: true,
          message: 'User suspension has been lifted',
        });
      }

      case 'DELETE_USER': {
        // 1. Delete user from Supabase Auth
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        // 2. Cascade cleanup in public tables if needed
        await pool.query(`DELETE FROM public.user_verifications WHERE user_id = $1`, [userId]);
        await pool.query(`DELETE FROM public.user_notifications WHERE user_id = $1`, [userId]);
        await pool.query(`DELETE FROM public.profiles WHERE id = $1`, [userId]);

        if (delErr) {
          await pool.query(`UPDATE auth.users SET deleted_at = NOW() WHERE id = $1`, [userId]);
        }

        return NextResponse.json({
          success: true,
          message: 'User and associated data permanently deleted',
        });
      }

      case 'UPDATE_PROFILE': {
        const { firstName, lastName, username } = payload;
        await pool.query(
          `
          UPDATE public.profiles SET 
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            username = COALESCE($3, username),
            updated_at = NOW()
          WHERE id = $4
          `,
          [firstName, lastName, username, userId]
        );

        return NextResponse.json({
          success: true,
          message: 'User profile updated successfully',
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
