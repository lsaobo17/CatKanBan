import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DropAnimation,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  type AnimateLayoutChanges,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Dropdown, Progress, Tag, Tooltip, Typography } from "antd";
import { CalendarDays, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoardColumn, BoardPayload, MoveTaskRequest, Priority, Task } from "../../../../packages/shared/src/index";
import { applyTaskMove } from "../utils/boardMove";
import { resolveFinalTaskMove, resolveTaskMove } from "./board/drag";

const priorityLabels: Record<Priority, { label: string; color: string }> = {
  low: { label: "低", color: "blue" },
  medium: { label: "中", color: "gold" },
  high: { label: "高", color: "orange" },
  urgent: { label: "紧急", color: "red" }
};

const pointerAwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
};

const DROP_SETTLE_MS = 210;

const taskCardSortingTransition = {
  duration: 150,
  easing: "cubic-bezier(0.2, 0, 0, 1)"
};

const animateTaskLayoutChanges: AnimateLayoutChanges = (args) => {
  if (args.isSorting) {
    return true;
  }

  return defaultAnimateLayoutChanges(args);
};

const dragOverlaySpringDropAnimation: DropAnimation = {
  duration: DROP_SETTLE_MS,
  easing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0",
        visibility: "hidden"
      }
    }
  }),
  keyframes({ transform }) {
    const { initial, final } = transform;
    return [
      {
        opacity: 0.98,
        transform: CSS.Transform.toString(initial)
      },
      {
        offset: 0.68,
        opacity: 1,
        transform: CSS.Transform.toString({ ...final, scaleX: final.scaleX * 1.018, scaleY: final.scaleY * 0.982 })
      },
      {
        offset: 0.86,
        opacity: 1,
        transform: CSS.Transform.toString({ ...final, scaleX: final.scaleX * 0.992, scaleY: final.scaleY * 1.008 })
      },
      {
        opacity: 1,
        transform: CSS.Transform.toString(final)
      }
    ];
  }
};

interface BoardViewProps {
  board: BoardPayload;
  moving: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onMoveTask: (payload: { id: string } & MoveTaskRequest) => void;
}

