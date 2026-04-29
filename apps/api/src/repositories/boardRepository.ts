import type {
  BoardPayload,
  CreateTaskRequest,
  MoveTaskRequest,
  Task,
  UpdateTaskRequest
} from "../../../../packages/shared/src/index.js";

export type TaskUpdateData = Omit<UpdateTaskRequest, "columnId">;
export type BoardData = Omit<BoardPayload, "users">;

export interface BoardRepository {
  seedDefaultBoard(): Promise<void>;
  getBoard(): Promise<BoardData>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: CreateTaskRequest): Promise<Task>;
  updateTask(id: string, input: TaskUpdateData): Promise<Task>;
  moveTask(id: string, input: MoveTaskRequest): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}
