import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
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

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { detail: "Email already registered" },
        { status: 400 }
      );
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
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
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
