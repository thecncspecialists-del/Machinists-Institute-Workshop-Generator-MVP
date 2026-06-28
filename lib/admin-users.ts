import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import instructors from "@/data/instructors.json";
import type { prisma as prismaSingleton } from "@/lib/db";
import { VALIDATION_LIMITS } from "@/lib/validation-limits";

export const ADMIN_EMAIL = "thecncspecialists@gmail.com";

type PrismaLike = typeof prismaSingleton;

export const adminUserInputSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  name: z.string().trim().max(VALIDATION_LIMITS.adminUserNameMax).optional().default(""),
  role: z.nativeEnum(Role).optional().default(Role.STAFF)
});

export function generateTemporaryPassword() {
  return `MI-${randomBytes(6).toString("base64url")}!7`;
}

export async function upsertUserWithDefaultPassword(
  prisma: PrismaLike,
  input: z.infer<typeof adminUserInputSchema>,
  password?: string
) {
  const temporaryPassword = password ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name || null,
      passwordHash,
      role: input.role
    },
    create: {
      email: input.email,
      name: input.name || null,
      passwordHash,
      role: input.role
    }
  });
}

export async function seedInstructorUsers(prisma: PrismaLike) {
  const seeded: Array<{ email: string; name: string | null; role: Role; temporaryPassword: string }> = [];

  for (const instructor of instructors) {
    for (const rawEmail of instructor.emails) {
      const temporaryPassword = generateTemporaryPassword();
      const parsed = adminUserInputSchema.parse({
        email: rawEmail,
        name: instructor.name,
        role: Role.STAFF
      });
      const user = await upsertUserWithDefaultPassword(prisma, parsed, temporaryPassword);
      seeded.push({ email: user.email, name: user.name, role: user.role, temporaryPassword });
    }
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = adminUserInputSchema.parse({
    email: ADMIN_EMAIL,
    name: "Admin",
    role: Role.ADMIN
  });
  const user = await upsertUserWithDefaultPassword(prisma, admin, temporaryPassword);
  seeded.push({ email: user.email, name: user.name, role: user.role, temporaryPassword });

  return seeded;
}
