import {
  PRIORITIES,
  type CreateTaskRequest,
  type MoveTaskRequest,
  type UpdateTaskRequest
} from "../../../../packages/shared/src/index.js";
import { NotFoundError, ValidationError } from "../errors.js";
import type { BoardRepository } from "../repositories/boardRepository.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class BoardService {
  constructor(private readonly repository: BoardRepository) {}

  getBoard() {
    return this.repository.getBoard();
  }

  async createTask(body: unknown) {
    const input = parseCreateTask(body);
    return this.repository.createTask(input);
  }

  async updateTask(id: string, body: unknown) {
    const input = parseUpdateTask(body);
    const current = await this.repository.getTask(id);
    if (!current) {
      throw new NotFoundError("任务不存在");
    }

    const nextStartDate = input.startDate ?? current.startDate;
    const nextDueDate = input.dueDate ?? current.dueDate;
    assertDateRange(nextStartDate, nextDueDate);

    const { columnId, ...rest } = input;
    let updated = current;
    if (columnId && columnId !== current.columnId) {
      updated = await this.repository.moveTask(id, { columnId });
    }

    if (Object.keys(rest).length === 0) {
      return updated;
    }

    return this.repository.updateTask(id, rest);
  }

  async moveTask(id: string, body: unknown) {
    const input = parseMoveTask(body);
    return this.repository.moveTask(id, input);
  }

  deleteTask(id: string) {
    return this.repository.deleteTask(id);
  }
}

function parseCreateTask(body: unknown): CreateTaskRequest {
  if (!isRecord(body)) {
    throw new ValidationError("请求体格式错误");
  }

  const title = readRequiredString(body.title, "标题");
  const columnId = readRequiredString(body.columnId, "任务列");
  const startDate = readRequiredDate(body.startDate, "开始日期");
  const dueDate = readRequiredDate(body.dueDate, "截止日期");
  const priority = readPriority(body.priority);
  const progress = readProgress(body.progress ?? 0);
  assertDateRange(startDate, dueDate);

  return {
    title,
    columnId,
    startDate,
    dueDate,
    priority,
    progress,
    description: readOptionalString(body.description),
    assigneeName: readOptionalString(body.assigneeName)
  };
}

function parseUpdateTask(body: unknown): UpdateTaskRequest {
  if (!isRecord(body)) {
    throw new ValidationError("请求体格式错误");
  }

  const input: UpdateTaskRequest = {};
  if ("title" in body) {
    input.title = readRequiredString(body.title, "标题");
  }
  if ("columnId" in body) {
    input.columnId = readRequiredString(body.columnId, "任务列");
  }
  if ("startDate" in body) {
    input.startDate = readRequiredDate(body.startDate, "开始日期");
  }
  if ("dueDate" in body) {
    input.dueDate = readRequiredDate(body.dueDate, "截止日期");
  }
  if ("priority" in body) {
    input.priority = readPriority(body.priority);
  }
  if ("progress" in body) {
    input.progress = readProgress(body.progress);
  }
  if ("description" in body) {
    input.description = readOptionalString(body.description);
  }
  if ("assigneeName" in body) {
    input.assigneeName = readOptionalString(body.assigneeName);
  }

  return input;
}

function parseMoveTask(body: unknown): MoveTaskRequest {
  if (!isRecord(body)) {
    throw new ValidationError("请求体格式错误");
  }

  const position = body.position === undefined ? undefined : readPosition(body.position);
  return {
    columnId: readRequiredString(body.columnId, "任务列"),
    position
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${label}不能为空`);
  }
  return value.trim();
}

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new ValidationError("文本字段格式错误");
  }
  return value.trim();
}

function readRequiredDate(value: unknown, label: string) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new ValidationError(`${label}格式应为 YYYY-MM-DD`);
  }
  return value;
}

function readPriority(value: unknown) {
  if (typeof value !== "string" || !PRIORITIES.includes(value as any)) {
    throw new ValidationError("优先级格式错误");
  }
  return value as CreateTaskRequest["priority"];
}

function readProgress(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new ValidationError("进度必须是 0 到 100 的整数");
  }
  return value;
}

function readPosition(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError("排序位置必须是非负整数");
  }
  return value;
}

function assertDateRange(startDate: string, dueDate: string) {
  if (Date.parse(`${startDate}T00:00:00.000Z`) > Date.parse(`${dueDate}T00:00:00.000Z`)) {
    throw new ValidationError("开始日期不能晚于截止日期");
  }
}
