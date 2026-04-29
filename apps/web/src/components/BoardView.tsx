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
  type DropAnimation,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Dropdown, Progress, Tag, Tooltip, Typography } from "antd";
import { CalendarDays, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoardColumn, BoardPayload, MoveTaskRequest, Priority, Task } from "../../../../packages/shared/src/index";
import { resolveTaskMove } from "./board/drag";

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

const DROP_SETTLE_MS = 320;

const dragOverlayJellyDropAnimation: DropAnimation = {
  duration: DROP_SETTLE_MS,
  easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
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
        offset: 0.72,
        opacity: 1,
        transform: CSS.Transform.toString({ ...final, scaleX: final.scaleX * 1.035, scaleY: final.scaleY * 0.965 })
      },
      {
        offset: 0.88,
        opacity: 1,
        transform: CSS.Transform.toString({ ...final, scaleX: final.scaleX * 0.985, scaleY: final.scaleY * 1.015 })
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
  const [settlingTaskId, setSettlingTaskId] = useState<string | null>(null);
  const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(null);
  const clearOverlayFrameRef = useRef<number | null>(null);
  const clearSettlingTimeoutRef = useRef<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const activeTask = useMemo(() => findTask(board, activeTaskId), [activeTaskId, board]);

  const clearActiveTask = useCallback(() => {
    if (clearOverlayFrameRef.current !== null) {
      window.cancelAnimationFrame(clearOverlayFrameRef.current);
    }
    clearOverlayFrameRef.current = window.requestAnimationFrame(() => {
      clearOverlayFrameRef.current = null;
      setActiveTaskId(null);
    });
  }, []);

  const settleDroppedTask = useCallback((taskId: string) => {
    if (clearSettlingTimeoutRef.current !== null) {
      window.clearTimeout(clearSettlingTimeoutRef.current);
    }
    setSettlingTaskId(taskId);
    clearSettlingTimeoutRef.current = window.setTimeout(() => {
      clearSettlingTimeoutRef.current = null;
      setSettlingTaskId(null);
    }, DROP_SETTLE_MS);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-board-dragging", Boolean(activeTaskId));
    return () => {
      document.body.classList.remove("is-board-dragging");
      if (clearOverlayFrameRef.current !== null) {
        window.cancelAnimationFrame(clearOverlayFrameRef.current);
      }
      if (clearSettlingTimeoutRef.current !== null) {
        window.clearTimeout(clearSettlingTimeoutRef.current);
      }
    };
  }, [activeTaskId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (clearOverlayFrameRef.current !== null) {
      window.cancelAnimationFrame(clearOverlayFrameRef.current);
      clearOverlayFrameRef.current = null;
    }
    if (clearSettlingTimeoutRef.current !== null) {
      window.clearTimeout(clearSettlingTimeoutRef.current);
      clearSettlingTimeoutRef.current = null;
    }
    setSettlingTaskId(null);
    setDropAnimation(null);
    setActiveTaskId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const taskId = String(event.active.id);
    if (event.over) {
      const payload = resolveTaskMove(board, taskId, String(event.over.id));
      if (payload) {
        const sourceTask = findTask(board, taskId);
        const statusChanged = sourceTask?.columnId !== payload.columnId;
        setDropAnimation(statusChanged ? dragOverlayJellyDropAnimation : null);
        onMoveTask(payload);
        if (statusChanged) {
          settleDroppedTask(taskId);
        }
      }
    }
    clearActiveTask();
  }, [board, clearActiveTask, onMoveTask, settleDroppedTask]);

  const handleDragCancel = useCallback(() => {
    setDropAnimation(null);
    setActiveTaskId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerAwareCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board-grid" aria-busy={moving}>
        {board.columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            settlingTaskId={settlingTaskId}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
      <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
        {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnViewProps {
  column: BoardColumn;
  settlingTaskId: string | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const BoardColumnView = memo(function BoardColumnView({ column, settlingTaskId, onEditTask, onDeleteTask }: BoardColumnViewProps) {
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
              settling={task.id === settlingTaskId}
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
  settling?: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const TaskCard = memo(function TaskCard({ task, settling = false, onEditTask, onDeleteTask }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", taskId: task.id }
  });
  const style = useMemo<CSSProperties>(
    () => ({
      transform: isDragging ? undefined : CSS.Transform.toString(transform),
      transition: isDragging ? undefined : transition,
      willChange: isDragging ? "transform" : undefined
    }),
    [isDragging, transform, transition]
  );

  return (
    <article
      ref={setNodeRef}
      className={`task-card ${isDragging ? "is-dragging" : ""} ${settling ? "is-drop-settling" : ""}`}
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
