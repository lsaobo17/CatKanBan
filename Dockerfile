FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY scripts/prisma-generate.mjs scripts/prisma-generate.mjs
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @catkanban/shared exec tsc -p tsconfig.json
# prisma generate validates env("DATABASE_URL") during build but does not connect.
RUN node scripts/prisma-generate.mjs
RUN pnpm --filter @catkanban/api exec tsc -p tsconfig.json --noEmit
RUN pnpm --filter @catkanban/api exec tsup src/index.ts --format esm --platform node --target node22 --out-dir dist --sourcemap --clean
RUN pnpm --filter @catkanban/web exec tsc -p tsconfig.json
RUN pnpm --filter @catkanban/web exec vite build

FROM node:22-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache postgresql17 su-exec

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3000
ENV COOKIE_SECURE=false
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV PGDATA=/var/lib/postgresql/data
ENV POSTGRES_HOST=127.0.0.1
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=catkanban
ENV POSTGRES_USER=catkanban
ENV POSTGRES_PASSWORD=catkanban
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=admin12345
ENV ADMIN_NAME="CatKanBan Admin"
ENV CATKANBAN_INTERNAL_POSTGRES=auto

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/docker-entrypoint.mjs apps/api/docker-entrypoint.mjs
COPY --from=builder /app/apps/api/docker-standalone-entrypoint.sh apps/api/docker-standalone-entrypoint.sh
COPY --from=builder /app/apps/web/dist apps/web/dist
RUN chmod +x apps/api/docker-standalone-entrypoint.sh

EXPOSE 3000
VOLUME ["/var/lib/postgresql/data"]
CMD ["/app/apps/api/docker-standalone-entrypoint.sh"]
