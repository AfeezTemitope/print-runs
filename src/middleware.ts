import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_AREA = /^\/admin(\/|$)/;
const PRINTER_AREA = /^\/dashboard(\/|$)/;
const CUSTOMER_AREA = /^\/(orders|track|checkout)(\/|$)/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAdmin = ADMIN_AREA.test(pathname);
  const needsPrinter = PRINTER_AREA.test(pathname);
  const needsAuth = needsAdmin || needsPrinter || CUSTOMER_AREA.test(pathname);
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get('pr_session')?.value;
  const login = new URL('/login', req.url);
  login.searchParams.set('next', pathname + req.nextUrl.search);

  if (!token) return NextResponse.redirect(login);
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
    const role = payload.role as string;
    // Admins can see the printer dashboard for support purposes; printers can never see admin.
    if (needsAdmin && role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (needsPrinter && role !== 'printer' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/orders/:path*', '/track', '/checkout/:path*'],
};
