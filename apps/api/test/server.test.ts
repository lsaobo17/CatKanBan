import { DEFAULT_PROJECT_ID, type Task } from "../../../packages/shared/src/index.js";
import { mkdir, mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryBoardRepository } from "../src/repositories/memoryBoardRepository.js";
import { MemoryUserRepository } from "../src/repositories/memoryUserRepository.js";
import type { UserRepository } from "../src/repositories/userRepository.js";
import { buildServer } from "../src/server.js";
import { AuthService } from "../src/services/authService.js";
import { hashPassword } from "../src/services/security.js";

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-existing",
  projectId: DEFAULT_PROJECT_ID,
  columnId: "column-todo",
  title: "Existing task",
  description: "",
  startDate: "2026-05-01",
  dueDate: "2026-05-03",
  priority: "medium",
  progress: 10,
  assigneeId: null,
  assigneeName: "Alice",
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const ORIGINAL_COOKIE_SECURE = process.env.COOKIE_SECURE;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_WEB_DIST_DIR = process.env.WEB_DIST_DIR;

describe("api server", () => {
  let repository: MemoryBoardRepository;
  let userRepository: UserRepository;
  let server: ReturnType<typeof buildServer>;
  let adminCookie: string;
  let memberCookie: string;
  let memberId: string;

  beforeEach(async () => {
    repository = new MemoryBoardRepository([createTask()]);
    userRepository = new MemoryUserRepository();

    const authService = new AuthService(userRepository);
    await authService.seedAdmin({
      username: "admin",
      name: "Admin",
      password: "admin12345"
    });
    const member = await userRepository.createUser({
      username: "member",
      name: "Alice",
      role: "member",
      passwordHash: await hashPassword("member12345")
    });
    memberId = member.id;

    server = buildServer({ repository, userRepository, logger: false });
    await server.ready();
    adminCookie = await login("admin", "admin12345");
    memberCookie = await login("member", "member12345");
  });

  afterEach(async () => {
    await server.close();
    restoreEnv("COOKIE_SECURE", ORIGINAL_COOKIE_SECURE);
    restoreEnv("NODE_ENV", ORIGINAL_NODE_ENV);
    restoreEnv("WEB_DIST_DIR", ORIGINAL_WEB_DIST_DIR);
  });

  it("returns health status", async () => {
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("requires login for board data", async () => {
    const response = await server.inject({ method: "GET", url: "/api/board" });
    expect(response.statusCode).toBe(401);
  });

  it("logs in and returns the current user", async () => {
    const loginResponse = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "admin12345" }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toContain("catkanban_session=");

    const meResponse = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: readCookie(loginResponse.headers["set-cookie"]) }
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({ user: { username: "admin", role: "admin" } });
  });

  it("can disable secure cookies for http docker deployments", async () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "admin12345" }
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["set-cookie"])).not.toContain("Secure");
  });

  it("can force secure cookies for https deployments", async () => {
    process.env.COOKIE_SECURE = "true";

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "admin12345" }
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["set-cookie"])).toContain("Secure");
  });

  it("serves the built web app when configured for a single image", async () => {
    await server.close();
    const webDistDir = await createWebDistFixture();
    process.env.WEB_DIST_DIR = webDistDir;
    server = buildServer({ repository, userRepository, logger: false });
    await server.ready();

    try {
      const indexResponse = await server.inject({ method: "GET", url: "/" });
      expect(indexResponse.statusCode).toBe(200);
      expect(indexResponse.headers["content-type"]).toContain("text/html");
      expect(indexResponse.body).toContain("CatKanBan shell");

      const fallbackResponse = await server.inject({ method: "GET", url: "/board" });
      expect(fallbackResponse.statusCode).toBe(200);
      expect(fallbackResponse.body).toContain("CatKanBan shell");

      const assetResponse = await server.inject({ method: "GET", url: "/assets/app.js" });
      expect(assetResponse.statusCode).toBe(200);
      expect(assetResponse.headers["cache-control"]).toContain("immutable");
      expect(assetResponse.body).toContain("console.log");
    } finally {
      await cleanupWebDistFixture(webDistDir);
    }
  });

  it("creates, updates, moves, and deletes tasks", async () => {
    const board = await repository.getBoard();
    const todo = board.columns[0];
    const doing = board.columns[1];

    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie: memberCookie },
      payload: {
        title: "New task",
        columnId: todo.id,
        startDate: "2026-05-04",
        dueDate: "2026-05-06",
        priority: "high",
        progress: 20,
        assigneeId: memberId,
        assigneeName: "Alice"
      }
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<Task>();
    expect(created).toMatchObject({ assigneeId: memberId });

    const patchedResponse = await server.inject({
      method: "PATCH",
      url: `/api/tasks/${created.id}`,
      headers: { cookie: memberCookie },
      payload: { progress: 50, title: "Updated task", assigneeId: null }
    });
    expect(patchedResponse.statusCode).toBe(200);
    expect(patchedResponse.json<Task>()).toMatchObject({
      progress: 50,
      title: "Updated task",
      assigneeId: null
    });

    const movedResponse = await server.inject({
      method: "POST",
      url: `/api/tasks/${created.id}/move`,
      headers: { cookie: memberCookie },
      payload: { columnId: doing.id, position: 0 }
    });
    expect(movedResponse.statusCode).toBe(200);
    expect(movedResponse.json<Task>()).toMatchObject({ columnId: doing.id, position: 0 });

    const deletedResponse = await server.inject({
      method: "DELETE",
      url: `/api/tasks/${created.id}`,
      headers: { cookie: memberCookie }
    });
    expect(deletedResponse.statusCode).toBe(204);
  });

  it("allows admins to create and disable users", async () => {
    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { cookie: adminCookie },
      payload: {
        username: "new-user",
        password: "newuser123"
      }
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<{ id: string; name: string; username: string }>();
    expect(created).toMatchObject({ username: "new-user", name: "new-user" });

    const renamedResponse = await server.inject({
      method: "PATCH",
      url: `/api/admin/users/${created.id}`,
      headers: { cookie: adminCookie },
      payload: { name: "New Display Name" }
    });
    expect(renamedResponse.statusCode).toBe(200);
    expect(renamedResponse.json()).toMatchObject({ username: "new-user", name: "New Display Name" });

    const disabledResponse = await server.inject({
      method: "PATCH",
      url: `/api/admin/users/${created.id}`,
      headers: { cookie: adminCookie },
      payload: { isActive: false }
    });
    expect(disabledResponse.statusCode).toBe(200);
    expect(disabledResponse.json()).toMatchObject({ isActive: false });

    const loginResponse = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "new-user", password: "newuser123" }
    });
    expect(loginResponse.statusCode).toBe(401);
  });

  it("blocks non-admins from user administration", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { cookie: memberCookie }
    });
    expect(response.statusCode).toBe(403);
  });

  it("rejects invalid date ranges", async () => {
    const board = await repository.getBoard();
    const response = await server.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie: memberCookie },
      payload: {
        title: "Invalid date task",
        columnId: board.columns[0].id,
        startDate: "2026-05-08",
        dueDate: "2026-05-01",
        priority: "medium"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  async function login(username: string, password: string) {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username, password }
    });
    expect(response.statusCode).toBe(200);
    return readCookie(response.headers["set-cookie"]);
  }
});

function readCookie(value: string | string[] | number | undefined) {
  const header = Array.isArray(value) ? value[0] : String(value ?? "");
  return header.split(";")[0];
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function createWebDistFixture() {
  const root = await mkdtemp(join(tmpdir(), "catkanban-web-"));
  const assetsDir = join(root, "assets");
  await mkdir(assetsDir);
  await writeFile(join(root, "index.html"), "<!doctype html><title>CatKanBan shell</title>");
  await writeFile(join(assetsDir, "app.js"), "console.log('catkanban');");
  return root;
}

async function cleanupWebDistFixture(root: string) {
  await rm(join(root, "assets", "app.js"), { force: true });
  await rm(join(root, "index.html"), { force: true });
  await rmdir(join(root, "assets"));
  await rmdir(root);
}
