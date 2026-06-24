import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { authService } from "./services/auth.service";

const initialEvent = {
  code: "DGTL7K9M2Q",
  name: "Digitel Fan Zone Caracas",
  description: "CCCT, Nivel C2",
  startsAt: new Date("2026-01-01T10:00:00.000-04:00"),
  endsAt: new Date("2027-12-31T20:00:00.000-04:00"),
  isActive: true,
  prizes: [
    {
      name: "una calcomania",
      description: "Calcomania oficial de la promocion.",
      stockTotal: 250
    },
    {
      name: "una pulsera",
      description: "Pulsera promocional Digitel.",
      stockTotal: 180
    },
    {
      name: "1 sobre de barajitas",
      description: "Sobre coleccionable de barajitas.",
      stockTotal: 120
    },
    {
      name: "un balon del Mundial",
      description: "Balon promocional sujeto a disponibilidad.",
      stockTotal: 25
    }
  ]
};

async function run() {
  const event = await prisma.event.upsert({
    where: { code: initialEvent.code },
    update: {
      name: initialEvent.name,
      description: initialEvent.description,
      startsAt: initialEvent.startsAt,
      endsAt: initialEvent.endsAt,
      isActive: initialEvent.isActive
    },
    create: {
      code: initialEvent.code,
      name: initialEvent.name,
      description: initialEvent.description,
      startsAt: initialEvent.startsAt,
      endsAt: initialEvent.endsAt,
      isActive: initialEvent.isActive
    }
  });

  for (const prize of initialEvent.prizes) {
    const existingPrize = await prisma.prize.findFirst({
      where: {
        eventId: event.id,
        name: prize.name
      }
    });

    if (existingPrize) {
      await prisma.prize.update({
        where: { id: existingPrize.id },
        data: {
          description: prize.description,
          stockTotal: prize.stockTotal,
          stockAvailable: Math.min(existingPrize.stockAvailable, prize.stockTotal),
          isActive: true
        }
      });
      continue;
    }

    await prisma.prize.create({
      data: {
        eventId: event.id,
        name: prize.name,
        description: prize.description,
        stockTotal: prize.stockTotal,
        stockAvailable: prize.stockTotal,
        isActive: true
      }
    });
  }

  logger.info({ eventId: event.id, code: event.code }, "Seeded initial event");

  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_NAME && env.SEED_ADMIN_PASSWORD) {
    const user = await authService.seedSuperAdmin(
      env.SEED_ADMIN_NAME,
      env.SEED_ADMIN_EMAIL,
      env.SEED_ADMIN_PASSWORD
    );

    logger.info({ userId: user.id, email: user.email }, "Seeded SUPER_ADMIN user");
    return;
  }

  logger.info("Skipped SUPER_ADMIN seed because seed admin environment variables are incomplete");
}

run()
  .catch((error) => {
    logger.error({ error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
