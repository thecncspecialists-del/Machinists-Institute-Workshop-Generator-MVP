import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

import { auth } from "@/auth";

export async function requireStaffUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
      user: null
    };
  }

  return {
    response: null,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      role: session.user.role
    }
  };
}

export async function requireAdminUser() {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return {
      response: authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
      user: null
    };
  }

  if (authResult.user.role !== Role.ADMIN) {
    return {
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
      user: null
    };
  }

  return {
    response: null,
    user: authResult.user
  };
}
