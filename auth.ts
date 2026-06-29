import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/db";

if (process.env.NODE_ENV !== "production") {
  const localAuthSecret = "local-development-auth-secret-for-port-3002-only";
  process.env.AUTH_SECRET ||= localAuthSecret;
  process.env.NEXTAUTH_SECRET ||= process.env.AUTH_SECRET;
  process.env.AUTH_URL ||= "http://localhost:3002";
  process.env.NEXTAUTH_URL ||= "http://localhost:3002";
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/sign-in"
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsedCredentials = credentialsSchema.safeParse(rawCredentials);
        if (!parsedCredentials.success) {
          return null;
        }

        const { email, password } = parsedCredentials.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role ?? Role.STAFF;
      }
      if (token.sub) {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            email: true,
            name: true,
            role: true
          }
        });
        if (currentUser) {
          token.email = currentUser.email;
          token.name = currentUser.name;
          token.role = currentUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role) ?? Role.STAFF;
      }
      return session;
    }
  }
};

export function auth() {
  return getServerSession(authOptions);
}
