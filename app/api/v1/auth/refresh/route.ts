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
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { detail: "Refresh token is required" },
        { status: 400 }
      );
    }

    // Refresh session with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (authError || !authData.session) {
      return NextResponse.json(
        { detail: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Get user profile from our table
    const user = await prisma.user.findUnique({
      where: { email: authData.user?.email || "" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        labelIds: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { detail: "User not found or inactive" },
        { status: 401 }
      );
    }

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
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
