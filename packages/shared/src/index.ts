export const DEFAULT_PROJECT_ID = "default-project";

export const DEFAULT_COLUMNS = [
  { key: "todo", title: "待办", position: 0 },
  { key: "in_progress", title: "进行中", position: 1 },
  { key: "blocked", title: "阻塞", position: 2 },
  { key: "done", title: "已完成", position: 3 }
] as const;

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ColumnKey = (typeof DEFAULT_COLUMNS)[number]["key"];
export type Priority = (typeof PRIORITIES)[number];
export type ViewMode = "board" | "gantt";

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  priority: Priority;
  progress: number;
  assigneeName: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: string;
  projectId: string;
  key: ColumnKey;
  title: string;
  position: number;
  tasks: Task[];
}

export interface BoardPayload {
  project: Project;
  columns: BoardColumn[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  columnId: string;
  startDate: string;
  dueDate: string;
  priority: Priority;
  progress?: number;
  assigneeName?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  columnId?: string;
  startDate?: string;
  dueDate?: string;
  priority?: Priority;
  progress?: number;
  assigneeName?: string;
}

export interface MoveTaskRequest {
  columnId: string;
  position?: number;
}

export interface ApiErrorPayload {
  error: string;
  message: string;
}

