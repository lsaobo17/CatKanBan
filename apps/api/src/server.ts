import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors.js";
import type { BoardRepository } from "./repositories/boardRepository.js";
import type { UserRepository } from "./repositories/userRepository.js";
import { AuthService, SESSION_COOKIE_NAME } from "./services/authService.js";
import { BoardService } from "./services/boardService.js";
import { UserService } from "./services/userService.js";

interface BuildServerOptions {
  repository: BoardRepository;
  userRepository: UserRepository;
  logger?: boolean;
}

export function buildServer({ repository, userRepository, logger }: BuildServerOptions) {
  const server = Fastify({
    logger: logger ?? {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });
  const boardService = new BoardService(repository);
  const authService = new AuthService(userRepository);
  const userService = new UserService(userRepository);

  server.register(cors, {
    origin: true,
    credentials: true
  });

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.error,
        message: error.message
      });
      return;
    }

    server.log.error(error);
    reply.status(500).send({
      error: "Internal Server Error",
      message: "服务器内部错误"
    });
  });

  server.get("/api/health", async () => ({
    status: "ok",
    service: "catkanban-api"
  }));

  server.post("/api/auth/login", async (request, reply) => {
    const session = await authService.login(request.body);
    setSessionCookie(reply, request, session.token, session.maxAge);
    return { user: session.user };
  });

  server.post("/api/auth/logout", async (request, reply) => {
    await authService.logout(request.headers.cookie);
    clearSessionCookie(reply, request);
    reply.status(204).send();
  });

  server.get("/api/auth/me", async (request) => ({
    user: await requireUser(request, authService)
  }));

  server.get("/api/users", async (request) => {
    await requireUser(request, authService);
    return userService.listAssignableUsers();
  });

  server.get("/api/admin/users", async (request) => {
    const user = await requireUser(request, authService);
    return userService.listUsers(user);
  });

  server.post("/api/admin/users", async (request, reply) => {
    const user = await requireUser(request, authService);
    const created = await userService.createUser(user, request.body);
    reply.status(201).send(created);
  });

  server.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (request) => {
    const user = await requireUser(request, authService);
    return userService.updateUser(user, request.params.id, request.body);
  });

  server.get("/api/board", async (request) => {
    await requireUser(request, authService);
    const [board, users] = await Promise.all([boardService.getBoard(), userService.listAssignableUsers()]);
    return { ...board, users };
  });

  server.post("/api/tasks", async (request, reply) => {
    await requireUser(request, authService);
    const task = await boardService.createTask(request.body);
    reply.status(201).send(task);
  });

  server.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request) =>
    requireUser(request, authService).then(() => boardService.updateTask(request.params.id, request.body))
  );

  server.post<{ Params: { id: string } }>("/api/tasks/:id/move", async (request) =>
    requireUser(request, authService).then(() => boardService.moveTask(request.params.id, request.body))
  );

  server.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    await requireUser(request, authService);
    await boardService.deleteTask(request.params.id);
    reply.status(204).send();
  });

  registerStaticWeb(server);

  return server;
}

function registerStaticWeb(server: FastifyInstance) {
  const webDistDir = process.env.WEB_DIST_DIR;
  if (!webDistDir) {
    return;
  }

  const root = path.resolve(webDistDir);
  server.get("/*", async (request, reply) => {
    const requestPath = readRequestPath(request.url);
    if (requestPath.startsWith("/api/")) {
      reply.status(404).send({
        error: "Not Found",
        message: "API route not found"
      });
      return;
    }

    const file = await resolveStaticFile(root, requestPath);
    if (!file) {
      reply.status(404).send({
        error: "Not Found",
        message: "Static file not found"
      });
      return;
    }

    if (file.immutable) {
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
    }

    return reply.type(contentTypeFor(file.path)).send(createReadStream(file.path));
  });
}

function readRequestPath(url: string) {
  try {
    return decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return "/";
  }
}

async function resolveStaticFile(root: string, requestPath: string) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (isInside(root, filePath) && (await isFile(filePath))) {
    return {
      path: filePath,
      immutable: requestPath.startsWith("/assets/")
    };
  }

  if (requestPath.startsWith("/assets/") || path.extname(requestPath)) {
    return null;
  }

  const indexPath = path.resolve(root, "index.html");
  if (await isFile(indexPath)) {
    return {
      path: indexPath,
      immutable: false
    };
  }

  return null;
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function isFile(filePath: string) {
  try {
    await access(filePath);
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp"
  };

  return types[extension] ?? "application/octet-stream";
}

async function requireUser(request: FastifyRequest, authService: AuthService) {
  return authService.getCurrentUser(request.headers.cookie);
}

function setSessionCookie(reply: FastifyReply, request: FastifyRequest, token: string, maxAge: number) {
  reply.header("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, token, maxAge, request));
}

function clearSessionCookie(reply: FastifyReply, request: FastifyRequest) {
  reply.header("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", 0, request));
}

function serializeCookie(name: string, value: string, maxAge: number, request: FastifyRequest) {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];

  if (shouldUseSecureCookie(request)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function shouldUseSecureCookie(request: FastifyRequest) {
  const mode = process.env.COOKIE_SECURE?.trim().toLowerCase() ?? "auto";
  if (mode === "true" || mode === "1" || mode === "yes") {
    return true;
  }
  if (mode === "false" || mode === "0" || mode === "no") {
    return false;
  }

  return process.env.NODE_ENV === "production" || forwardedProtoIncludesHttps(request);
}

function forwardedProtoIncludesHttps(request: FastifyRequest) {
  const value = request.headers["x-forwarded-proto"];
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(","))
    .some((item) => item.trim().toLowerCase() === "https");
}
