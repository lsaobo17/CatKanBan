import type { Task } from "../../../../packages/shared/src/index";
import { describe, expect, it } from "vitest";
import { buildTimeline, daysBetween } from "./gantt";

const task: Task = {
  id: "task-1",
  projectId: "default-project",
  columnId: "column-todo",
  title: "测试任务",
  description: "",
  startDate: "2026-05-03",
  dueDate: "2026-05-05",
  priority: "medium",
  progress: 20,
  assigneeName: "",
  position: 0,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

describe("gantt utils", () => {
  it("builds a padded timeline range", () => {
    const timeline = buildTimeline([task], "2026-05-04");

    expect(timeline.startDate).toBe("2026-05-01");
    expect(timeline.endDate).toBe("2026-05-07");
    expect(timeline.days).toHaveLength(7);
    expect(timeline.days.some((day) => day.isToday)).toBe(true);
  });

  it("calculates inclusive task duration inputs", () => {
    expect(daysBetween("2026-05-03", "2026-05-05") + 1).toBe(3);
  });
});
