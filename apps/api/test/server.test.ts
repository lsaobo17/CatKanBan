import { DEFAULT_PROJECT_ID, type Task } from "../../../packages/shared/src/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryBoardRepository } from "../src/repositories/memoryBoardRepository.js";
import { buildServer } from "../src/server.js";

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-existing",
  projectId: DEFAULT_PROJECT_ID,
  columnId: "column-todo",
  title: "已有任务",
  description: "",
  startDate: "2026-05-01",
  dueDate: "2026-05-03",
  priority: "medium",
  progress: 10,
  assigneeName: "Alice",
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

describe("api server", () => {
  let repository: MemoryBoardRepository;
  let server: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    repository = new MemoryBoardRepository([createTask()]);
    server = buildServer({ repository, logger: false });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it("returns health status", async () => {
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("creates, updates, moves, and deletes tasks", async () => {
    const board = await repository.getBoard();
    const todo = board.columns[0];
    const doing = board.columns[1];

    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        title: "新任务",
        columnId: todo.id,
        startDate: "2026-05-04",
        dueDate: "2026-05-06",
        priority: "high",
        progress: 20,
        assigneeName: "Bob"
      }
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<Task>();

    const patchedResponse = await server.inject({
      method: "PATCH",
      url: `/api/tasks/${created.id}`,
      payload: { progress: 50, title: "更新后的任务" }
    });
    expect(patchedResponse.statusCode).toBe(200);
    expect(patchedResponse.json<Task>()).toMatchObject({ progress: 50, title: "更新后的任务" });

    const movedResponse = await server.inject({
      method: "POST",
      url: `/api/tasks/${created.id}/move`,
      payload: { columnId: doing.id, position: 0 }
    });
    expect(movedResponse.statusCode).toBe(200);
    expect(movedResponse.json<Task>()).toMatchObject({ columnId: doing.id, position: 0 });

    const deletedResponse = await server.inject({
      method: "DELETE",
      url: `/api/tasks/${created.id}`
    });
    expect(deletedResponse.statusCode).toBe(204);
  });

  it("rejects invalid date ranges", async () => {
    const board = await repository.getBoard();
    const response = await server.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        title: "错误日期",
        columnId: board.columns[0].id,
        startDate: "2026-05-08",
        dueDate: "2026-05-01",
        priority: "medium"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "开始日期不能晚于截止日期" });
  });
});
