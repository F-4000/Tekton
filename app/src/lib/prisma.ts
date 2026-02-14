import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Singleton Prisma client - prevents multiple instances during hot-reload.
 * @see https://www.prisma.io/docs/guides/nextjs
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL environment variable is required in production");
  }
  const adapter = new PrismaLibSql({
    url: dbUrl ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
