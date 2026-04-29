import { Button, Form, Input, Typography } from "antd";
import type { LoginRequest } from "../../../../packages/shared/src/index";

interface LoginPageProps {
  loading: boolean;
  onLogin: (values: LoginRequest) => Promise<void>;
}

export function LoginPage({ loading, onLogin }: LoginPageProps) {
  return (
    <div className="login-shell">
      <div className="login-panel">
        <Typography.Title level={2} className="login-title">
          CatKanBan
        </Typography.Title>
        <Form layout="vertical" requiredMark={false} onFinish={onLogin}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}
