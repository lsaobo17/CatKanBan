import {
  DEFAULT_COLUMNS,
  DEFAULT_PROJECT_ID,
  type BoardColumn,
  type BoardPayload,
  type CreateTaskRequest,
  type MoveTaskRequest,
  type Project,
  type Task
} from "../../../../packages/shared/src/index.js";
import type { Column, Prisma, PrismaClient, Project as PrismaProject, Task as PrismaTask } from "@prisma/client";
import { NotFoundError } from "../errors.js";
import type { BoardRepository, TaskUpdateData } from "./boardRepository.js";

export class PrismaBoardRepository implements BoardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async seedDefaultBoard() {
    await this.prisma.project.upsert({
      where: { id: DEFAULT_PROJECT_ID },
      update: {},
      create: {
        id: DEFAULT_PROJECT_ID,
        name: "CatKanBan 项目看板",
        description: "默认项目"
      }
    });

    await Promise.all(
      DEFAULT_COLUMNS.map((column) =>
        this.prisma.column.upsert({
          where: {
            projectId_key: {
              projectId: DEFAULT_PROJECT_ID,
              key: column.key
            }
          },
          update: {
            title: column.title,
            position: column.position
          },
          create: {
            projectId: DEFAULT_PROJECT_ID,
            key: column.key,
            title: column.title,
            position: column.position
          }
        })
      )
    );
  }

  async getBoard(): Promise<BoardPayload> {
    const project = await this.prisma.project.findUnique({
      where: { id: DEFAULT_PROJECT_ID },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" }
            }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundError("默认项目不存在");
    }

    return {
      project: mapProject(project),
      columns: project.columns.map(mapColumn)
    };
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    return task ? mapTask(task) : null;
  }

  async createTask(input: CreateTaskRequest): Promise<Task> {
    await this.ensureColumn(input.columnId);
    const position = await this.nextPosition(input.columnId);
    const task = await this.prisma.task.create({
      data: {
        projectId: DEFAULT_PROJECT_ID,
        columnId: input.columnId,
        title: input.title,
        description: input.description ?? "",
        startDate: toDate(input.startDate),
        dueDate: toDate(input.dueDate),
        priority: input.priority,
        progress: input.progress ?? 0,
        assigneeName: input.assigneeName ?? "",
        position
      }
    });
    return mapTask(task);
  }

  async updateTask(id: string, input: TaskUpdateData): Promise<Task> {
    await this.ensureTask(id);
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        startDate: input.startDate ? toDate(input.startDate) : undefined,
        dueDate: input.dueDate ? toDate(input.dueDate) : undefined,
        priority: input.priority,
        progress: input.progress,
        assigneeName: input.assigneeName
      }
    });
    return mapTask(task);
  }

  async moveTask(id: string, input: MoveTaskRequest): Promise<Task> {
    await this.ensureColumn(input.columnId);
    const task = await this.ensureTask(id);

    const moved = await this.prisma.$transaction(async (tx) => {
      const sourceColumnId = task.columnId;
      const targetTasks = await tx.task.findMany({
        where: { columnId: input.columnId, id: { not: id } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      });
      const position = Math.max(0, Math.min(input.position ?? targetTasks.length, targetTasks.length));
      targetTasks.splice(position, 0, { ...task, columnId: input.columnId });

      if (sourceColumnId !== input.columnId) {
        const sourceTasks = await tx.task.findMany({
          where: { columnId: sourceColumnId, id: { not: id } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }]
        });
        await this.reorderTasks(tx, sourceTasks);
      }

      await this.reorderTasks(tx, targetTasks, input.columnId);
      const updated = await tx.task.findUnique({ where: { id } });
      if (!updated) {
        throw new NotFoundError("任务不存在");
      }
      return updated;
    });

    return mapTask(moved);
  }

  async deleteTask(id: string) {
    const task = await this.ensureTask(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      const remaining = await tx.task.findMany({
        where: { columnId: task.columnId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      });
      await this.reorderTasks(tx, remaining);
    });
  }

  private async ensureColumn(columnId: string) {
    const column = await this.prisma.column.findUnique({ where: { id: columnId } });
    if (!column) {
      throw new NotFoundError("任务列不存在");
    }
    return column;
  }

  private async ensureTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundError("任务不存在");
    }
    return task;
  }

  private async nextPosition(columnId: string) {
    const aggregate = await this.prisma.task.aggregate({
      where: { columnId },
      _max: { position: true }
    });
    return (aggregate._max.position ?? -1) + 1;
  }

  private async reorderTasks(tx: Prisma.TransactionClient, tasks: PrismaTask[], forcedColumnId?: string) {
    await Promise.all(
      tasks.map((task, index) =>
        tx.task.update({
          where: { id: task.id },
          data: {
            columnId: forcedColumnId ?? task.columnId,
            position: index
          }
        })
      )
    );
  }
}

type PrismaColumnWithTasks = Column & { tasks: PrismaTask[] };

function mapProject(project: PrismaProject): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

function mapColumn(column: PrismaColumnWithTasks): BoardColumn {
  return {
    id: column.id,
    projectId: column.projectId,
    key: column.key as BoardColumn["key"],
    title: column.title,
    position: column.position,
    tasks: column.tasks.map(mapTask)
  };
}

function mapTask(task: PrismaTask): Task {
  return {
    id: task.id,
    projectId: task.projectId,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    startDate: toDateKey(task.startDate),
    dueDate: toDateKey(task.dueDate),
    priority: task.priority as Task["priority"],
    progress: task.progress,
    assigneeName: task.assigneeName,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
