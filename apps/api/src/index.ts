import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { PrismaBoardRepository } from "./repositories/prismaBoardRepository.js";
import { buildServer } from "./server.js";

const prisma = new PrismaClient();
const repository = new PrismaBoardRepository(prisma);
const server = buildServer({ repository });

await repository.seedDefaultBoard();

try {
  await server.listen({ host: env.API_HOST, port: env.API_PORT });
  server.log.info(`API listening on ${env.API_HOST}:${env.API_PORT}`);
} catch (error) {
  server.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

const shutdown = async () => {
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

