import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { tryDirectQuery } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  ADMIN_COOKIE_NAME,
  createSignedAdminSession,
  verifyAdminSessionValue,
} from '@/lib/adminAuth';

const COOKIE_NAME = ADMIN_COOKIE_NAME;

interface MasterKeyDescriptor {
  id: number;
  name: string;
  envVar: string;
}

// The 10 Cryptographic Master Keys for ZEV Administration
// Strictly loaded from backend environment variables with zero hardcoded secret fallbacks
const MASTER_KEY_SPECS: MasterKeyDescriptor[] = [
  { id: 1, name: 'Master Alpha Key (Primary Owner)', envVar: 'ADMIN_KEY_1' },
  { id: 2, name: 'Lead Bravo Key (Operations Lead)', envVar: 'ADMIN_KEY_2' },
  { id: 3, name: 'Security Charlie Key (Platform Safety)', envVar: 'ADMIN_KEY_3' },
  { id: 4, name: 'System Delta Key (Infrastructure)', envVar: 'ADMIN_KEY_4' },
  { id: 5, name: 'Command Echo Key (Executive Admin)', envVar: 'ADMIN_KEY_5' },
  { id: 6, name: 'Root Foxtrot Key (Root Administrator)', envVar: 'ADMIN_KEY_6' },
  { id: 7, name: 'Vault Golf Key (Emergency Console)', envVar: 'ADMIN_KEY_7' },
  { id: 8, name: 'Shield Hotel Key (Moderation Officer)', envVar: 'ADMIN_KEY_8' },
  { id: 9, name: 'Security India Key (Compliance & Audit)', envVar: 'ADMIN_KEY_9' },
  { id: 10, name: 'Console Juliet Key (Technical Director)', envVar: 'ADMIN_KEY_10' },
];

const authAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAttempts = 12;
  const recent = (authAttempts.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxAttempts) {
    authAttempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  authAttempts.set(ip, recent);
  return false;
}

function getConfiguredMasterKeys(): Array<{ id: number; name: string; key: string }> {
  const loaded: Array<{ id: number; name: string; key: string }> = [];
  for (const spec of MASTER_KEY_SPECS) {
    const val = process.env[spec.envVar]?.trim();
    if (val && val.length >= 16) {
      loaded.push({ id: spec.id, name: spec.name, key: val });
    }
  }
  return loaded;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCheck(userInput: string, targetKey: string): boolean {
  if (!userInput || !targetKey) return false;
  const hashUser = crypto.createHash('sha256').update(userInput.trim()).digest();
  const hashTarget = crypto.createHash('sha256').update(targetKey.trim()).digest();
  return crypto.timingSafeEqual(hashUser, hashTarget);
}

async function writeAuthAuditLog(params: {
  action: string;
  adminId?: string | null;
  ip: string;
  details: Record<string, unknown>;
}) {
  const directOk = await tryDirectQuery(async (pool) => {
    await pool.query(
      `INSERT INTO public.admin_audit_logs (action, admin_id, ip_address, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [params.action, params.adminId ?? null, params.ip, JSON.stringify(params.details)]
    );
    return true;
  });

  if (!directOk) {
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        action: params.action,
        admin_id: params.adminId ?? null,
        ip_address: params.ip,
        details: params.details,
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore audit log transport failure
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Client';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many authentication attempts. Please wait a few minutes and try again.',
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { passkey, email, password } = body;

    // 1. REJECT standard email/password user authentication entirely
    if (email || password) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Direct Master Cryptographic Key is required. Standard app accounts are strictly forbidden on this portal.',
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

    const configuredKeys = getConfiguredMasterKeys();
    if (configuredKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin master keys are not configured in server environment variables.',
        },
        { status: 503 }
      );
    }

    // 2. Validate against all configured Backend Master Keys without early-exit timing leak
    let matchedKey: { id: number; name: string; key: string } | null = null;
    for (const candidate of configuredKeys) {
      if (timingSafeCheck(passkey, candidate.key)) {
        matchedKey = candidate;
      }
    }

    if (!matchedKey) {
      await writeAuthAuditLog({
        action: 'FAILED_KEY_LOGIN_ATTEMPT',
        ip,
        details: { ip, userAgent, attemptedKeyLength: passkey.length },
      });

      return NextResponse.json(
        { success: false, error: 'Invalid or unauthorized Admin Master Key. Access Denied.' },
        { status: 401 }
      );
    }

    // 3. Successful Master Key Authentication
    const cookiePayload = createSignedAdminSession(matchedKey.id, matchedKey.name);

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

    await writeAuthAuditLog({
      action: 'ADMIN_MASTER_KEY_LOGIN',
      adminId: matchedKey.name,
      ip,
      details: { keyId: matchedKey.id, keyName: matchedKey.name, userAgent },
    });

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
  const verified = verifyAdminSessionValue(sessionCookie?.value);
  if (!verified.valid || !verified.admin) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    admin: {
      name: verified.admin.name || 'ZEV Administrator',
      keyId: verified.admin.keyId,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Admin logged out' });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
