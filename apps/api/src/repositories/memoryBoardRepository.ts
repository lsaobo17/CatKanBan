import {
  DEFAULT_COLUMNS,
  DEFAULT_PROJECT_ID,
  type BoardColumn,
  type CreateTaskRequest,
  type MoveTaskRequest,
  type Project,
  type Task
} from "../../../../packages/shared/src/index.js";
import { NotFoundError } from "../errors.js";
import type { BoardData, BoardRepository, TaskUpdateData } from "./boardRepository.js";

const nowIso = () => new Date().toISOString();

export class MemoryBoardRepository implements BoardRepository {
  private sequence = 1;
  private readonly project: Project;
  private readonly columns: BoardColumn[];
  private tasks: Task[];

  constructor(tasks: Task[] = []) {
    const timestamp = nowIso();
    this.project = {
      id: DEFAULT_PROJECT_ID,
      name: "CatKanBan 项目看板",
      description: "默认项目",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.columns = DEFAULT_COLUMNS.map((column, index) => ({
      id: `column-${column.key}`,
      projectId: DEFAULT_PROJECT_ID,
      key: column.key,
      title: column.title,
      position: index,
      tasks: []
    }));
    this.tasks = tasks;
  }

  async seedDefaultBoard() {
    return undefined;
  }

  async getBoard(): Promise<BoardData> {
    return {
      project: this.project,
      columns: this.columns
        .map((column) => ({
          ...column,
          tasks: this.tasks
            .filter((task) => task.columnId === column.id)
            .sort((left, right) => left.position - right.position)
        }))
        .sort((left, right) => left.position - right.position)
    };
  }

  async getTask(id: string) {
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  async createTask(input: CreateTaskRequest): Promise<Task> {
    this.ensureColumn(input.columnId);
    const timestamp = nowIso();
    const position = this.tasks.filter((task) => task.columnId === input.columnId).length;
    const task: Task = {
      id: `task-${this.sequence++}`,
      projectId: DEFAULT_PROJECT_ID,
      columnId: input.columnId,
      title: input.title,
      description: input.description ?? "",
      startDate: input.startDate,
      dueDate: input.dueDate,
      priority: input.priority,
      progress: input.progress ?? 0,
      assigneeName: input.assigneeName ?? "",
      assigneeId: input.assigneeId ?? null,
      position,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.tasks.push(task);
    return task;
  }

  async updateTask(id: string, input: TaskUpdateData): Promise<Task> {
    const task = await this.requireTask(id);
    const updated = {
      ...task,
      ...input,
      description: input.description ?? task.description,
      assigneeId: input.assigneeId === undefined ? task.assigneeId : input.assigneeId,
      assigneeName: input.assigneeId === null ? "" : input.assigneeName ?? task.assigneeName,
      updatedAt: nowIso()
    };
    this.tasks = this.tasks.map((candidate) => (candidate.id === id ? updated : candidate));
    return updated;
  }

  async moveTask(id: string, input: MoveTaskRequest): Promise<Task> {
    this.ensureColumn(input.columnId);
    const task = await this.requireTask(id);
    const sourceColumnId = task.columnId;
    const targetTasks = this.tasks
      .filter((candidate) => candidate.columnId === input.columnId && candidate.id !== id)
      .sort((left, right) => left.position - right.position);
    const position = Math.max(0, Math.min(input.position ?? targetTasks.length, targetTasks.length));
    const moved = { ...task, columnId: input.columnId, updatedAt: nowIso() };
    targetTasks.splice(position, 0, moved);

    const sourceTasks = this.tasks
      .filter((candidate) => candidate.columnId === sourceColumnId && candidate.id !== id)
      .sort((left, right) => left.position - right.position);

    const nextTasks = this.tasks.filter(
      (candidate) => candidate.id !== id && candidate.columnId !== sourceColumnId && candidate.columnId !== input.columnId
    );

    const normalizedSource =
      sourceColumnId === input.columnId
        ? []
        : sourceTasks.map((candidate, index) => ({ ...candidate, position: index }));
    const normalizedTarget = targetTasks.map((candidate, index) => ({ ...candidate, position: index }));

    this.tasks = [...nextTasks, ...normalizedSource, ...normalizedTarget];
    return normalizedTarget.find((candidate) => candidate.id === id)!;
  }

  async deleteTask(id: string) {
    const task = await this.requireTask(id);
    this.tasks = this.tasks
      .filter((candidate) => candidate.id !== id)
      .map((candidate) => (candidate.columnId === task.columnId ? candidate : candidate));
    this.reindexColumn(task.columnId);
  }

  private ensureColumn(columnId: string) {
    if (!this.columns.some((column) => column.id === columnId)) {
      throw new NotFoundError("任务列不存在");
    }
  }

  private async requireTask(id: string) {
    const task = await this.getTask(id);
    if (!task) {
      throw new NotFoundError("任务不存在");
    }
    return task;
  }

  private reindexColumn(columnId: string) {
    const ordered = this.tasks
      .filter((task) => task.columnId === columnId)
      .sort((left, right) => left.position - right.position);
    this.tasks = this.tasks.map((task) => {
      const nextPosition = ordered.findIndex((candidate) => candidate.id === task.id);
      return nextPosition >= 0 ? { ...task, position: nextPosition } : task;
    });
  }
}
