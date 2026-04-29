# CatKanBan 项目记录

本文档记录当前项目结构、关键约定和维护注意事项，供后续开发者或自动化代理快速接手。文件名是 `AGENTS.md`，不是 `AGNETS.md`。

## 0. 自动化代理操作约束

禁止批量删除文件或者目录。不要使用：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要删除文件时，只能一次删除一个明确路径的文件，例如：

```powershell
Remove-Item "C:\path\to\file.txt"
```

如果需要批量删除文件，应停止操作，并向用户请求。

## 1. 项目定位

CatKanBan 是一个单项目任务看板应用，当前版本支持：

- 用户名和密码登录。
- HTTP-only Cookie 会话。
- 管理员创建、编辑、禁用账号。
- 看板视图和甘特图视图切换。
- 任务创建、编辑、删除、拖拽换列和排序。
- 每个任务必须有明确开始日期和截止日期。
- 任务可分配给启用用户，也保留 `assigneeName` 文本快照。
- PostgreSQL 持久化、Fastify API、React 前端。
- Docker Compose 部署。
- UI 风格切换，偏好保存在浏览器 `localStorage`。

当前仍是单项目应用，固定默认项目 ID 为 `default-project`。数据结构已包含 `projectId`，但前端导航、API 查询范围和权限模型尚未扩展到多项目。

## 2. 技术栈

- 包管理：pnpm workspace，根包版本声明为 `pnpm@10.12.1`。
- 前端：React 19、TypeScript、Vite、Ant Design 6、TanStack Query、dnd-kit、lucide-react、dayjs。
- 后端：Node.js 22、Fastify 5、Prisma 6、PostgreSQL。
- 认证：Node `crypto`，使用 scrypt 密码哈希、随机会话令牌和 SHA-256 会话令牌哈希。
- 构建：API 使用 `tsup` 打包，Web 使用 Vite 构建，`packages/shared` 使用 TypeScript 输出声明和 JS。
- 测试：Vitest、Testing Library、Fastify inject。
- 部署：Docker Compose，包含 `db`、`api`、`web` 三个服务；Web 使用 Nginx 代理 `/api`。

## 3. 目录结构

- `apps/api`：Fastify API、Prisma schema、数据库仓储、服务层和 API 测试。
- `apps/api/src/repositories`：看板仓储和用户仓储，分别有 Prisma 与 Memory 实现。
- `apps/api/src/services`：`BoardService`、`AuthService`、`UserService` 和安全工具。
- `apps/web`：React 应用、看板/甘特图组件、任务表单、登录页、用户管理抽屉、UI 风格设置和前端测试。
- `packages/shared`：共享常量和类型，包含默认项目、默认列、优先级、用户角色、任务类型和 API 请求/响应类型。
- `scripts/dev.mjs`：从项目根目录同时启动 API 和 Web 开发服务。
- `compose.yaml`：Docker Compose 编排。
- `.env.example`：Docker、数据库和默认管理员环境变量示例。
- `.npmrc`：为当前 Windows 网络共享环境设置 pnpm 安装策略。

## 4. 重要运行命令

在项目根目录执行：

```powershell
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Prisma 常用命令：

```powershell
pnpm prisma:generate
pnpm --filter @catkanban/api prisma:migrate
pnpm --filter @catkanban/api prisma:deploy
```

Docker 部署：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

默认端口：

- Web 开发服务：`http://localhost:5173`
- API：`http://localhost:3000/api/health`
- Docker Web：`http://localhost:8080`

