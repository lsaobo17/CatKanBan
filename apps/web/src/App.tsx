import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntApp, Button, ConfigProvider, Empty, Segmented, Spin, Statistic, Tooltip, Typography } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ChartGantt, LayoutGrid, LogOut, Plus, Settings, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { AuthMePayload, MoveTaskRequest, Task, UpdateTaskRequest, ViewMode } from "../../../packages/shared/src/index";
import { ApiUnauthorizedError, api } from "./api/client";
import { BoardView } from "./components/BoardView";
import { GanttView } from "./components/GanttView";
import { LoginPage } from "./components/LoginPage";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { TaskDrawer, type TaskFormValues } from "./components/TaskDrawer";
import { UserManagementDrawer } from "./components/UserManagementDrawer";
import { useBoard, useCreateTask, useDeleteTask, useMoveTask, useUpdateTask } from "./hooks/useBoard";
import { useUiStyle } from "./hooks/useUiStyle";
import { getUiStyleOption } from "./theme/uiStyles";
import "./styles.css";

const authQueryKey = ["auth", "me"] as const;

export default function App() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [uiStyle, setUiStyle] = useUiStyle();

  const authQuery = useQuery<AuthMePayload | null>({
    queryKey: authQueryKey,
    queryFn: api.getMe,
    retry: false
  });
  const currentUser = authQuery.data?.user;
  const boardQuery = useBoard(Boolean(currentUser));
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const moveTask = useMoveTask();
  const moveTaskMutate = moveTask.mutate;
  const deleteTask = useDeleteTask();

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: (payload: AuthMePayload) => {
      queryClient.setQueryData<AuthMePayload | null>(authQueryKey, payload);
      queryClient.invalidateQueries({ queryKey: ["board"] });
      message.success("登录成功");
    },
    onError: (error) => {
      if (error instanceof ApiUnauthorizedError) {
        message.error("用户名或密码错误");
        return;
      }
      message.error("登录失败，请稍后重试");
    }
  });

  const resetAuthenticatedState = useCallback(() => {
    setDrawerOpen(false);
    setSettingsOpen(false);
    setUsersOpen(false);
    setEditingTask(null);
    queryClient.setQueryData<AuthMePayload | null>(authQueryKey, null);
    queryClient.removeQueries({ queryKey: ["board"] });
    queryClient.removeQueries({ queryKey: ["admin-users"] });
  }, [queryClient]);

  const logout = useMutation({
    mutationFn: api.logout,
    onMutate: async () => {
      await queryClient.cancelQueries();
    },
    onSettled: () => {
      resetAuthenticatedState();
    }
  });

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
      try {
        await updateTask.mutateAsync({ id: editingTask.id, input: values as UpdateTaskRequest });
        message.success("任务已更新");
        setDrawerOpen(false);
        setEditingTask(null);
      } catch {
        message.error("任务更新失败，请稍后重试");
      }
      return;
    }

    const createPromise = createTask.mutateAsync(values);
    setDrawerOpen(false);
    setEditingTask(null);

    try {
      await createPromise;
      message.success("任务已创建");
    } catch {
      message.error("任务创建失败，请稍后重试");
    }
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

  if (authQuery.isLoading) {
    return (
      <ConfigProvider locale={zhCN} theme={uiStyleOption.theme}>
        <div className="state-panel app-loading">
          <Spin />
        </div>
      </ConfigProvider>
    );
  }

  if (!currentUser) {
    return (
      <ConfigProvider locale={zhCN} theme={uiStyleOption.theme}>
        <LoginPage
          loading={login.isPending}
          onLogin={async (values) => {
            try {
              await login.mutateAsync(values);
            } catch {
              // Login errors are surfaced through the mutation message handler.
            }
          }}
        />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN} theme={uiStyleOption.theme}>
      <div className="app-shell">
        <header className="app-header">
          <div>
            <Typography.Title level={2} className="app-title">
              {boardQuery.data?.project.name ?? "CatKanBan"}
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
            {currentUser.role === "admin" ? (
              <Tooltip title="用户管理">
                <Button aria-label="用户管理" icon={<Users size={16} />} onClick={() => setUsersOpen(true)} />
              </Tooltip>
            ) : null}
            <Tooltip title="界面设置">
              <Button aria-label="界面设置" icon={<Settings size={16} />} onClick={() => setSettingsOpen(true)} />
            </Tooltip>
            <div className="current-user">
              <Typography.Text strong>{currentUser.name}</Typography.Text>
              <Typography.Text type="secondary">{currentUser.role === "admin" ? "管理员" : "成员"}</Typography.Text>
            </div>
            <Tooltip title="退出登录">
              <Button aria-label="退出登录" icon={<LogOut size={16} />} loading={logout.isPending} onClick={() => logout.mutate()} />
            </Tooltip>
          </div>
        </header>

        <main className="app-main">{content()}</main>

        <TaskDrawer
          open={drawerOpen}
          task={editingTask}
          columns={boardQuery.data?.columns ?? []}
          users={boardQuery.data?.users ?? []}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleSubmit}
        />
        <SettingsDrawer
          open={settingsOpen}
          uiStyle={uiStyle}
          onChange={setUiStyle}
          onClose={() => setSettingsOpen(false)}
        />
        <UserManagementDrawer open={usersOpen} onClose={() => setUsersOpen(false)} />
      </div>
    </ConfigProvider>
  );
}
