import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  adminUserInputSchema,
  generateTemporaryPassword,
  seedInstructorUsers,
  upsertUserWithDefaultPassword
} from "@/lib/admin-users";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["reset-password", "update-role"]),
  role: z.nativeEnum(Role).optional()
});

async function requireAdmin() {
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
  return { response: null, user: authResult.user };
}

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.response) return authResult.response;

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if (authResult.response) return authResult.response;

  const body = await request.json();
  if (body?.mode === "seed-instructors") {
    const credentials = await seedInstructorUsers(prisma);
    return NextResponse.json({ count: credentials.length, credentials });
  }

  const input = adminUserInputSchema.parse(body);
  const temporaryPassword = generateTemporaryPassword();
  const user = await upsertUserWithDefaultPassword(prisma, input, temporaryPassword);
  return NextResponse.json({ user, credentials: [{ email: user.email, temporaryPassword }] });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if (authResult.response) return authResult.response;

  const body = patchSchema.parse(await request.json());
  if (body.action === "reset-password") {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await prisma.user.update({
      where: { id: body.id },
      data: { passwordHash }
    });
    return NextResponse.json({ ok: true, credentials: [{ temporaryPassword }] });
  }

  if (!body.role) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id: body.id },
    data: { role: body.role },
    select: { id: true, email: true, name: true, role: true, updatedAt: true }
  });
  return NextResponse.json({ user });
}
