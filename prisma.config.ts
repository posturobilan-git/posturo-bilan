import { defineConfig } from "prisma/config";
import { loadEnvConfig } from "@next/env";

// Make .env.local available to the Prisma CLI (Next.js loads it at runtime,
// but CLI commands like `prisma migrate dev` run outside Next.js).
loadEnvConfig(process.cwd());

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
