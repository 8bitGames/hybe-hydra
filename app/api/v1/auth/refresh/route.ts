import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken, generateAccessToken, generateRefreshToken } from "@/lib/auth";

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

    // Verify refresh token
    const payload = verifyToken(refresh_token);
    if (!payload) {
      return NextResponse.json(
        { detail: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { detail: "User not found or inactive" },
        { status: 401 }
      );
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
