import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get full user data
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        labelIds: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role.toLowerCase(),
      label_ids: userData.labelIds,
      is_active: userData.isActive,
      created_at: userData.createdAt.toISOString(),
      updated_at: userData.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role.toLowerCase(),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
