import cors from "@fastify/cors";
import Fastify from "fastify";
import { AppError } from "./errors.js";
import type { BoardRepository } from "./repositories/boardRepository.js";
import { BoardService } from "./services/boardService.js";

interface BuildServerOptions {
  repository: BoardRepository;
  logger?: boolean;
}

export function buildServer({ repository, logger }: BuildServerOptions) {
  const server = Fastify({
    logger: logger ?? {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });
  const boardService = new BoardService(repository);

  server.register(cors, {
    origin: true
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

  server.get("/api/board", async () => boardService.getBoard());

  server.post("/api/tasks", async (request, reply) => {
    const task = await boardService.createTask(request.body);
    reply.status(201).send(task);
  });

  server.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request) =>
    boardService.updateTask(request.params.id, request.body)
  );

  server.post<{ Params: { id: string } }>("/api/tasks/:id/move", async (request) =>
    boardService.moveTask(request.params.id, request.body)
  );

  server.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    await boardService.deleteTask(request.params.id);
    reply.status(204).send();
  });

  return server;
}
