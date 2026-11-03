import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { hashPassword } from "../src/auth.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const bootstrapSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_BOOTSTRAP_EMAIL: z.string().trim().email().max(254),
  ADMIN_BOOTSTRAP_NAME: z.string().trim().min(2).max(120),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).max(128)
});
const parsedConfig = bootstrapSchema.safeParse(process.env);
if (!parsedConfig.success) {
  const invalidFields = [...new Set(parsedConfig.error.issues.map((issue) => issue.path[0]))];
  throw new Error(`Missing or invalid bootstrap settings: ${invalidFields.join(", ")}`);
}
const config = parsedConfig.data;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL })
});

try {
  const email = config.ADMIN_BOOTSTRAP_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists. This command only creates a new administrator.");
  }
  const admin = await prisma.user.create({
    data: {
      email,
      name: config.ADMIN_BOOTSTRAP_NAME,
      passwordHash: await hashPassword(config.ADMIN_BOOTSTRAP_PASSWORD),
      role: "ADMIN",
      emailVerifiedAt: new Date()
    },
    select: { email: true }
  });
  console.log(`Created verified administrator: ${admin.email}`);
} finally {
  await prisma.$disconnect();
}
