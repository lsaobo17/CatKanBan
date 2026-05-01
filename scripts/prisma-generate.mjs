import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fallbackDatabaseUrl = "postgresql://catkanban:catkanban@localhost:5432/catkanban?schema=public";
const prismaCliCandidates = [
  "apps/api/node_modules/prisma/build/index.js",
  "node_modules/prisma/build/index.js"
];
const prismaCli = prismaCliCandidates.find((candidate) => existsSync(path.resolve(root, candidate)));

if (!prismaCli) {
  console.error(`Prisma CLI not found. Checked: ${prismaCliCandidates.join(", ")}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [prismaCli, "generate", "--schema", "apps/api/prisma/schema.prisma"],
  {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL?.trim() || fallbackDatabaseUrl
    },
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
