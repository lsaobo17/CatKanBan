import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const processes = [
  {
    name: "api",
    command: "node",
    args: ["node_modules/tsx/dist/cli.mjs", "watch", "apps/api/src/index.ts"]
  },
  {
    name: "web",
    command: "node",
    args: ["node_modules/vite/bin/vite.js", "--config", "apps/web/vite.config.ts", "--host", "0.0.0.0"]
  }
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    shell: false
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

