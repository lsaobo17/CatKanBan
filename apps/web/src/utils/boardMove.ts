import type { BoardPayload, MoveTaskRequest, Task } from "../../../../packages/shared/src/index";

export type OptimisticTaskMove = { id: string } & MoveTaskRequest;

export function applyTaskCreate(board: BoardPayload, task: Task): BoardPayload {
  return placeTaskInBoard(board, task.id, task);
}

export function replaceTaskInBoard(board: BoardPayload, taskId: string, task: Task): BoardPayload {
  return placeTaskInBoard(board, taskId, task);
}

export function removeTaskFromBoard(board: BoardPayload, taskId: string): BoardPayload {
  let removed = false;

  const columns = board.columns.map((column) => {
    const tasks = column.tasks.filter((task) => task.id !== taskId);
    if (tasks.length === column.tasks.length) {
      return column;
    }
    removed = true;
    return { ...column, tasks: reindexTasks(tasks) };
  });

  return removed ? { ...board, columns } : board;
}

export function applyTaskMove(board: BoardPayload, input: OptimisticTaskMove): BoardPayload {
  const sourceColumn = board.columns.find((column) => column.tasks.some((task) => task.id === input.id));
  const targetColumn = board.columns.find((column) => column.id === input.columnId);

  if (!sourceColumn || !targetColumn) {
    return board;
  }

  const task = sourceColumn.tasks.find((candidate) => candidate.id === input.id);
  if (!task) {
    return board;
  }

  const targetTasks = targetColumn.tasks.filter((candidate) => candidate.id !== input.id);
  const position = Math.max(0, Math.min(input.position ?? targetTasks.length, targetTasks.length));
  const movedTask: Task = { ...task, columnId: input.columnId };

  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.id === sourceColumn.id && column.id === targetColumn.id) {
        const tasks = column.tasks.filter((candidate) => candidate.id !== input.id);
        tasks.splice(position, 0, movedTask);
        return { ...column, tasks: reindexTasks(tasks) };
      }

      if (column.id === sourceColumn.id) {
        return { ...column, tasks: reindexTasks(column.tasks.filter((candidate) => candidate.id !== input.id)) };
      }

      if (column.id === targetColumn.id) {
        const tasks = column.tasks.filter((candidate) => candidate.id !== input.id);
        tasks.splice(position, 0, movedTask);
        return { ...column, tasks: reindexTasks(tasks) };
      }

      return column;
    })
  };
}

function placeTaskInBoard(board: BoardPayload, taskId: string, task: Task): BoardPayload {
  const targetColumn = board.columns.find((column) => column.id === task.columnId);
  if (!targetColumn) {
    return board;
  }

  return {
    ...board,
    columns: board.columns.map((column) => {
      const tasksWithoutTask = column.tasks.filter((candidate) => candidate.id !== taskId && candidate.id !== task.id);

      if (column.id !== task.columnId) {
        return tasksWithoutTask.length === column.tasks.length
          ? column
          : { ...column, tasks: reindexTasks(tasksWithoutTask) };
      }

      const position = Math.max(0, Math.min(task.position, tasksWithoutTask.length));
      const tasks = [...tasksWithoutTask];
      tasks.splice(position, 0, { ...task, position });
      return { ...column, tasks: reindexTasks(tasks) };
    })
  };
}

function reindexTasks(tasks: Task[]) {
  return tasks.map((task, position) => (task.position === position ? task : { ...task, position }));
}
