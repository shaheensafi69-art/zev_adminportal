import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyAdminSessionValue } from '@/lib/adminAuth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/admin/auth') {
    return NextResponse.next();
  }

  const cookieVal = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const verified = verifyAdminSessionValue(cookieVal);

  if (!verified.valid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Valid Admin Master Key session required.' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
