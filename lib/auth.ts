import { compare, hash } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { prisma } from "./db/prisma";
import type { User, UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  labelIds: string[];
  isActive: boolean;
}

// Create Supabase client for token verification
const supabase = createClient(
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
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) {
      return null;
    }

    // Verify token with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);

    if (error || !supabaseUser?.email) {
      return null;
    }

    // Get user profile from our table
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email },
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
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

// Get user from Authorization header (for API routes)
export async function getUserFromHeader(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser?.email) {
      return null;
    }

    // Get user profile from our table (for role, labelIds)
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email },
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
