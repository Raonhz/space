import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt'];

function getLocale(request: NextRequest) {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return 'en';
  
  const match = acceptLanguage.match(/^[a-z]{2}/);
  let locale = match ? match[0] : 'en';
  
  // map some common ones
  if (locale === 'kr') locale = 'ko';
  if (locale === 'jp') locale = 'ja';
  
  if (locales.includes(locale)) return locale;
  return 'en';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/assets') || 
    pathname.startsWith('/music') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Handle old route migration
  if (pathname === '/kr') {
    request.nextUrl.pathname = `/ko`;
    return NextResponse.redirect(request.nextUrl);
  }
  if (pathname === '/jp') {
    request.nextUrl.pathname = `/ja`;
    return NextResponse.redirect(request.nextUrl);
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    const locale = pathname.split('/')[1];
    const response = NextResponse.next();
    response.headers.set('x-locale', locale);
    return response;
  }

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    '/((?!_next|api|assets|music|.*\\..*).*)',
  ],
};
