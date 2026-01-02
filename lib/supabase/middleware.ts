import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 30 days in seconds for cookie expiry
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: COOKIE_MAX_AGE,
            })
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Refreshes session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/register');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isPublicRoute = request.nextUrl.pathname === '/' ||
                        request.nextUrl.pathname.startsWith('/_next') ||
                        request.nextUrl.pathname.startsWith('/favicon');

  // Allow API routes to handle their own auth
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Allow public routes
  if (isPublicRoute) {
    return supabaseResponse;
  }

  // NOTE: Disabled middleware redirects - client-side auth-store handles auth
  // The app uses custom JWT auth in localStorage, not Supabase auth cookies
  // Middleware Supabase session and client auth-store can get out of sync
  // causing infinite redirect loops. Let client handle all auth redirects.

  // if (user && isAuthRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/trend-dashboard';
  //   return NextResponse.redirect(url);
  // }
  // if (!user && !isAuthRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}
