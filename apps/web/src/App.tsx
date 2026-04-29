import { App as AntApp, Button, ConfigProvider, Empty, Segmented, Spin, Statistic, Tooltip, Typography } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ChartGantt, LayoutGrid, Plus, Settings } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { MoveTaskRequest, Task, UpdateTaskRequest, ViewMode } from "../../../packages/shared/src/index";
import { BoardView } from "./components/BoardView";
import { GanttView } from "./components/GanttView";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { TaskDrawer, type TaskFormValues } from "./components/TaskDrawer";
import { useBoard, useCreateTask, useDeleteTask, useMoveTask, useUpdateTask } from "./hooks/useBoard";
import { useUiStyle } from "./hooks/useUiStyle";
import { getUiStyleOption } from "./theme/uiStyles";
import "./styles.css";

export default function App() {
  const { message } = AntApp.useApp();
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [uiStyle, setUiStyle] = useUiStyle();
  const boardQuery = useBoard();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const moveTask = useMoveTask();
  const moveTaskMutate = moveTask.mutate;
  const deleteTask = useDeleteTask();

  const tasks = useMemo(
    () => boardQuery.data?.columns.flatMap((column) => column.tasks) ?? [],
    [boardQuery.data]
  );
  const completionRate =
    tasks.length === 0 ? 0 : Math.round(tasks.reduce((total, task) => total + task.progress, 0) / tasks.length);
  const uiStyleOption = getUiStyleOption(uiStyle);

  const openCreateDrawer = useCallback(() => {
    setEditingTask(null);
    setDrawerOpen(true);
  }, []);

  const openEditDrawer = useCallback((task: Task) => {
    setEditingTask(task);
    setDrawerOpen(true);
  }, []);

  const handleSubmit = useCallback(async (values: TaskFormValues) => {
    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, input: values as UpdateTaskRequest });
      message.success("任务已更新");
    } else {
      await createTask.mutateAsync(values);
      message.success("任务已创建");
    }
    setDrawerOpen(false);
    setEditingTask(null);
  }, [createTask, editingTask, message, updateTask]);

  const handleDelete = useCallback(async (task: Task) => {
    await deleteTask.mutateAsync(task.id);
    message.success("任务已删除");
  }, [deleteTask, message]);

  const handleMoveTask = useCallback((payload: { id: string } & MoveTaskRequest) => {
    moveTaskMutate(payload);
  }, [moveTaskMutate]);

  const content = () => {
    if (boardQuery.isLoading) {
      return (
        <div className="state-panel">
          <Spin />
        </div>
      );
    }

    if (boardQuery.error || !boardQuery.data) {
      return (
        <div className="state-panel">
          <Empty description="看板数据加载失败" />
        </div>
      );
    }

    if (viewMode === "gantt") {
      return <GanttView board={boardQuery.data} onEditTask={openEditDrawer} />;
    }

    return (
      <BoardView
        board={boardQuery.data}
        moving={moveTask.isPending}
        onEditTask={openEditDrawer}
        onDeleteTask={handleDelete}
        onMoveTask={handleMoveTask}
      />
    );
  };

  return (
    <ConfigProvider locale={zhCN} theme={uiStyleOption.theme}>
      <div className="app-shell">
        <header className="app-header">
          <div>
            <Typography.Title level={2} className="app-title">
              {boardQuery.data?.project.name ?? "CatKanBan 项目看板"}
            </Typography.Title>
            <Typography.Text type="secondary">单项目任务计划、状态推进和时间线跟踪</Typography.Text>
          </div>

          <div className="header-actions">
            <div className="header-stats">
              <Statistic title="任务" value={tasks.length} />
              <Statistic title="平均进度" value={completionRate} suffix="%" />
            </div>
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              options={[
                {
                  value: "board",
                  label: (
                    <span className="segmented-label">
                      <LayoutGrid size={16} />
                      看板
                    </span>
                  )
                },
                {
                  value: "gantt",
                  label: (
                    <span className="segmented-label">
                      <ChartGantt size={16} />
                      甘特图
                    </span>
                  )
                }
              ]}
            />
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreateDrawer}>
              新建任务
            </Button>
            <Tooltip title="界面设置">
              <Button
                aria-label="界面设置"
                icon={<Settings size={16} />}
                onClick={() => setSettingsOpen(true)}
              />
            </Tooltip>
          </div>
        </header>

        <main className="app-main">{content()}</main>

        <TaskDrawer
          open={drawerOpen}
          task={editingTask}
          columns={boardQuery.data?.columns ?? []}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleSubmit}
        />
        <SettingsDrawer
          open={settingsOpen}
          uiStyle={uiStyle}
          onChange={setUiStyle}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </ConfigProvider>
  );
}
