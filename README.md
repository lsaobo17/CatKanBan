# CatKanBan

CatKanBan 是一个单项目任务看板应用，包含登录、管理员用户管理、看板视图、甘特图视图、任务负责人和 PostgreSQL 持久化。前端使用 React + Vite，后端使用 Fastify + Prisma，生产部署通过 Docker Compose 启动 PostgreSQL、API 和 Nginx Web 服务。

## 技术栈

- React 19 + TypeScript + Vite
- Ant Design 6 + TanStack Query + dnd-kit
- Fastify 5 + Prisma 6
- PostgreSQL
- Docker Compose + Nginx

## 本地开发

安装依赖：

```powershell
pnpm install
```

生成 Prisma Client 并初始化开发数据库迁移：

```powershell
pnpm prisma:generate
pnpm --filter @catkanban/api prisma:migrate
```

启动开发服务：

```powershell
pnpm dev
```

默认地址：

- Web: http://localhost:5173
- API health: http://localhost:3000/api/health

## Docker 部署

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

部署前至少修改 `.env` 中的：

- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `COOKIE_SECURE`

`COOKIE_SECURE=false` 适合默认的 HTTP 部署，例如 `http://localhost:8080`。如果前面有 HTTPS 反向代理，并且浏览器通过 HTTPS 访问站点，请设置为 `true`。

启动服务：

```powershell
docker compose up --build -d
```

查看状态和日志：

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

默认访问地址：

- Web: http://localhost:8080
- API health: http://localhost:8080/api/health

API 容器启动时会自动执行 Prisma migration deploy，然后创建或更新默认项目列和默认管理员账号。PostgreSQL 数据保存在 Compose named volume `postgres-data` 中。

## DockerHub 单镜像

仓库根目录的 `Dockerfile` 用于 DockerHub 自动构建单个应用镜像。这个镜像包含 API、Web 静态文件和一个内置 PostgreSQL，适合只允许填写一个端口的图形化 Docker 部署界面。

当前仓库也包含 GitHub Actions 工作流 `.github/workflows/docker-image.yml`，推送到 `main` 后会自动构建并发布：

- GHCR: `ghcr.io/lsaobo17/catkanban:latest`
- DockerHub: `<DOCKERHUB_USERNAME>/catkanban:latest`，由 GitHub secret `DOCKERHUB_USERNAME` 决定命名空间，并需要同时配置 `DOCKERHUB_TOKEN`

DockerHub Automated Build 建议配置：

- Source: GitHub 仓库 `lsaobo17/CatKanBan`
- Branch: `main`
- Dockerfile location: `/Dockerfile`
- Build context: `/`
- Tag: `latest`

单容器快速启动：

```powershell
docker run --rm -p 8080:3000 -v catkanban-data:/var/lib/postgresql/data ghcr.io/lsaobo17/catkanban:latest
```

也可以用单容器 Compose：

```powershell
docker compose -f compose.standalone.yaml up --build -d
```

默认访问地址为 http://localhost:8080。首次启动会初始化内置 PostgreSQL，自动执行 Prisma migration deploy，然后创建或更新默认项目列和默认管理员账号。

单容器镜像内置默认值：

- `POSTGRES_HOST=127.0.0.1`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=catkanban`
- `POSTGRES_USER=catkanban`
- `POSTGRES_PASSWORD=catkanban`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin12345`
- `COOKIE_SECURE=false`

生产或共享环境建议至少修改：

- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `COOKIE_SECURE=false`，如果通过 HTTP 访问

如果希望应用和 PostgreSQL 仍然拆成两个容器，使用 `compose.image.yaml`：

```powershell
Copy-Item .env.example .env
docker compose -f compose.image.yaml up -d
```

当设置了 `DATABASE_URL`，或把 `POSTGRES_HOST` 设置成 `db`、`host.docker.internal` 等非本机地址时，镜像不会启动内置 PostgreSQL，而是连接外部数据库。

外部数据库示例：

```powershell
docker run --rm -p 8080:3000 `
  -e POSTGRES_HOST="host.docker.internal" `
  -e POSTGRES_PORT="5432" `
  -e POSTGRES_DB="catkanban" `
  -e POSTGRES_USER="catkanban" `
  -e POSTGRES_PASSWORD="password" `
  -e ADMIN_USERNAME="admin" `
  -e ADMIN_PASSWORD="change-this-admin-password" `
  -e COOKIE_SECURE="false" `
  <DOCKERHUB_USERNAME>/catkanban:latest
```

停止服务：

```powershell
docker compose down
```

如果需要同时删除数据库 volume，请先确认不再需要现有数据，然后手动处理该单个 volume。

## 常用检查

```powershell
pnpm lint
pnpm test
pnpm build
```

当前 Windows 网络共享环境使用 `.npmrc` 中的 hoisted 安装策略，因此根脚本刻意直接调用 `node_modules` 里的 CLI 文件。Docker 镜像构建不依赖这些脚本路径，而是使用 `pnpm exec` 在容器内按工作区包解析工具。
