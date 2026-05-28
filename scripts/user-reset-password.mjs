import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

async function main() {
  const email = readArg("--email").trim().toLowerCase();
  const tempPassword = readArg("--temp-password");

  if (!email || !tempPassword || tempPassword.length < 8) {
    throw new Error("Usage: --email <email> --temp-password <min-8-char-password>");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    throw new Error(`User not found: ${email}`);
  }

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });

  console.log(`Password reset complete: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
