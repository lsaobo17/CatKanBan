import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardPayload, CreateTaskRequest, MoveTaskRequest, Task, UpdateTaskRequest } from "../../../../packages/shared/src/index";
import { api } from "../api/client";
import {
  applyTaskCreate,
  applyTaskMove,
  removeTaskFromBoard,
  replaceTaskInBoard,
  type OptimisticTaskMove
} from "../utils/boardMove";

const boardQueryKey = ["board"] as const;
let optimisticTaskSequence = 0;

export function useBoard(enabled = true) {
  return useQuery({
    queryKey: boardQueryKey,
    queryFn: api.getBoard,
    enabled
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskRequest) => api.createTask(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });

      const previousBoard = queryClient.getQueryData<BoardPayload>(boardQueryKey);
      const optimisticTask = previousBoard ? createOptimisticTask(previousBoard, input) : null;
      if (previousBoard && optimisticTask) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, applyTaskCreate(previousBoard, optimisticTask));
      }

      return { previousBoard, optimisticTaskId: optimisticTask?.id };
    },
    onError: (_error, _input, context) => {
      const optimisticTaskId = context?.optimisticTaskId;
      if (optimisticTaskId) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, (currentBoard) =>
          currentBoard ? removeTaskFromBoard(currentBoard, optimisticTaskId) : currentBoard
        );
        return;
      }

      if (context?.previousBoard) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, context.previousBoard);
      }
    },
    onSuccess: (task, _input, context) => {
      const optimisticTaskId = context?.optimisticTaskId;
      queryClient.setQueryData<BoardPayload>(boardQueryKey, (currentBoard) => {
        if (!currentBoard) {
          return currentBoard;
        }
        return optimisticTaskId ? replaceTaskInBoard(currentBoard, optimisticTaskId, task) : applyTaskCreate(currentBoard, task);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey })
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskRequest }) => api.updateTask(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardQueryKey })
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & MoveTaskRequest) => api.moveTask(id, input),
    onMutate: async (payload: OptimisticTaskMove) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });

      const previousBoard = queryClient.getQueryData<BoardPayload>(boardQueryKey);
      if (previousBoard) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, applyTaskMove(previousBoard, payload));
      }

      return { previousBoard };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, context.previousBoard);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey })
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardQueryKey })
  });
}

function createOptimisticTask(board: BoardPayload, input: CreateTaskRequest): Task | null {
  const column = board.columns.find((candidate) => candidate.id === input.columnId);
  if (!column) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const assignee = input.assigneeId ? board.users.find((user) => user.id === input.assigneeId) : null;

  return {
    id: `optimistic-task-${Date.now()}-${optimisticTaskSequence++}`,
    projectId: board.project.id,
    columnId: input.columnId,
    title: input.title,
    description: input.description ?? "",
    startDate: input.startDate,
    dueDate: input.dueDate,
    priority: input.priority,
    progress: input.progress ?? 0,
    assigneeId: input.assigneeId ?? null,
    assigneeName: assignee?.name ?? input.assigneeName ?? "",
    position: column.tasks.length,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
