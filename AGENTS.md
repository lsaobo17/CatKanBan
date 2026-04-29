# CatKanBan 项目记录

本文档记录当前项目结构、关键约定和维护注意事项，供后续开发者或自动化代理快速接手。

## 1. 项目定位

CatKanBan 是一个单项目任务看板应用，当前版本支持：

- 看板视图和甘特图视图切换。
- 任务创建、编辑、删除、拖拽换列和排序。
- 每个任务必须有明确开始日期和截止日期。
- PostgreSQL 持久化、Fastify API、React 前端。
- Docker Compose 部署。
- UI 风格切换，偏好保存在浏览器 `localStorage`。

当前不实现登录、用户、角色、权限，但数据结构保留 `projectId`，后续可扩展用户管理和多项目权限。

## 2. 技术栈

- 包管理：pnpm workspace，根包版本声明为 `pnpm@10.12.1`。
- 前端：React 19、TypeScript、Vite、Ant Design、TanStack Query、dnd-kit、lucide-react、dayjs。
- 后端：Node.js、Fastify、Prisma、PostgreSQL。
- 构建：API 使用 `tsup` 打包，Web 使用 Vite 构建。
- 测试：Vitest、Testing Library、Fastify inject。
- 部署：Docker Compose，包含 `db`、`api`、`web` 三个服务；Web 使用 Nginx 代理 `/api`。

## 3. 目录结构

- `apps/api`：Fastify API、Prisma schema、数据库仓储、服务层和 API 测试。
- `apps/web`：React 应用、看板/甘特图组件、任务表单、UI 风格设置、前端测试。
- `packages/shared`：共享常量和类型，包含默认项目、默认列、任务类型、API 请求/响应类型。
- `scripts/dev.mjs`：从项目根目录同时启动 API 和 Web 开发服务。
- `compose.yaml`：Docker Compose 编排。
- `.env.example`：Docker/数据库环境变量示例。
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

Docker 部署：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

默认端口：

- Web 开发服务：`http://localhost:5173`
- API：`http://localhost:3000/api/health`
- Docker Web：`http://localhost:8080`

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
- `Column`：项目列，默认列为 `待办`、`进行中`、`阻塞`、`已完成`。
- `Task`：任务，包含标题、描述、起止日期、优先级、进度、负责人文本、排序位置。

任务日期使用 `DateTime @db.Date`，API 对外返回 `YYYY-MM-DD` 字符串。

默认数据由 `PrismaBoardRepository.seedDefaultBoard()` 在 API 启动时写入或更新。

## 7. API 约定

API 路由在 `apps/api/src/server.ts`：

- `GET /api/health`：健康检查。
- `GET /api/board`：返回默认项目、列和列内任务。
- `POST /api/tasks`：创建任务。
- `PATCH /api/tasks/:id`：更新任务字段；如果 `columnId` 改变，会先执行移动。
- `POST /api/tasks/:id/move`：移动任务到目标列和目标位置。
- `DELETE /api/tasks/:id`：删除任务。

服务层 `BoardService` 负责输入校验：

- `title`、`columnId`、`startDate`、`dueDate`、`priority` 必填。
- 日期格式必须是 `YYYY-MM-DD`。
- `startDate` 不能晚于 `dueDate`。
- `progress` 必须是 0 到 100 的整数。
- `position` 必须是非负整数。

错误类型：

- `ValidationError` 返回 400。
- `NotFoundError` 返回 404。
- 未处理错误返回 500 和中文通用错误信息。

## 8. 前端架构

入口：

- `apps/web/src/main.tsx`：挂载 React、TanStack Query、Ant Design App。
- `apps/web/src/App.tsx`：主布局、视图切换、任务抽屉、设置抽屉。

主要组件：

- `BoardView.tsx`：看板视图，使用 dnd-kit 实现拖拽，包含拖拽覆盖层和掉落收尾动画。
- `GanttView.tsx`：甘特图视图，使用自研 CSS Grid 时间轴，显示周起点、日期、今天线、任务进度条。
- `TaskDrawer.tsx`：任务创建/编辑表单，使用 Ant Design Drawer、Form、RangePicker、Slider。
- `SettingsDrawer.tsx`：UI 风格选择。

状态和数据：

- `useBoard.ts` 封装 TanStack Query 查询和 mutation。
- `useMoveTask()` 带乐观更新，使用 `applyTaskMove()` 先更新本地缓存，失败后回滚。
- API 客户端位于 `apps/web/src/api/client.ts`，默认请求 `/api`，开发环境由 Vite proxy 转发到 `localhost:3000`。

UI 风格：

- `useUiStyle.ts` 读写 `localStorage` key：`catkanban:ui-style`。
- `uiStyles.ts` 当前包含 `classic`、`dark`、`mint`、`warm`、`contrast` 五种风格。
- `ConfigProvider` 使用当前风格对应的 Ant Design theme token。

## 9. 甘特图和日期逻辑

甘特图工具位于 `apps/web/src/utils/gantt.ts`：

- `buildTimeline(tasks, today?)` 从任务最早开始和最晚截止日期生成时间轴。
- 时间轴会在前后各补 2 天。
- 日期运算使用 UTC date key，避免本地时区造成天数偏移。
- `daysBetween()` 用于计算甘特条偏移和持续天数。

表单日期校验位于 `apps/web/src/utils/validation.ts`，前后端都有相同规则：日期必须为 `YYYY-MM-DD` 且开始不晚于截止。

## 10. 测试覆盖

根命令 `pnpm test` 会运行：

- API 测试：`apps/api/test/server.test.ts`
  - 健康检查。
  - 创建、更新、移动、删除任务。
  - 非法日期返回 400。
- Web 测试：
  - `App.test.tsx`：看板/甘特图切换。
  - `components/board/drag.test.ts`：拖拽目标解析和 move handler。
  - `utils/boardMove.test.ts`：乐观移动逻辑。
  - `utils/gantt.test.ts`：时间轴范围和任务持续天数。
  - `utils/validation.test.ts`：日期范围校验。

API 测试使用 `MemoryBoardRepository`，不依赖真实 PostgreSQL。

## 11. Docker 部署

`compose.yaml` 服务：

- `db`：`postgres:18-alpine`，带健康检查和 named volume `postgres-data`。
- `api`：构建 `apps/api/Dockerfile`，依赖数据库健康，启动时执行 Prisma migration deploy，再启动 API。
- `web`：构建 `apps/web/Dockerfile`，Nginx 托管静态文件并代理 `/api`。

Nginx 配置在 `apps/web/nginx.conf`：

- `/api/` 代理到 `http://api:3000/api/`。
- 其他路径回退到 `index.html`，支持 SPA 路由。

## 12. 维护注意事项

- `README.md` 当前中文内容显示为乱码，后续建议重新以 UTF-8 修复。
- Docker CLI 当前环境不可用，之前只验证了 lint/test/build，未在本机实际执行 `docker compose up --build`。
- Vite 生产构建中 Ant Design 相关 bundle 较大，当前可接受；如果后续性能要求提高，可做路由级或组件级 code splitting。
- Prisma 当前安装版本为 6.x，构建时提示存在 7.x 大版本更新；升级前需要单独评估 Prisma 7 迁移影响。
- 若新增用户管理，建议先引入 `User`、`ProjectMember`、认证中间件，再逐步把 `assigneeName` 迁移为可选的 `assigneeId`。
- 若新增多项目功能，现有 `Project`、`Column`、`Task.projectId` 已具备基础，但前端导航、权限和 API 查询范围需要同步调整。