默认管理员环境变量：

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin12345`
- `ADMIN_NAME=CatKanBan Admin`

生产或共享环境必须修改默认管理员密码。

## 5. Windows 网络共享特殊约定

当前项目位于网络共享盘，pnpm 默认符号链接策略会失败。因此有几个刻意保留的约定：

- `.npmrc` 使用 `node-linker=hoisted`、`package-import-method=copy`、`store-dir=C:/tmp/pnpm-store`。
- 根目录脚本直接调用 `node_modules` 中的 CLI 文件，例如 `node node_modules/eslint/bin/eslint.js`，不要轻易改回 `eslint`、`vitest`、`vite` 等短命令。
- `apps/api` 和 `apps/web` 没有把 `@catkanban/shared` 作为 `workspace:*` 依赖，而是通过相对路径引用 `packages/shared/src/index`。这是为了避免 pnpm 在网络共享上创建 workspace symlink。
- Dockerfile 安装阶段没有复制 `.npmrc`，这是有意的；Linux 容器内可以使用标准 pnpm 行为。

如果项目迁移到普通本地磁盘，可以重新评估这些限制，但修改前必须跑通 `pnpm install`、`pnpm lint`、`pnpm test`、`pnpm build`。

## 6. 数据模型

Prisma schema 位于 `apps/api/prisma/schema.prisma`。

核心模型：

- `Project`：当前只有固定默认项目，ID 为 `default-project`。
- `User`：登录账号，包含唯一 `username`、可选唯一 `email`、显示名 `name`、`role`、`passwordHash`、`isActive`。
- `Session`：登录会话，保存 `tokenHash` 和 `expiresAt`，通过 `userId` 关联用户。
- `Column`：项目列，默认列为 `待办`、`进行中`、`阻塞`、`已完成`。
- `Task`：任务，包含标题、描述、起止日期、优先级、进度、负责人、排序位置。

任务日期使用 `DateTime @db.Date`，API 对外返回 `YYYY-MM-DD` 字符串。

任务负责人逻辑：

- `Task.assigneeId` 可为空，关联 `User`，用户删除时置空。
- `Task.assigneeName` 保留文本快照；当有有效 `assigneeId` 时，API 返回用户当前 `name`。
- 只有启用用户可作为负责人。

默认数据：

- `PrismaBoardRepository.seedDefaultBoard()` 在 API 启动时写入或更新默认项目和默认列。
- `AuthService.seedAdmin()` 在 API 启动时保证至少存在一个启用管理员。

## 7. 认证和安全约定

- 登录使用 `POST /api/auth/login`，请求体为 `username` 和 `password`。
- 登录成功后写入 `catkanban_session` Cookie。
- Cookie 属性：`HttpOnly`、`Path=/`、`SameSite=Lax`、`Max-Age=604800`，生产环境额外启用 `Secure`。
- 服务端只保存会话令牌的 SHA-256 哈希，不保存明文令牌。
- 密码使用 scrypt 加盐哈希，格式为 `scrypt$salt$hash`。
- 退出登录会删除当前会话。
- 禁用用户会删除该用户所有会话。
- 所有看板和任务 API 都要求登录；管理员 API 额外要求 `role === "admin"`。
- 用户名会 trim 并转为小写。
- 创建或修改密码时，新密码至少 8 个字符。
- 禁止禁用或降级最后一个启用管理员。

## 8. API 约定

API 路由在 `apps/api/src/server.ts`：

- `GET /api/health`：健康检查，公开。
- `POST /api/auth/login`：登录，公开。
- `POST /api/auth/logout`：退出登录，要求登录。
- `GET /api/auth/me`：返回当前用户，要求登录。
- `GET /api/users`：返回启用用户列表，用于任务负责人选择，要求登录。
- `GET /api/admin/users`：管理员查看所有用户。
- `POST /api/admin/users`：管理员创建用户。
- `PATCH /api/admin/users/:id`：管理员更新用户资料、角色、启用状态或密码。
- `GET /api/board`：返回默认项目、列、列内任务和可分配用户，要求登录。
- `POST /api/tasks`：创建任务，要求登录。
- `PATCH /api/tasks/:id`：更新任务字段；如果 `columnId` 改变，会先执行移动。
- `POST /api/tasks/:id/move`：移动任务到目标列和目标位置。
- `DELETE /api/tasks/:id`：删除任务。

服务层校验：

- `BoardService` 校验任务标题、列、日期、优先级、进度和排序位置。
- 日期格式必须是 `YYYY-MM-DD`，且 `startDate` 不能晚于 `dueDate`。
- `progress` 必须是 0 到 100 的整数。
- `position` 必须是非负整数。
- `UserService` 校验用户名、密码、角色、启用状态，并处理用户名冲突。

错误类型：

- `ValidationError` 返回 400。
- `UnauthorizedError` 返回 401。
- `ForbiddenError` 返回 403。
- `NotFoundError` 返回 404。
- `ConflictError` 返回 409。
- 未处理错误返回 500 和中文通用错误信息。

## 9. 前端架构

入口：

- `apps/web/src/main.tsx`：挂载 React、TanStack Query、Ant Design App。
- `apps/web/src/App.tsx`：认证状态、主布局、视图切换、任务抽屉、设置抽屉、用户管理抽屉。

主要组件：

- `LoginPage.tsx`：用户名/密码登录页。
- `BoardView.tsx`：看板视图，使用 dnd-kit 实现拖拽，包含拖拽覆盖层和掉落收尾动画。
- `GanttView.tsx`：甘特图视图，使用 CSS Grid 时间轴，显示周起点、日期、今天线、任务进度条。
- `TaskDrawer.tsx`：任务创建/编辑表单，使用 Ant Design Drawer、Form、RangePicker、Slider、负责人 Select。
- `UserManagementDrawer.tsx`：管理员用户管理，支持创建账号和编辑用户名、姓名、角色、启用状态、密码。
- `SettingsDrawer.tsx`：UI 风格选择。

状态和数据：

- `api/client.ts` 统一封装 fetch，默认请求 `/api`，携带 `credentials: "include"`。
- `VITE_API_BASE_URL` 可覆盖 API 前缀。
- `App.tsx` 先查询 `/auth/me`，无会话时展示登录页，有会话时加载看板。
- `useBoard(enabled)` 支持登录后再启用看板查询。
- `useMoveTask()` 带乐观更新，使用 `applyTaskMove()` 先更新本地缓存，失败后回滚。
- 登出后调用 `queryClient.clear()` 清理所有客户端缓存。

UI 风格：

- `useUiStyle.ts` 读写 `localStorage` key：`catkanban:ui-style`。
- `uiStyles.ts` 当前包含 `classic`、`dark`、`mint`、`warm`、`contrast` 五种风格。
- `ConfigProvider` 使用当前风格对应的 Ant Design theme token。

## 10. 甘特图和日期逻辑

甘特图工具位于 `apps/web/src/utils/gantt.ts`：

- `buildTimeline(tasks, today?)` 从任务最早开始和最晚截止日期生成时间轴。
- 时间轴会在前后各补 2 天。
- 日期运算使用 UTC date key，避免本地时区造成天数偏移。
- `daysBetween()` 用于计算甘特条偏移和持续天数。

表单日期校验位于 `apps/web/src/utils/validation.ts`，前后端都有相同规则：日期必须为 `YYYY-MM-DD` 且开始不晚于截止。

## 11. 测试覆盖

根命令 `pnpm test` 会运行：

- API 测试：`apps/api/test/server.test.ts`
  - 健康检查。
  - 未登录访问看板返回 401。
  - 登录并读取当前用户。
  - 创建、更新、移动、删除任务。
  - 管理员创建、编辑、禁用用户。
  - 非管理员访问用户管理返回 403。
  - 非法日期返回 400。
- Web 测试：
  - `App.test.tsx`：未登录展示登录页、登录后加载看板、看板/甘特图切换、管理员可见用户管理、成员隐藏用户管理、恢复 UI 风格。
  - `components/board/drag.test.ts`：拖拽目标解析和 move handler。
  - `utils/boardMove.test.ts`：乐观移动逻辑。
  - `utils/gantt.test.ts`：时间轴范围和任务持续天数。
  - `utils/validation.test.ts`：日期范围校验。

API 测试使用 `MemoryBoardRepository` 和 `MemoryUserRepository`，不依赖真实 PostgreSQL。

## 12. Docker 部署

`compose.yaml` 服务：

- `db`：`postgres:18-alpine`，带健康检查和 named volume `postgres-data`。
- `api`：构建 `apps/api/Dockerfile`，依赖数据库健康，启动时执行 Prisma migration deploy，再启动 API。
- `web`：构建 `apps/web/Dockerfile`，Nginx 托管静态文件并代理 `/api`。

Compose 环境变量：

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `API_PORT`
- `WEB_PORT`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

Nginx 配置在 `apps/web/nginx.conf`：

- `/api/` 代理到 `http://api:3000/api/`。
- 其他路径回退到 `index.html`，支持 SPA 路由。

## 13. 维护注意事项

- `README.md` 当前中文内容在终端中显示为乱码，后续建议重新以 UTF-8 修复。
- `apps/api/src/services/boardService.ts` 中 `readOptionalNullableString()` 有一处错误消息字符串显示为乱码，后续可顺手修复。
- Docker CLI 当前环境可能不可用；如调整部署相关文件，需要在可用环境执行 `docker compose up --build` 验证。
- Vite 生产构建中 Ant Design 相关 bundle 较大，当前可接受；如果后续性能要求提高，可做路由级或组件级 code splitting。
- Prisma 当前安装版本为 6.x；升级到 7.x 前需要单独评估迁移影响。
- `apps/api/dist` 和 `apps/web/dist` 是构建产物，避免手工维护；如需要更新，应通过构建命令生成。
- 若新增多项目功能，现有 `Project`、`Column`、`Task.projectId` 已具备基础，但前端导航、权限和 API 查询范围需要同步调整。