export function BoardView({ board, moving, onEditTask, onDeleteTask, onMoveTask }: BoardViewProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [previewBoard, setPreviewBoard] = useState<BoardPayload | null>(null);
  const [overlayTask, setOverlayTask] = useState<Task | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(null);
  const clearOverlayFrameRef = useRef<number | null>(null);
  const clearPreviewTimeoutRef = useRef<number | null>(null);
  const dragStartBoardRef = useRef<BoardPayload | null>(null);
  const latestPreviewBoardRef = useRef<BoardPayload | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const renderedBoard = previewBoard ?? board;
  const overlayStyle = useMemo<CSSProperties | undefined>(
    () => (overlayWidth ? { width: overlayWidth } : undefined),
    [overlayWidth]
  );

  const clearActiveTask = useCallback((keepPreviewUntilDropSettles: boolean) => {
    if (clearOverlayFrameRef.current !== null) {
      window.cancelAnimationFrame(clearOverlayFrameRef.current);
    }
    clearOverlayFrameRef.current = window.requestAnimationFrame(() => {
      clearOverlayFrameRef.current = null;
      setActiveTaskId(null);
      setOverlayTask(null);
      setOverlayWidth(null);
      dragStartBoardRef.current = null;
      latestPreviewBoardRef.current = null;

      if (clearPreviewTimeoutRef.current !== null) {
        window.clearTimeout(clearPreviewTimeoutRef.current);
        clearPreviewTimeoutRef.current = null;
      }

      if (keepPreviewUntilDropSettles) {
        clearPreviewTimeoutRef.current = window.setTimeout(() => {
          clearPreviewTimeoutRef.current = null;
          setPreviewBoard(null);
        }, DROP_SETTLE_MS);
        return;
      }

      setPreviewBoard(null);
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-board-dragging", Boolean(activeTaskId));
    return () => {
      document.body.classList.remove("is-board-dragging");
      if (clearOverlayFrameRef.current !== null) {
        window.cancelAnimationFrame(clearOverlayFrameRef.current);
      }
      if (clearPreviewTimeoutRef.current !== null) {
        window.clearTimeout(clearPreviewTimeoutRef.current);
      }
    };
  }, [activeTaskId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (clearOverlayFrameRef.current !== null) {
      window.cancelAnimationFrame(clearOverlayFrameRef.current);
      clearOverlayFrameRef.current = null;
    }
    if (clearPreviewTimeoutRef.current !== null) {
      window.clearTimeout(clearPreviewTimeoutRef.current);
      clearPreviewTimeoutRef.current = null;
    }
    const taskId = String(event.active.id);
    dragStartBoardRef.current = board;
    latestPreviewBoardRef.current = board;
    setPreviewBoard(board);
    setOverlayTask(findTask(board, taskId));
    setOverlayWidth(event.active.rect.current.initial?.width ?? null);
    setDropAnimation(null);
    setActiveTaskId(taskId);
  }, [board]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    if (!overId) {
      return;
    }

    const taskId = String(event.active.id);
    const currentBoard = latestPreviewBoardRef.current ?? dragStartBoardRef.current ?? board;
    const payload = resolveTaskMove(currentBoard, taskId, String(overId));
    if (!payload) {
      return;
    }

    const nextBoard = applyTaskMove(currentBoard, payload);
    latestPreviewBoardRef.current = nextBoard;
    setPreviewBoard(nextBoard);
  }, [board]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const startBoard = dragStartBoardRef.current ?? board;
    const finalBoard = latestPreviewBoardRef.current ?? previewBoard ?? startBoard;
    const payload = resolveFinalTaskMove(startBoard, finalBoard, taskId);

    if (payload) {
      setDropAnimation(dragOverlaySpringDropAnimation);
      onMoveTask(payload);
    } else {
      setDropAnimation(null);
    }

    clearActiveTask(Boolean(payload));
  }, [board, clearActiveTask, onMoveTask, previewBoard]);

  const handleDragCancel = useCallback(() => {
    setDropAnimation(null);
    setPreviewBoard(null);
    setOverlayTask(null);
    setOverlayWidth(null);
    dragStartBoardRef.current = null;
    latestPreviewBoardRef.current = null;
    setActiveTaskId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerAwareCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board-grid" aria-busy={moving}>
        {renderedBoard.columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
      <DragOverlay adjustScale={false} dropAnimation={dropAnimation} style={overlayStyle}>
        {overlayTask ? <TaskDragOverlay task={overlayTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnViewProps {
  column: BoardColumn;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const BoardColumnView = memo(function BoardColumnView({ column, onEditTask, onDeleteTask }: BoardColumnViewProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id }
  });
  const taskIds = useMemo(() => column.tasks.map((task) => task.id), [column.tasks]);

  return (
    <section className={`board-column ${isOver ? "is-over" : ""}`} ref={setNodeRef}>
      <div className="column-header">
        <Typography.Text strong>{column.title}</Typography.Text>
        <Tag>{column.tasks.length}</Tag>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
          {column.tasks.length === 0 ? <div className="empty-column">暂无任务</div> : null}
        </div>
      </SortableContext>
    </section>
  );
});

interface TaskCardProps {
  task: Task;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const TaskCard = memo(function TaskCard({ task, onEditTask, onDeleteTask }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    animateLayoutChanges: animateTaskLayoutChanges,
    data: { type: "task", taskId: task.id },
    transition: taskCardSortingTransition
  });
  const style = useMemo<CSSProperties>(
    () => ({
      transform: isDragging ? undefined : CSS.Transform.toString(transform),
      transition: isDragging ? undefined : transition,
      willChange: transform ? "transform" : undefined
    }),
    [isDragging, transform, transition]
  );

  return (
    <article
      ref={setNodeRef}
      className={`task-card ${isDragging ? "is-dragging" : ""}`}
      style={style}
    >
      <div className="task-card-head">
        <button className="drag-handle" type="button" aria-label="拖拽任务" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <Typography.Text strong className="task-title">
          {task.title}
        </Typography.Text>
        <TaskCardActions task={task} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
      </div>
      <TaskCardDetails task={task} />
    </article>
  );
});

const TaskCardActions = memo(function TaskCardActions({ task, onEditTask, onDeleteTask }: TaskCardProps) {
  const menu = useMemo(
    () => ({
      items: [
        { key: "edit", label: "编辑", icon: <Pencil size={14} /> },
        { key: "delete", label: "删除", icon: <Trash2 size={14} />, danger: true }
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === "edit") {
          onEditTask(task);
        }
        if (key === "delete") {
          onDeleteTask(task);
        }
      }
    }),
    [onDeleteTask, onEditTask, task]
  );

  return (
    <Dropdown trigger={["click"]} menu={menu}>
      <Tooltip title="更多操作">
        <Button size="small" type="text" icon={<MoreHorizontal size={16} />} />
      </Tooltip>
    </Dropdown>
  );
});

const TaskCardDetails = memo(function TaskCardDetails({ task }: Pick<TaskCardProps, "task">) {
  const priority = priorityLabels[task.priority];

  return (
    <>
      {task.description ? <Typography.Paragraph className="task-description">{task.description}</Typography.Paragraph> : null}
      <div className="task-meta">
        <Tag color={priority.color}>{priority.label}</Tag>
        <span className="task-date">
          <CalendarDays size={14} />
          {task.startDate} 至 {task.dueDate}
        </span>
      </div>
      <div className="task-progress">
        <Progress percent={task.progress} size="small" />
      </div>
      <div className="task-footer">
        <span>{task.assigneeName || "未分配"}</span>
      </div>
    </>
  );
});

function TaskDragOverlay({ task }: Pick<TaskCardProps, "task">) {
  return (
    <article className="task-card task-card-overlay" aria-hidden="true">
      <div className="task-card-head">
        <span className="drag-handle drag-handle-preview">
          <GripVertical size={16} />
        </span>
        <Typography.Text strong className="task-title">
          {task.title}
        </Typography.Text>
        <span />
      </div>
      <TaskCardDetails task={task} />
    </article>
  );
}

function findTask(board: BoardPayload, taskId: string | null) {
  if (!taskId) {
    return null;
  }

  for (const column of board.columns) {
    const task = column.tasks.find((candidate) => candidate.id === taskId);
    if (task) {
      return task;
    }
  }

  return null;
}
