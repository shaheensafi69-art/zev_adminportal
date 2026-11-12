import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_COOKIE_NAME = 'zev_admin_session';

export interface VerifiedAdminSession {
  keyId: number;
  name: string;
  token: string;
  timestamp: number;
  sig: string;
}

function getSigningSecret(): string | null {
  const rawSecret =
    process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawSecret || !rawSecret.trim()) {
    return null;
  }
  return crypto
    .createHmac('sha256', 'zev-admin-session-key-v1')
    .update(rawSecret.trim())
    .digest('hex');
}

function computeSig(
  secret: string,
  keyId: number,
  name: string,
  token: string,
  timestamp: number
): string {
  const payload = `${keyId}|${name}|${token}|${timestamp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSignedAdminSession(keyId: number, name: string): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('Server signing secret (ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY) is not configured.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const sig = computeSig(secret, keyId, name, token, timestamp);
  return JSON.stringify({ keyId, name, token, timestamp, sig });
}

export function verifyAdminSessionValue(rawValue: string | undefined): {
  valid: boolean;
  admin?: { keyId: number; name: string };
} {
  if (!rawValue) return { valid: false };
  const secret = getSigningSecret();
  if (!secret) return { valid: false };

  try {
    const parsed = JSON.parse(rawValue) as Partial<VerifiedAdminSession>;
    if (
      typeof parsed.keyId !== 'number' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.sig !== 'string'
    ) {
      return { valid: false };
    }

    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > maxAgeMs || parsed.timestamp > Date.now() + 60_000) {
      return { valid: false };
    }

    const expectedSig = computeSig(secret, parsed.keyId, parsed.name, parsed.token, parsed.timestamp);
    const sigBuf = Buffer.from(parsed.sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }

    return {
      valid: true,
      admin: {
        keyId: parsed.keyId,
        name: parsed.name,
      },
    };
  } catch {
    return { valid: false };
  }
}

export function requireAdminSession(
  request: NextRequest
):
  | { ok: true; admin: { keyId: number; name: string } }
  | { ok: false; response: NextResponse } {
  const cookieVal = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const verified = verifyAdminSessionValue(cookieVal);
  if (!verified.valid || !verified.admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized: Valid admin session key is required.' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, admin: verified.admin };
}
