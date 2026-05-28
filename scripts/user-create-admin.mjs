import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

async function main() {
  const email = readArg("--email").trim().toLowerCase();
  const name = readArg("--name").trim();
  const tempPassword = readArg("--temp-password");

  if (!email || !tempPassword || tempPassword.length < 8) {
    throw new Error("Usage: --email <email> --name <name> --temp-password <min-8-char-password>");
  }

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: name || null,
      passwordHash,
      role: Role.ADMIN
    },
    create: {
      email,
      name: name || null,
      passwordHash,
      role: Role.ADMIN
    }
  });

  console.log(`Admin account ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
