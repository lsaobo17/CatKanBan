import { Button, Empty, Tag, Tooltip, Typography } from "antd";
import { Pencil } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import type { BoardPayload, ColumnKey, Priority, Task } from "../../../../packages/shared/src/index";
import { buildTimeline, daysBetween } from "../utils/gantt";

const priorityLabels: Record<Priority, { label: string; color: string }> = {
  low: { label: "低", color: "blue" },
  medium: { label: "中", color: "gold" },
  high: { label: "高", color: "orange" },
  urgent: { label: "紧急", color: "red" }
};

interface GanttViewProps {
  board: BoardPayload;
  onEditTask: (task: Task) => void;
}

export function GanttView({ board, onEditTask }: GanttViewProps) {
  const tasks = board.columns.flatMap((column) => column.tasks);
  const timeline = buildTimeline(tasks);
  const todayIndex = timeline.days.findIndex((day) => day.isToday);
  const columnKeyById = useMemo(
    () => new Map(board.columns.map((column) => [column.id, column.key])),
    [board.columns]
  );

  if (tasks.length === 0) {
    return (
      <div className="state-panel">
        <Empty description="暂无可展示的时间线任务" />
      </div>
    );
  }

  return (
    <section className="gantt-shell">
      <div
        className="gantt-grid"
        style={
          {
            "--day-count": timeline.days.length
          } as CSSProperties
        }
      >
        <div className="gantt-sidebar gantt-header-cell">任务</div>
        {timeline.days.map((day) => (
          <div key={`week-${day.key}`} className={`gantt-week-cell ${day.isWeekStart ? "week-start" : ""}`}>
            {day.isWeekStart ? day.weekLabel : ""}
          </div>
        ))}
        <div className="gantt-sidebar gantt-header-cell">时间</div>
        {timeline.days.map((day) => (
          <div key={day.key} className={`gantt-day-cell ${day.isToday ? "today" : ""}`}>
            <span>{day.label}</span>
          </div>
        ))}

        {tasks.map((task) => {
          const offset = daysBetween(timeline.startDate, task.startDate);
          const duration = daysBetween(task.startDate, task.dueDate) + 1;
          const priority = priorityLabels[task.priority];
          const columnKey: ColumnKey = columnKeyById.get(task.columnId) ?? "todo";

          return (
            <div className="gantt-row" key={task.id}>
              <div className="gantt-task-name">
                <div>
                  <Typography.Text strong>{task.title}</Typography.Text>
                  <div className="gantt-task-meta">
                    <Tag color={priority.color}>{priority.label}</Tag>
                    <span>{task.assigneeName || "未分配"}</span>
                  </div>
                </div>
                <Tooltip title="编辑任务">
                  <Button size="small" type="text" icon={<Pencil size={15} />} onClick={() => onEditTask(task)} />
                </Tooltip>
              </div>
              {timeline.days.map((day) => (
                <div key={`${task.id}-${day.key}`} className={`gantt-track-cell ${day.isToday ? "today" : ""}`} />
              ))}
              <Tooltip title={`${task.startDate} 至 ${task.dueDate}，进度 ${task.progress}%`}>
                <div
                  className={`gantt-bar gantt-bar-status-${columnKey}`}
                  style={{ gridColumn: `${offset + 2} / span ${duration}` }}
                >
                  <span className="gantt-bar-fill" style={{ width: `${task.progress}%` }} />
                  <span className="gantt-bar-label">{task.progress}%</span>
                </div>
              </Tooltip>
            </div>
          );
        })}

        {todayIndex >= 0 ? (
          <div className="today-line" style={{ gridColumn: `${todayIndex + 2}` }}>
            <span>今天</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
