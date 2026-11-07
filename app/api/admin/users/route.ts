import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tab = searchParams.get('tab') || 'all'; // all, verified, unverified, banned, unconfirmed
    const role = searchParams.get('role') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

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
    } else if (tab === 'banned') {
      conditions.push(`(u.banned_until IS NOT NULL AND u.banned_until > NOW())`);
    } else if (tab === 'unconfirmed') {
      conditions.push(`u.email_confirmed_at IS NULL`);
    }

    // Role filter
    if (role && role !== 'all') {
      values.push(role);
      conditions.push(`p.role = $${paramIndex}`);
      paramIndex++;
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
        p.father_name,
        p.username,
        p.phone_number,
        p.country,
        COALESCE(p.role::text, 'student') AS role,
        p.avatar_url,
        COALESCE(p.is_verified, false) AS is_verified,
        COALESCE(p.is_online, false) AS is_online,
        COALESCE(p.wallet_balance, 0)::float AS wallet_balance,
        COALESCE(p.total_score, 0)::int AS total_score,
        p.bio,
        COALESCE(p.created_at, u.created_at) AS created_at,
        p.last_seen_at AS last_seen,
        COALESCE(dp_count.cnt, 0)::int AS posts_count,
        COALESCE(reels_count.cnt, 0)::int AS reels_count,
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
          // Fallback direct SQL update to auth.users
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

      case 'UPDATE_ROLE': {
        const { role } = payload;
        const validRoles = ['student', 'teacher', 'admin', 'super_admin'];
        if (!validRoles.includes(role)) {
          return NextResponse.json(
            { success: false, error: 'Invalid role specified' },
            { status: 400 }
          );
        }

        await pool.query(
          `UPDATE public.profiles SET role = $1::user_role, updated_at = NOW() WHERE id = $2`,
          [role, userId]
        );

        return NextResponse.json({
          success: true,
          message: `User role updated to ${role}`,
        });
      }

      case 'UPDATE_PROFILE': {
        const { firstName, lastName, username, walletBalance, totalScore } = payload;
        await pool.query(
          `
          UPDATE public.profiles SET 
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            username = COALESCE($3, username),
            wallet_balance = COALESCE($4, wallet_balance),
            total_score = COALESCE($5, total_score),
            updated_at = NOW()
          WHERE id = $6
          `,
          [firstName, lastName, username, walletBalance, totalScore, userId]
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
