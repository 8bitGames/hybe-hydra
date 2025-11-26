import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";

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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.hashedPassword);
    if (!isValid) {
      return NextResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if active
    if (!user.isActive) {
      return NextResponse.json(
        { detail: "Account is deactivated" },
        { status: 401 }
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
