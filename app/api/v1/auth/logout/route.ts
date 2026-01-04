import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { invalidateUserCache } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    // Create response object to clear cookies
    let response = NextResponse.json({ success: true });

    // Create Supabase SSR client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user before signing out (for cache invalidation)
    const { data: { user } } = await supabase.auth.getUser();

    // Sign out from Supabase (this clears the session cookies)
    await supabase.auth.signOut();

    // Invalidate user cache if we had a user
    if (user?.id) {
      await invalidateUserCache(user.id).catch(() => {
        // Ignore cache errors during logout
      });
    }

    // Clear all auth-related cookies explicitly
    const cookieNames = request.cookies.getAll().map(c => c.name);
    const authCookies = cookieNames.filter(
      name => name.startsWith('sb-') || name.includes('supabase')
    );

    authCookies.forEach(name => {
      response.cookies.set(name, '', {
        maxAge: 0,
        path: '/',
      });
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success - user will be logged out on client side
    return NextResponse.json({ success: true });
  }
}
