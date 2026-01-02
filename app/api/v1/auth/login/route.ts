import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password are required" },
        { status: 400 }
      );
    }

    // Create response object first so we can set cookies on it
    let response = NextResponse.json({});

    // Create Supabase client with cookie handling
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

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return NextResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get user profile from our users table (for role, labelIds, etc.)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        labelIds: true,
        isActive: true,
      },
    });

    // Check if user exists in our table and is active
    if (!user) {
      return NextResponse.json(
        { detail: "User profile not found" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { detail: "Account is deactivated" },
        { status: 401 }
      );
    }

    // Create the final response with user data and cookies
    const responseData = {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      token_type: "bearer",
      expires_in: authData.session.expires_in,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        label_ids: user.labelIds,
      },
    };

    // Create new response with the data but preserve cookies
    const finalResponse = NextResponse.json(responseData);

    // Copy cookies from the response object that Supabase set
    // Set long expiry for persistent login (30 days)
    const cookieMaxAge = 30 * 24 * 60 * 60; // 30 days in seconds

    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
        // Ensure cookies are accessible
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: cookieMaxAge,
      });
    });

    return finalResponse;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
