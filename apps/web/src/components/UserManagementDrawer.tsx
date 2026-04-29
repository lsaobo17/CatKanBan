import { Button, Drawer, Form, Input, Modal, Select, Switch, Table, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { CreateUserRequest, UpdateUserRequest, UserRole, UserSummary } from "../../../../packages/shared/src/index";
import { api } from "../api/client";

interface UserManagementDrawerProps {
  open: boolean;
  onClose: () => void;
}

const userRoleOptions: Array<{ label: string; value: UserRole }> = [
  { label: "管理员", value: "admin" },
  { label: "成员", value: "member" }
];

export function UserManagementDrawer({ open, onClose }: UserManagementDrawerProps) {
  const queryClient = useQueryClient();
  const [createForm] = Form.useForm<CreateUserRequest>();
  const [editForm] = Form.useForm<UpdateUserRequest>();
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.listAdminUsers,
    enabled: open
  });

  const createUser = useMutation({
    mutationFn: api.createAdminUser,
    onSuccess: async () => {
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["board"] });
    }
  });

  const updateUser = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserRequest }) => api.updateAdminUser(id, input),
    onSuccess: async () => {
      setEditingUser(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["board"] });
    }
  });

  useEffect(() => {
    if (editingUser) {
      editForm.setFieldsValue({
        username: editingUser.username,
        name: editingUser.name,
        role: editingUser.role,
        isActive: editingUser.isActive,
        password: ""
      });
    }
  }, [editForm, editingUser]);

  const submitCreate = async (values: CreateUserRequest) => {
    await createUser.mutateAsync(values);
  };

  const submitEdit = async () => {
    if (!editingUser) {
      return;
    }

    const values = await editForm.validateFields();
    await updateUser.mutateAsync({
      id: editingUser.id,
      input: {
        ...values,
        password: values.password || undefined
      }
    });
  };

  return (
    <>
      <Drawer title="用户管理" size="large" open={open} onClose={onClose} destroyOnClose>
        <div className="user-management">
          <section className="user-management-section">
            <Typography.Title level={4}>创建账号</Typography.Title>
            <Form form={createForm} layout="vertical" requiredMark={false} onFinish={submitCreate}>
              <div className="user-create-grid">
                <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, min: 8, message: "至少输入 8 个字符" }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </div>
              <Button type="primary" htmlType="submit" loading={createUser.isPending}>
                创建
              </Button>
            </Form>
          </section>

          <Table
            rowKey="id"
            loading={usersQuery.isLoading}
            dataSource={usersQuery.data ?? []}
            pagination={false}
            columns={[
              {
                title: "账号",
                dataIndex: "name",
                render: (_value, user) => (
                  <div>
                    <div>{user.name}</div>
                    <Typography.Text type="secondary">{user.username}</Typography.Text>
                  </div>
                )
              },
              {
                title: "角色",
                dataIndex: "role",
                render: (role: UserRole) => (role === "admin" ? "管理员" : "成员")
              },
              {
                title: "启用",
                dataIndex: "isActive",
                render: (isActive: boolean) => <Switch checked={isActive} disabled />
              },
              {
                title: "",
                key: "actions",
                align: "right",
                render: (_value, user) => (
                  <Button onClick={() => setEditingUser(user)}>
                    编辑
                  </Button>
                )
              }
            ]}
          />
        </div>
      </Drawer>

      <Modal
        title="编辑账号"
        open={Boolean(editingUser)}
        onCancel={() => setEditingUser(null)}
        onOk={submitEdit}
        okButtonProps={{ loading: updateUser.isPending }}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={userRoleOptions} />
          </Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="password" label="新密码">
            <Input.Password autoComplete="new-password" placeholder="留空则不修改当前密码" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
