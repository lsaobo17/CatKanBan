import type { BoardPayload, MoveTaskRequest, Task } from "../../../../../packages/shared/src/index";

export type TaskMovePayload = { id: string } & MoveTaskRequest;

export function createTaskMoveHandler(board: BoardPayload, onMoveTask: (payload: TaskMovePayload) => void) {
  return (activeId: string, overId: string) => {
    const payload = resolveTaskMove(board, activeId, overId);
    if (payload) {
      onMoveTask(payload);
    }
  };
}

export function resolveTaskMove(board: BoardPayload, activeId: string, overId: string): TaskMovePayload | null {
  if (activeId === overId) {
    return null;
  }

  const activeTask = findTask(board, activeId);
  if (!activeTask) {
    return null;
  }

  const overTask = findTask(board, overId);
  const overColumn = board.columns.find((column) => column.id === overId);
  const targetColumnId = overTask?.columnId ?? overColumn?.id;
  if (!targetColumnId) {
    return null;
  }

  const targetColumn = board.columns.find((column) => column.id === targetColumnId);
  if (!targetColumn) {
    return null;
  }

  const targetTasks = targetColumn.tasks.filter((task) => task.id !== activeId);
  const position = overTask ? Math.max(0, targetTasks.findIndex((task) => task.id === overTask.id)) : targetTasks.length;

  if (activeTask.columnId === targetColumnId && activeTask.position === position) {
    return null;
  }

  return {
    id: activeId,
    columnId: targetColumnId,
    position
  };
}

function findTask(board: BoardPayload, taskId: string): Task | undefined {
  return board.columns.flatMap((column) => column.tasks).find((task) => task.id === taskId);
}
