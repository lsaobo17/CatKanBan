import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  console.error(
    [
      "Database configuration is missing.",
      "Set DATABASE_URL to a PostgreSQL connection string, or set POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.",
      "Docker Compose users should start this project with compose.yaml instead of running the app image by itself."
    ].join("\n")
  );
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;

const prismaCliCandidates = [
  "apps/api/node_modules/prisma/build/index.js",
  "node_modules/prisma/build/index.js"
];
const prismaCli = prismaCliCandidates.find((candidate) => existsSync(candidate));
const schemaPath = "apps/api/prisma/schema.prisma";

if (!prismaCli) {
  console.error(`Prisma CLI not found. Checked: ${prismaCliCandidates.join(", ")}`);
  process.exit(1);
}

const migration = spawn(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
  stdio: "inherit"
});

migration.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

migration.on("exit", async (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  try {
    await import("./dist/index.js");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

function resolveDatabaseUrl() {
  const directUrl = readEnv("DATABASE_URL");
  if (directUrl) {
    return directUrl;
  }

  const postgresEnvKeys = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"];
  if (!postgresEnvKeys.some((key) => readEnv(key))) {
    return null;
  }

  const host = readEnv("POSTGRES_HOST") ?? "db";
  const port = readEnv("POSTGRES_PORT") ?? "5432";
  const database = readEnv("POSTGRES_DB") ?? "catkanban";
  const user = readEnv("POSTGRES_USER") ?? "catkanban";
  const password = readEnv("POSTGRES_PASSWORD") ?? "catkanban";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
