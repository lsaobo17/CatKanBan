import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "../../../packages/shared/src/index";
import App from "./App";
import { UI_STYLE_STORAGE_KEY } from "./theme/uiStyles";

const storage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    }
  }
});

Object.defineProperty(window, "getComputedStyle", {
  configurable: true,
  value: () => ({
    getPropertyValue: () => "",
    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible"
  })
});

const adminUser: UserSummary = {
  id: "user-admin",
  username: "admin",
  email: null,
  name: "Admin",
  role: "admin" as const,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const memberUser: UserSummary = {
  id: "user-member",
  username: "member",
  email: null,
  name: "Alice",
  role: "member" as const,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const boardPayload = {
  project: {
    id: "default-project",
    name: "Test project",
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  users: [adminUser, memberUser],
  columns: [
    {
      id: "column-todo",
      projectId: "default-project",
      key: "todo" as const,
      title: "Todo",
      position: 0,
      tasks: [
        {
          id: "task-1",
          projectId: "default-project",
          columnId: "column-todo",
          title: "Design timeline",
          description: "",
          startDate: "2026-05-01",
          dueDate: "2026-05-03",
          priority: "medium" as const,
          progress: 40,
          assigneeId: memberUser.id,
          assigneeName: memberUser.name,
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    },
    {
      id: "column-doing",
      projectId: "default-project",
      key: "in_progress" as const,
      title: "Doing",
      position: 1,
      tasks: [
        {
          id: "task-2",
          projectId: "default-project",
          columnId: "column-doing",
          title: "Coordinate API",
          description: "",
          startDate: "2026-05-02",
          dueDate: "2026-05-04",
          priority: "high" as const,
          progress: 20,
          assigneeId: adminUser.id,
          assigneeName: adminUser.name,
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    },
    { id: "column-blocked", projectId: "default-project", key: "blocked" as const, title: "Blocked", position: 2, tasks: [] },
    { id: "column-done", projectId: "default-project", key: "done" as const, title: "Done", position: 3, tasks: [] }
  ]
};

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <App />
      </AntApp>
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({})
  } as Response;
}

function mockAuthenticatedFetch(user = adminUser) {
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return jsonResponse({ user });
    }
    if (url.endsWith("/board")) {
      return jsonResponse(boardPayload);
    }
    if (url.endsWith("/admin/users")) {
      return jsonResponse(boardPayload.users);
    }
    if (url.endsWith("/auth/logout")) {
      return emptyResponse();
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function mockLoginFetch() {
  let loggedIn = false;
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return loggedIn ? jsonResponse({ user: adminUser }) : jsonResponse({ message: "Login required" }, 401);
    }
    if (url.endsWith("/auth/login")) {
      loggedIn = true;
      return jsonResponse({ user: adminUser });
    }
    if (url.endsWith("/board")) {
      return jsonResponse(boardPayload);
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function mockFailedLoginFetch() {
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return jsonResponse({ message: "Login required" }, 401);
    }
    if (url.endsWith("/auth/login")) {
      return jsonResponse({ message: "Invalid username or password" }, 401);
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("App", () => {
  beforeEach(() => {
    storage.clear();
    document.documentElement.removeAttribute("data-ui-style");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows login when no session exists and loads the board after sign in", async () => {
    mockLoginFetch();
    renderApp();

    expect(await screen.findByRole("button", { name: /^登\s*录$/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "admin12345" } });
    fireEvent.click(screen.getByRole("button", { name: /登\s*录/ }));

    expect(await screen.findByText("登录成功")).toBeInTheDocument();
    expect(await screen.findByText("Design timeline")).toBeInTheDocument();
  });

  it("shows an error message when login fails", async () => {
    mockFailedLoginFetch();
    renderApp();

    expect(await screen.findByRole("button", { name: /^登\s*录$/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登\s*录$/ }));

    expect(await screen.findByText("用户名或密码错误")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^登\s*录$/ })).toBeInTheDocument();
  });

  it("switches between board and gantt views", async () => {
    mockAuthenticatedFetch();
    renderApp();

    expect(await screen.findByText("Design timeline")).toBeInTheDocument();
    fireEvent.click(screen.getByText("甘特图"));

    expect(await screen.findByText("40%")).toBeInTheDocument();
  });

  it("shows user management for admins only", async () => {
    mockAuthenticatedFetch(adminUser);
    renderApp();

    expect(await screen.findByLabelText("用户管理")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("用户管理"));
    expect(await screen.findByText("创建账号")).toBeInTheDocument();
    expect(await screen.findByText(adminUser.username)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /编\s*辑/ })[0]);
    expect(await screen.findByLabelText("姓名")).toHaveValue(adminUser.name);
  });

  it("hides user management for members", async () => {
    mockAuthenticatedFetch(memberUser);
    renderApp();

    expect(await screen.findByText("Design timeline")).toBeInTheDocument();
    expect(screen.queryByLabelText("用户管理")).not.toBeInTheDocument();
  });

  it("returns to the login screen after logout", async () => {
    mockAuthenticatedFetch(adminUser);
    renderApp();

    expect(await screen.findByText("Design timeline")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("退出登录"));

    expect(await screen.findByRole("button", { name: /^登\s*录$/ })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        credentials: "include",
        method: "POST"
      })
    );
  });

  it("restores the saved ui style on render", async () => {
    window.localStorage.setItem(UI_STYLE_STORAGE_KEY, "mint");
    mockAuthenticatedFetch();

    renderApp();

    await waitFor(() => {
      expect(document.documentElement.dataset.uiStyle).toBe("mint");
    });
  });
});
