import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const COOKIE_NAME = 'zev_admin_session';
const DEFAULT_KEY = process.env.ADMIN_SECRET_KEY || 'zev2026admin';

export async function POST(request: NextRequest) {
  try {
    const { passkey, email, password } = await request.json();

    // 1. Direct Master Passkey authentication
    if (passkey && passkey.trim() === DEFAULT_KEY.trim()) {
      const response = NextResponse.json({
        success: true,
        user: { email: 'admin@zevapp.com', name: 'ZEV Administrator' },
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

      const response = NextResponse.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: 'Administrator',
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
