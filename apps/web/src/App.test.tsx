import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const boardPayload = {
  project: {
    id: "default-project",
    name: "测试项目",
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  columns: [
    {
      id: "column-todo",
      projectId: "default-project",
      key: "todo",
      title: "待办",
      position: 0,
      tasks: [
        {
          id: "task-1",
          projectId: "default-project",
          columnId: "column-todo",
          title: "设计时间线",
          description: "",
          startDate: "2026-05-01",
          dueDate: "2026-05-03",
          priority: "medium",
          progress: 40,
          assigneeName: "Alice",
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    },
    {
      id: "column-doing",
      projectId: "default-project",
      key: "in_progress",
      title: "进行中",
      position: 1,
      tasks: [
        {
          id: "task-2",
          projectId: "default-project",
          columnId: "column-doing",
          title: "推进接口联调",
          description: "",
          startDate: "2026-05-02",
          dueDate: "2026-05-04",
          priority: "high",
          progress: 20,
          assigneeName: "Bob",
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    },
    {
      id: "column-blocked",
      projectId: "default-project",
      key: "blocked",
      title: "阻塞",
      position: 2,
      tasks: [
        {
          id: "task-3",
          projectId: "default-project",
          columnId: "column-blocked",
          title: "等待测试数据",
          description: "",
          startDate: "2026-05-03",
          dueDate: "2026-05-05",
          priority: "urgent",
          progress: 60,
          assigneeName: "Carol",
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    },
    {
      id: "column-done",
      projectId: "default-project",
      key: "done",
      title: "已完成",
      position: 3,
      tasks: [
        {
          id: "task-4",
          projectId: "default-project",
          columnId: "column-done",
          title: "完成需求评审",
          description: "",
          startDate: "2026-04-29",
          dueDate: "2026-04-30",
          priority: "low",
          progress: 100,
          assigneeName: "Dana",
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }
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

function mockBoardFetch() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => boardPayload
  } as Response) as typeof fetch;
}

describe("App", () => {
  beforeEach(() => {
    storage.clear();
    document.documentElement.removeAttribute("data-ui-style");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("switches between board and gantt views", async () => {
    mockBoardFetch();
    renderApp();

    expect(await screen.findByText("设计时间线")).toBeInTheDocument();
    fireEvent.click(screen.getByText("甘特图"));

    expect(await screen.findByText("时间")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("colors gantt bars by board column status", async () => {
    mockBoardFetch();
    const { container } = renderApp();

    expect(await screen.findByText("设计时间线")).toBeInTheDocument();
    fireEvent.click(screen.getByText("甘特图"));

    expect(await screen.findByText("时间")).toBeInTheDocument();
    expect(container.querySelector(".gantt-bar-status-todo")).toBeInTheDocument();
    expect(container.querySelector(".gantt-bar-status-in_progress")).toBeInTheDocument();
    expect(container.querySelector(".gantt-bar-status-blocked")).toBeInTheDocument();
    expect(container.querySelector(".gantt-bar-status-done")).toBeInTheDocument();
  });

  it("opens settings drawer and changes ui style", async () => {
    mockBoardFetch();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "界面设置" }));

    expect(await screen.findByText("UI 风格")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /夜间深色/ }));

    await waitFor(() => {
      expect(document.documentElement.dataset.uiStyle).toBe("dark");
    });
    expect(window.localStorage.getItem(UI_STYLE_STORAGE_KEY)).toBe("dark");
  });

  it("restores the saved ui style on render", async () => {
    window.localStorage.setItem(UI_STYLE_STORAGE_KEY, "mint");
    mockBoardFetch();

    renderApp();

    await waitFor(() => {
      expect(document.documentElement.dataset.uiStyle).toBe("mint");
    });
  });
});
