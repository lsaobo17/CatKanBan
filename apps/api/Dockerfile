FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @catkanban/shared exec tsc -p tsconfig.json
# prisma generate validates env("DATABASE_URL") during build but does not connect.
RUN DATABASE_URL="postgresql://catkanban:catkanban@localhost:5432/catkanban?schema=public" pnpm --filter @catkanban/api exec prisma generate
RUN pnpm --filter @catkanban/api exec tsc -p tsconfig.json --noEmit
RUN pnpm --filter @catkanban/api exec tsup src/index.ts --format esm --platform node --target node22 --out-dir dist --sourcemap --clean

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

EXPOSE 3000
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo \"DATABASE_URL is required at runtime. Set it to a PostgreSQL connection string.\" >&2; exit 1; fi; node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
