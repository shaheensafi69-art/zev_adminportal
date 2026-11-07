import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDbPool } from '@/lib/db';

const COOKIE_NAME = 'zev_admin_session';
const DEFAULT_KEY = process.env.ADMIN_SECRET_KEY || 'zev2026admin';

export async function POST(request: NextRequest) {
  try {
    const { passkey, email, password } = await request.json();

    // 1. Direct Master Passkey authentication
    if (passkey && passkey.trim() === DEFAULT_KEY.trim()) {
      const response = NextResponse.json({
        success: true,
        user: { role: 'super_admin', email: 'admin@zevapp.com', name: 'ZEV Chief Admin' },
      });
      response.cookies.set(COOKIE_NAME, 'authorized_zev_admin_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }

    // 2. Supabase Auth credential authentication
    if (email && password) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Check if user has admin role in profiles table
      const pool = getDbPool();
      const profileRes = await pool.query(
        `SELECT role, first_name, last_name FROM public.profiles WHERE id = $1`,
        [authData.user.id]
      );
      const role = profileRes.rows[0]?.role;

      if (role !== 'admin' && role !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Access denied: Admin role required' },
          { status: 403 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role,
          name: `${profileRes.rows[0]?.first_name || ''} ${profileRes.rows[0]?.last_name || ''}`.trim() || 'Admin',
        },
      });

      response.cookies.set(COOKIE_NAME, `auth_user_${authData.user.id}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid access key or credentials' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
