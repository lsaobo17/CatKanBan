import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required at runtime. Set it to a PostgreSQL connection string.");
  process.exit(1);
}

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
