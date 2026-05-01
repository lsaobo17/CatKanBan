FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @catkanban/shared exec tsc -p tsconfig.json
RUN pnpm --filter @catkanban/web exec tsc -p tsconfig.json
RUN pnpm --filter @catkanban/web exec vite build

FROM nginx:1.27-alpine AS runtime

ENV API_UPSTREAM=http://api:3000

COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
