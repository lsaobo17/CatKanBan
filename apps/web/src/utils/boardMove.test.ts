import type { BoardPayload } from "../../../../packages/shared/src/index";
import { describe, expect, it } from "vitest";
import { applyTaskCreate, applyTaskMove, removeTaskFromBoard, replaceTaskInBoard } from "./boardMove";

const board: BoardPayload = {
  project: {
    id: "default-project",
    name: "测试项目",
    description: "",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  },
  users: [],
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
          title: "任务一",
          description: "",
          startDate: "2026-05-01",
          dueDate: "2026-05-02",
          priority: "medium",
          progress: 0,
          assigneeId: null,
          assigneeName: "",
          position: 0,
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z"
        },
        {
          id: "task-2",
          projectId: "default-project",
          columnId: "column-todo",
          title: "任务二",
          description: "",
          startDate: "2026-05-03",
          dueDate: "2026-05-04",
          priority: "high",
          progress: 30,
          assigneeId: null,
          assigneeName: "",
          position: 1,
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z"
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
          id: "task-3",
          projectId: "default-project",
          columnId: "column-doing",
          title: "任务三",
          description: "",
          startDate: "2026-05-05",
          dueDate: "2026-05-06",
          priority: "low",
          progress: 10,
          assigneeId: null,
          assigneeName: "",
          position: 0,
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z"
        }
      ]
    },
    { id: "column-blocked", projectId: "default-project", key: "blocked", title: "阻塞", position: 2, tasks: [] },
    { id: "column-done", projectId: "default-project", key: "done", title: "已完成", position: 3, tasks: [] }
  ]
};

describe("applyTaskMove", () => {
  it("moves a task into the target column immediately", () => {
    const nextBoard = applyTaskMove(board, { id: "task-1", columnId: "column-doing", position: 1 });

    expect(nextBoard.columns[0].tasks.map((task) => [task.id, task.position])).toEqual([["task-2", 0]]);
    expect(nextBoard.columns[1].tasks.map((task) => [task.id, task.columnId, task.position])).toEqual([
      ["task-3", "column-doing", 0],
      ["task-1", "column-doing", 1]
    ]);
  });

  it("reorders within the same column without duplicating the task", () => {
    const nextBoard = applyTaskMove(board, { id: "task-1", columnId: "column-todo", position: 1 });

    expect(nextBoard.columns[0].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-2", 0],
      ["task-1", 1]
    ]);
  });

  it("clamps negative target positions to the start of the target column", () => {
    const nextBoard = applyTaskMove(board, { id: "task-2", columnId: "column-doing", position: -10 });

    expect(nextBoard.columns[1].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-2", 0],
      ["task-3", 1]
    ]);
  });

  it("clamps oversized target positions to the end of the target column", () => {
    const nextBoard = applyTaskMove(board, { id: "task-1", columnId: "column-doing", position: 99 });

    expect(nextBoard.columns[1].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-3", 0],
      ["task-1", 1]
    ]);
  });

  it("adds an optimistically created task at the end of its column", () => {
    const nextBoard = applyTaskCreate(board, {
      ...board.columns[0].tasks[0],
      id: "optimistic-task-1",
      title: "Optimistic task",
      position: 2
    });

    expect(nextBoard.columns[0].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-1", 0],
      ["task-2", 1],
      ["optimistic-task-1", 2]
    ]);
  });

  it("replaces an optimistic task with the server task without duplicating it", () => {
    const optimisticBoard = applyTaskCreate(board, {
      ...board.columns[0].tasks[0],
      id: "optimistic-task-1",
      title: "Optimistic task",
      position: 2
    });
    const nextBoard = replaceTaskInBoard(optimisticBoard, "optimistic-task-1", {
      ...board.columns[0].tasks[0],
      id: "task-created",
      title: "Created task",
      position: 2
    });

    expect(nextBoard.columns[0].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-1", 0],
      ["task-2", 1],
      ["task-created", 2]
    ]);
  });

  it("removes an optimistic task and reindexes the column after create failure", () => {
    const optimisticBoard = applyTaskCreate(board, {
      ...board.columns[0].tasks[0],
      id: "optimistic-task-1",
      title: "Optimistic task",
      position: 1
    });
    const nextBoard = removeTaskFromBoard(optimisticBoard, "optimistic-task-1");

    expect(nextBoard.columns[0].tasks.map((task) => [task.id, task.position])).toEqual([
      ["task-1", 0],
      ["task-2", 1]
    ]);
  });
});
