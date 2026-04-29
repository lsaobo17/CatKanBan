import type { BoardPayload, MoveTaskRequest, Task } from "../../../../packages/shared/src/index";

export type OptimisticTaskMove = { id: string } & MoveTaskRequest;

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

function reindexTasks(tasks: Task[]) {
  return tasks.map((task, position) => (task.position === position ? task : { ...task, position }));
}
