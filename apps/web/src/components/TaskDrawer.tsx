import { Button, DatePicker, Drawer, Form, Input, Select, Slider, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect } from "react";
import type {
  BoardColumn,
  CreateTaskRequest,
  Priority,
  Task,
  UserSummary
} from "../../../../packages/shared/src/index";
import { validateDateRange } from "../utils/validation";

export type TaskFormValues = CreateTaskRequest;

interface TaskDrawerProps {
  open: boolean;
  task: Task | null;
  columns: BoardColumn[];
  users: UserSummary[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

interface InternalFormValues {
  title: string;
  description: string;
  columnId: string;
  dateRange: [Dayjs, Dayjs];
  priority: Priority;
  progress: number;
  assigneeId?: string;
}

export function TaskDrawer({ open, task, columns, users, onClose, onSubmit }: TaskDrawerProps) {
  const [form] = Form.useForm<InternalFormValues>();
  const isEditing = Boolean(task);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (task) {
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        columnId: task.columnId,
        dateRange: [dayjs(task.startDate), dayjs(task.dueDate)],
        priority: task.priority,
        progress: task.progress,
        assigneeId: task.assigneeId ?? undefined
      });
      return;
    }

    form.setFieldsValue({
      title: "",
      description: "",
      columnId: columns[0]?.id,
      dateRange: [dayjs(), dayjs().add(3, "day")],
      priority: "medium",
      progress: 0,
      assigneeId: undefined
    });
  }, [columns, form, open, task]);

  const submit = async () => {
    const values = await form.validateFields();
    const assignee = users.find((user) => user.id === values.assigneeId);
    await onSubmit({
      title: values.title,
      description: values.description,
      columnId: values.columnId,
      startDate: values.dateRange[0].format("YYYY-MM-DD"),
      dueDate: values.dateRange[1].format("YYYY-MM-DD"),
      priority: values.priority,
      progress: values.progress,
      assigneeId: values.assigneeId ?? null,
      assigneeName: assignee?.name ?? ""
    });
  };

  return (
    <Drawer
      title={isEditing ? "编辑任务" : "新建任务"}
      size="large"
      open={open}
      onClose={onClose}
      destroyOnClose
      forceRender
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={submit}>
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入任务标题" }]}>
          <Input placeholder="任务标题" />
        </Form.Item>

        <Form.Item name="columnId" label="状态" rules={[{ required: true, message: "请选择任务状态" }]}>
          <Select options={columns.map((column) => ({ label: column.title, value: column.id }))} />
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="起止日期"
          rules={[
            { required: true, message: "请选择起止日期" },
            {
              validator: async (_, value: [Dayjs, Dayjs] | undefined) => {
                if (!value || value.length !== 2) {
                  throw new Error("请选择起止日期");
                }
                const result = validateDateRange(value[0].format("YYYY-MM-DD"), value[1].format("YYYY-MM-DD"));
                if (!result.valid) {
                  throw new Error(result.message);
                }
              }
            }
          ]}
        >
          <DatePicker.RangePicker className="full-width" />
        </Form.Item>

        <Form.Item name="priority" label="优先级" rules={[{ required: true, message: "请选择优先级" }]}>
          <Select
            options={[
              { label: "低", value: "low" },
              { label: "中", value: "medium" },
              { label: "高", value: "high" },
              { label: "紧急", value: "urgent" }
            ]}
          />
        </Form.Item>

        <Form.Item name="progress" label="进度">
          <Slider marks={{ 0: "0%", 50: "50%", 100: "100%" }} />
        </Form.Item>

        <Form.Item name="assigneeId" label="负责人">
          <Select
            allowClear
            options={users.map((user) => ({ label: user.name, value: user.id }))}
            placeholder="未分配"
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={4} placeholder="补充任务背景、交付物或验收要点" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
