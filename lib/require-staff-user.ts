import { NextResponse } from "next/server";

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
