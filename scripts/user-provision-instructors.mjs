import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADMIN_EMAIL = "thecncspecialists@gmail.com";
const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function temporaryPassword() {
  return `MI-${randomBytes(6).toString("base64url")}!7`;
}

async function upsertUser(email, name, role, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { email, name, role, passwordHash }
  });
}

async function main() {
  const file = await fs.readFile(path.join(__dirname, "..", "data", "instructors.json"), "utf8");
  const instructors = JSON.parse(file);
  let count = 0;
  const credentials = [];

  for (const instructor of instructors) {
    for (const rawEmail of instructor.emails ?? []) {
      const email = String(rawEmail).trim().toLowerCase();
      if (!email) continue;
      const password = temporaryPassword();
      await upsertUser(email, instructor.name || null, Role.STAFF, password);
      credentials.push(`${email},${password}`);
      count += 1;
    }
  }

  const adminPassword = temporaryPassword();
  await upsertUser(ADMIN_EMAIL, "Admin", Role.ADMIN, adminPassword);
  credentials.push(`${ADMIN_EMAIL},${adminPassword}`);
  count += 1;
  console.log(`Provisioned ${count} users with unique temporary passwords.`);
  console.log("email,temporary_password");
  console.log(credentials.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
