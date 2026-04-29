import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { PrismaBoardRepository } from "./repositories/prismaBoardRepository.js";
import { PrismaUserRepository } from "./repositories/prismaUserRepository.js";
import { AuthService } from "./services/authService.js";
import { buildServer } from "./server.js";

const prisma = new PrismaClient();
const repository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const authService = new AuthService(userRepository);
const server = buildServer({ repository, userRepository });

await repository.seedDefaultBoard();
await authService.seedAdmin({
  username: env.ADMIN_USERNAME,
  password: env.ADMIN_PASSWORD,
  name: env.ADMIN_NAME
});

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
