import cors from "@fastify/cors";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
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
    setSessionCookie(reply, session.token, session.maxAge);
    return { user: session.user };
  });

  server.post("/api/auth/logout", async (request, reply) => {
    await authService.logout(request.headers.cookie);
    clearSessionCookie(reply);
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

  return server;
}

async function requireUser(request: FastifyRequest, authService: AuthService) {
  return authService.getCurrentUser(request.headers.cookie);
}

function setSessionCookie(reply: FastifyReply, token: string, maxAge: number) {
  reply.header("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, token, maxAge));
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", 0));
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}
