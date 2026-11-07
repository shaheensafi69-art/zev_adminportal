import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';

const COOKIE_NAME = 'zev_admin_session';

// The 10 Cryptographic Master Keys for ZEV Administration
// These are loaded from secure backend environment variables
const MASTER_KEYS = [
  { id: 1, name: 'Master Alpha Key (Primary Owner)', key: process.env.ADMIN_KEY_1 || 'ZEV-KEY-ALPHA-78942-MASTER' },
  { id: 2, name: 'Lead Bravo Key (Operations Lead)', key: process.env.ADMIN_KEY_2 || 'ZEV-KEY-BRAVO-31895-LEAD' },
  { id: 3, name: 'Security Charlie Key (Platform Safety)', key: process.env.ADMIN_KEY_3 || 'ZEV-KEY-CHARLIE-64210-SECURE' },
  { id: 4, name: 'System Delta Key (Infrastructure)', key: process.env.ADMIN_KEY_4 || 'ZEV-KEY-DELTA-98521-SYSTEM' },
  { id: 5, name: 'Command Echo Key (Executive Admin)', key: process.env.ADMIN_KEY_5 || 'ZEV-KEY-ECHO-12743-COMMAND' },
  { id: 6, name: 'Root Foxtrot Key (Root Administrator)', key: process.env.ADMIN_KEY_6 || 'ZEV-KEY-FOXTROT-53908-ROOT' },
  { id: 7, name: 'Vault Golf Key (Emergency Console)', key: process.env.ADMIN_KEY_7 || 'ZEV-KEY-GOLF-47129-VAULT' },
  { id: 8, name: 'Shield Hotel Key (Moderation Officer)', key: process.env.ADMIN_KEY_8 || 'ZEV-KEY-HOTEL-86304-SHIELD' },
  { id: 9, name: 'Security India Key (Compliance & Audit)', key: process.env.ADMIN_KEY_9 || 'ZEV-KEY-INDIA-29471-SECURITY' },
  { id: 10, name: 'Console Juliet Key (Technical Director)', key: process.env.ADMIN_KEY_10 || 'ZEV-KEY-JULIET-60582-CONSOLE' },
  // Legacy / fallback key
  { id: 0, name: 'Master Passkey (Legacy)', key: process.env.ADMIN_SECRET_KEY || 'zev2026admin' },
];

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCheck(userInput: string, targetKey: string): boolean {
  if (!userInput || !targetKey) return false;
  const hashUser = crypto.createHash('sha256').update(userInput.trim()).digest();
  const hashTarget = crypto.createHash('sha256').update(targetKey.trim()).digest();
  return crypto.timingSafeEqual(hashUser, hashTarget);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passkey, email, password } = body;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Client';

    // 1. REJECT standard email/password user authentication entirely
    if (email || password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Direct Master Cryptographic Key is required. Standard app accounts are strictly forbidden on this portal.' 
        },
        { status: 403 }
      );
    }

    if (!passkey || typeof passkey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid Admin Master Access Key.' },
        { status: 400 }
      );
    }

    // 2. Validate against the 10 Authorized Backend Master Keys
    const matchedKey = MASTER_KEYS.find((k) => timingSafeCheck(passkey, k.key));

    const pool = getDbPool();

    if (!matchedKey) {
      // Record failed attempt in audit logs
      try {
        await pool.query(
          `INSERT INTO public.admin_audit_logs (action, ip_address, details, created_at)
           VALUES ('FAILED_KEY_LOGIN_ATTEMPT', $1, $2, NOW())`,
          [ip, JSON.stringify({ ip, userAgent, attemptedKeyLength: passkey.length })]
        );
      } catch {
        // ignore log error
      }

      return NextResponse.json(
        { success: false, error: 'Invalid or unauthorized Admin Master Key. Access Denied.' },
        { status: 401 }
      );
    }

    // 3. Successful Master Key Authentication
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const cookiePayload = JSON.stringify({
      keyId: matchedKey.id,
      name: matchedKey.name,
      token: sessionToken,
      timestamp: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      message: 'Cryptographic Key Authenticated Successfully',
      admin: {
        keyId: matchedKey.id,
        name: matchedKey.name,
        role: 'Super Administrator',
      },
    });

    // Set secure, HttpOnly cookie with 7-day expiration
    response.cookies.set(COOKIE_NAME, cookiePayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Record successful audit event
    try {
      await pool.query(
        `INSERT INTO public.admin_audit_logs (action, admin_id, ip_address, details, created_at)
         VALUES ('ADMIN_MASTER_KEY_LOGIN', $1, $2, $3, NOW())`,
        [matchedKey.name, ip, JSON.stringify({ keyId: matchedKey.id, keyName: matchedKey.name, userAgent })]
      );
    } catch {
      // ignore
    }

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Authentication Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication system error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const parsed = JSON.parse(sessionCookie.value);
    if (!parsed || !parsed.token) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        name: parsed.name || 'ZEV Administrator',
        keyId: parsed.keyId,
      },
    });
  } catch {
    // If legacy simple cookie exists
    return NextResponse.json({ authenticated: true });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Admin logged out' });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
