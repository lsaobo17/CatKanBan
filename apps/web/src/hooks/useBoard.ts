import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardPayload, CreateTaskRequest, MoveTaskRequest, UpdateTaskRequest } from "../../../../packages/shared/src/index";
import { api } from "../api/client";
import { applyTaskMove, type OptimisticTaskMove } from "../utils/boardMove";

const boardQueryKey = ["board"] as const;

export function useBoard() {
  return useQuery({
    queryKey: boardQueryKey,
    queryFn: api.getBoard
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskRequest) => api.createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardQueryKey })
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
      const previousBoard = queryClient.getQueryData<BoardPayload>(boardQueryKey);
      if (previousBoard) {
        queryClient.setQueryData<BoardPayload>(boardQueryKey, applyTaskMove(previousBoard, payload));
      }

      await queryClient.cancelQueries({ queryKey: boardQueryKey });

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
