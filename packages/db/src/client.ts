import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var categoryfixPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.categoryfixPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.categoryfixPrisma = prisma;
}
