import type { BoardPayload } from "../../../../../packages/shared/src/index";
import { describe, expect, it, vi } from "vitest";
import { applyTaskMove } from "../../utils/boardMove";
import { createTaskMoveHandler, resolveFinalTaskMove, resolveTaskMove } from "./drag";

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
          title: "任务二",
          description: "",
          startDate: "2026-05-03",
          dueDate: "2026-05-04",
          priority: "high",
          progress: 30,
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

describe("drag helpers", () => {
  it("resolves task drops into move requests", () => {
    expect(resolveTaskMove(board, "task-1", "task-2")).toEqual({
      id: "task-1",
      columnId: "column-doing",
      position: 0
    });
  });

  it("calls the move handler after a drag target is resolved", () => {
    const onMoveTask = vi.fn();
    const handler = createTaskMoveHandler(board, onMoveTask);

    handler("task-1", "column-done");

    expect(onMoveTask).toHaveBeenCalledWith({
      id: "task-1",
      columnId: "column-done",
      position: 0
    });
  });

  it("resolves the final move from a cross-column drag preview", () => {
    const previewBoard = applyTaskMove(board, { id: "task-1", columnId: "column-doing", position: 0 });

    expect(resolveFinalTaskMove(board, previewBoard, "task-1")).toEqual({
      id: "task-1",
      columnId: "column-doing",
      position: 0
    });
  });

  it("resolves the final move from a same-column drag preview", () => {
    const twoTaskBoard: BoardPayload = {
      ...board,
      columns: board.columns.map((column) =>
        column.id === "column-todo"
          ? {
              ...column,
              tasks: [
                column.tasks[0],
                {
                  ...column.tasks[0],
                  id: "task-1b",
                  title: "Second task",
                  position: 1
                }
              ]
            }
          : column
      )
    };
    const previewBoard = applyTaskMove(twoTaskBoard, { id: "task-1", columnId: "column-todo", position: 1 });

    expect(resolveFinalTaskMove(twoTaskBoard, previewBoard, "task-1")).toEqual({
      id: "task-1",
      columnId: "column-todo",
      position: 1
    });
  });

  it("does not submit a move when the preview returns to the original slot", () => {
    expect(resolveFinalTaskMove(board, board, "task-1")).toBeNull();
  });
});
