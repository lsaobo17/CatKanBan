import type {
  ApiErrorPayload,
  AuthMePayload,
  BoardPayload,
  CreateTaskRequest,
  CreateUserRequest,
  LoginRequest,
  MoveTaskRequest,
  Task,
  UpdateTaskRequest,
  UpdateUserRequest,
  UserSummary
} from "../../../../packages/shared/src/index";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiUnauthorizedError extends Error {}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (response.status === 401) {
      throw new ApiUnauthorizedError(payload?.message ?? "Login required");
    }
    throw new Error(payload?.message ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login: (input: LoginRequest) =>
    request<AuthMePayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  logout: () =>
    request<void>("/auth/logout", {
      method: "POST"
    }),
  getMe: () => request<AuthMePayload>("/auth/me"),
  getBoard: () => request<BoardPayload>("/board"),
  getUsers: () => request<UserSummary[]>("/users"),
  listAdminUsers: () => request<UserSummary[]>("/admin/users"),
  createAdminUser: (input: CreateUserRequest) =>
    request<UserSummary>("/admin/users", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateAdminUser: (id: string, input: UpdateUserRequest) =>
    request<UserSummary>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
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
