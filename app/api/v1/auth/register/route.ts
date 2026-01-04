import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma, withRetry } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth";

// Create Supabase admin client for user creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  let supabaseUserId: string | null = null;

  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { detail: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user exists in our table (with retry)
    const existingUser = await withRetry(() =>
      prisma.user.findUnique({
        where: { email },
      })
    );

    if (existingUser) {
      return NextResponse.json(
        { detail: "Email already registered" },
        { status: 400 }
      );
    }

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "VIEWER",
      },
    });

    if (authError) {
      console.error("[Register] Supabase Auth error:", authError);
      return NextResponse.json(
        { detail: authError.message || "Failed to create account" },
        { status: 400 }
      );
    }

    // Store Supabase user ID for potential rollback
    supabaseUserId = authData.user.id;

    // Step 2: Create user in Prisma (with retry for transient failures)
    const hashedPassword = await hashPassword(password);

    const user = await withRetry(
      () =>
        prisma.user.create({
          data: {
            email,
            name,
            hashedPassword,
            role: "VIEWER",
            labelIds: [],
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        }),
      { maxRetries: 3 }
    );

    console.log("[Register] User created successfully:", { email, userId: user.id });

    return NextResponse.json(
      {
        ...user,
        supabase_user_id: authData.user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register] Error:", error);

    // Rollback: Delete Supabase user if Prisma creation failed
    if (supabaseUserId) {
      console.log("[Register] Rolling back Supabase user:", supabaseUserId);
      try {
        await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
        console.log("[Register] Supabase user rolled back successfully");
      } catch (rollbackError) {
        console.error("[Register] Failed to rollback Supabase user:", rollbackError);
      }
    }

    return NextResponse.json(
      { detail: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
