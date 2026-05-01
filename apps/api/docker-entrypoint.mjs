import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const databaseUrl = resolveDatabaseUrl();
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

const migrationExitCode = await runPrismaMigration();
if (migrationExitCode !== 0) {
  process.exit(migrationExitCode);
}

try {
  await import("./dist/index.js");
} catch (error) {
  console.error(error);
  process.exit(1);
}

function resolveDatabaseUrl() {
  const directUrl = readEnv("DATABASE_URL");
  if (directUrl) {
    return directUrl;
  }

  const postgresEnvKeys = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"];
  const hasPostgresEnv = postgresEnvKeys.some((key) => readEnv(key));
  if (!hasPostgresEnv) {
    console.warn(
      [
        "DATABASE_URL is not set; using the default Docker database service at db:5432.",
        "If this container is not running with a PostgreSQL service named db, set DATABASE_URL or POSTGRES_* environment variables."
      ].join("\n")
    );
  }

  const host = readEnv("POSTGRES_HOST") ?? "db";
  const port = readEnv("POSTGRES_PORT") ?? "5432";
  const database = readEnv("POSTGRES_DB") ?? "catkanban";
  const user = readEnv("POSTGRES_USER") ?? "catkanban";
  const password = readEnv("POSTGRES_PASSWORD") ?? "catkanban";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;
}

async function runPrismaMigration() {
  const maxAttempts = readPositiveInteger("MIGRATION_RETRIES", 30);
  const retryDelayMs = readPositiveInteger("MIGRATION_RETRY_DELAY_MS", 2000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runPrismaMigrationOnce();
    if (result.signal) {
      process.kill(process.pid, result.signal);
      return 1;
    }

    if (result.code === 0) {
      return 0;
    }

    if (attempt === maxAttempts) {
      return result.code ?? 1;
    }

    console.warn(
      `Prisma migration failed with exit code ${result.code ?? 1}. Retrying in ${retryDelayMs}ms (${attempt}/${maxAttempts})...`
    );
    await delay(retryDelayMs);
  }

  return 1;
}

function runPrismaMigrationOnce() {
  return new Promise((resolve, reject) => {
    const migration = spawn(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
      stdio: "inherit"
    });

    migration.on("error", reject);
    migration.on("exit", (code, signal) => resolve({ code, signal }));
  }).catch((error) => {
    console.error(error);
    return { code: 1, signal: null };
  });
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readPositiveInteger(name, fallback) {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
