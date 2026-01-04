import { compare, hash } from "bcryptjs";
import { createClient } from "./supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { prisma, withRetry } from "./db/prisma";
import type { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  labelIds: string[];
  isActive: boolean;
}

// Bare Supabase client for API routes (token validation from header)
const bareSupabase = createBareClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Password hashing (kept for backward compatibility and local user table)
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

// Get current user from cookies (for server components)
// Uses SSR client which automatically reads Supabase session from cookies
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();

    // SSR client automatically reads session from cookies set by middleware
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

    if (error || !supabaseUser?.email) {
      return null;
    }

    // Get user profile from our table (with retry for reliability)
    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          labelIds: true,
          isActive: true,
        },
      })
    );

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Get user from API request (cookies or Authorization header)
 * This is the preferred method for API routes using unified cookie-based auth
 *
 * Priority:
 * 1. Supabase session from cookies
 * 2. Bearer token in Authorization header (fallback)
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  // First try cookies (primary method)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only for this use case
          },
        },
      }
    );

    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

    if (!error && supabaseUser?.email) {
      // Get user profile from our table (with retry)
      const user = await withRetry(() =>
        prisma.user.findUnique({
          where: { email: supabaseUser.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            labelIds: true,
            isActive: true,
          },
        })
      );

      if (user?.isActive) {
        return user;
      }
    }
  } catch (e) {
    console.error("[Auth] Cookie auth error:", e);
  }

  // Fallback to Authorization header (backward compatibility)
  const authHeader = request.headers.get("authorization");
  return getUserFromHeader(authHeader);
}

// Get user from Authorization header (for API routes)
// Uses bare client since API routes receive token in header, not cookies
export async function getUserFromHeader(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Supabase using bare client
    const { data: { user: supabaseUser }, error } = await bareSupabase.auth.getUser(token);

    if (error || !supabaseUser?.email) {
      return null;
    }

    // Get user profile from our table (with retry for reliability)
    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          labelIds: true,
          isActive: true,
        },
      })
    );

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

// Check if user has access to a label
export function hasLabelAccess(user: AuthUser, labelId: string): boolean {
  if (user.role === "ADMIN") return true;
  return user.labelIds.includes(labelId);
}
