import { ActionHistoryStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import {
  adminUserInputSchema,
  generateTemporaryPassword,
  seedInstructorUsers,
  upsertUserWithDefaultPassword
} from "@/lib/admin-users";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["reset-password", "update-role"]),
  role: z.nativeEnum(Role).optional()
});

async function runAdminMutationGuard(request: Request, actor: { id: string; email?: string | null }) {
  return runApiMutationGuard({
    request,
    actor,
    area: "admin_users",
    guardActionType: "admin_user_mutation_guard",
    idempotencyActionType: "admin_user_mutation",
    rateLimit: {
      actionTypes: ["admin_user_mutation", "admin_user_mutation_guard"],
      max: 40,
      windowMs: 5 * 60 * 1000
    }
  });
}

export async function GET() {
  const authResult = await requireAdminUser();
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
  const authResult = await requireAdminUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runAdminMutationGuard(request, actor);
  if (guard.response) return guard.response;

  const body = await request.json();
  if (body?.mode === "seed-instructors") {
    const credentials = await seedInstructorUsers(prisma);
    await recordActionHistory({
      actor,
      actionType: "admin_user_mutation",
      description: "Seeded instructor user accounts.",
      area: "admin_users",
      affectedType: "user",
      status: ActionHistoryStatus.SUCCESS,
      metadata: { mode: "seed_instructors", count: credentials.length }
    });
    return NextResponse.json({ count: credentials.length, credentials });
  }

  const input = adminUserInputSchema.parse(body);
  const temporaryPassword = generateTemporaryPassword();
  const user = await upsertUserWithDefaultPassword(prisma, input, temporaryPassword);
  await recordActionHistory({
    actor,
    actionType: "admin_user_mutation",
    description: "Created or updated staff user credentials.",
    area: "admin_users",
    affectedType: "user",
    affectedId: user.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: { email: user.email, role: user.role }
  });
  return NextResponse.json({ user, credentials: [{ email: user.email, temporaryPassword }] });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdminUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runAdminMutationGuard(request, actor);
  if (guard.response) return guard.response;
  const body = patchSchema.parse(await request.json());
  if (body.action === "reset-password") {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await prisma.user.update({
      where: { id: body.id },
      data: { passwordHash },
      select: { id: true, email: true, role: true }
    });
    await recordActionHistory({
      actor,
      actionType: "admin_user_mutation",
      description: "Reset a staff user password.",
      area: "admin_users",
      affectedType: "user",
      affectedId: user.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { email: user.email, role: user.role }
    });
    return NextResponse.json({ ok: true, credentials: [{ temporaryPassword }] });
  }

  if (!body.role) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 });
  }
  if (body.id === authResult.user.id && body.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Admins cannot remove their own admin role." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({
    where: { id: body.id },
    select: { id: true, email: true, role: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (existing.role === Role.ADMIN && body.role !== Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "At least one admin user is required." }, { status: 400 });
    }
  }
  const user = await prisma.user.update({
    where: { id: body.id },
    data: { role: body.role },
    select: { id: true, email: true, name: true, role: true, updatedAt: true }
  });
  await recordActionHistory({
    actor,
    actionType: "admin_user_mutation",
    description: "Updated a staff user role.",
    area: "admin_users",
    affectedType: "user",
    affectedId: user.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: { email: user.email, previousRole: existing.role, nextRole: user.role }
  });
  return NextResponse.json({ user });
}
