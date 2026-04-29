import type {
  ApiErrorPayload,
  BoardPayload,
  CreateTaskRequest,
  MoveTaskRequest,
  Task,
  UpdateTaskRequest
} from "../../../../packages/shared/src/index";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(payload?.message ?? "请求失败");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getBoard: () => request<BoardPayload>("/board"),
  createTask: (input: CreateTaskRequest) =>
    request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateTask: (id: string, input: UpdateTaskRequest) =>
    request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  moveTask: (id: string, input: MoveTaskRequest) =>
    request<Task>(`/tasks/${id}/move`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}`, {
      method: "DELETE"
    })
};
