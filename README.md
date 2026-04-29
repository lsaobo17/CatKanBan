# CatKanBan

CatKanBan 是一个 React 项目看板应用。第一版支持单项目、看板和甘特图切换、任务起止日期、拖拽换列、Docker Compose 部署，并为后续用户管理保留后端分层和 `projectId` 数据边界。

## 技术栈

- React + TypeScript + Vite
- Ant Design + TanStack Query + dnd kit
- Fastify + Prisma
- PostgreSQL
- Docker Compose + Nginx

## 本地开发

如果本机没有 pnpm，可以先安装：

```powershell
npm install -g pnpm
```

安装依赖：

```powershell
pnpm install
```

启动数据库后生成 Prisma Client 并运行迁移：

```powershell
pnpm --filter @catkanban/api prisma:generate
pnpm --filter @catkanban/api prisma:migrate
```

启动开发服务：

```powershell
pnpm dev
```

默认访问：

- 前端：http://localhost:5173
- API：http://localhost:3000/api/health

## Docker 部署

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

启动：

```powershell
docker compose up --build
```

默认访问：http://localhost:8080

## 常用检查

```powershell
pnpm lint
pnpm test
pnpm build
```

## 后续用户管理扩展点

第一版不实现登录和权限。后续可在现有结构上新增：

- `User` 和 `ProjectMember` Prisma 模型
- Fastify 认证插件和当前用户上下文
- 项目成员权限校验
- 前端登录页、成员设置页和 API token/JWT 存储策略

