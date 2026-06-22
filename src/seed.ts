import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { authService } from "./services/auth.service";

async function run() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_NAME || !env.SEED_ADMIN_PASSWORD) {
    throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD are required.");
  }

  const user = await authService.seedSuperAdmin(
    env.SEED_ADMIN_NAME,
    env.SEED_ADMIN_EMAIL,
    env.SEED_ADMIN_PASSWORD
  );

  logger.info({ userId: user.id, email: user.email }, "Seeded SUPER_ADMIN user");
}

run()
  .catch((error) => {
    logger.error({ error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
