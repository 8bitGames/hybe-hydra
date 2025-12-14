import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";

// Create Supabase client for auth operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // Return Supabase tokens along with user profile
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
