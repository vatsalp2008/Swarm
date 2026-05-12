# Multi-stage build: deps (with workspace context) → build → slim runtime.
# Designed for monorepo deploys; all workspace packages are bundled.

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/audit/package.json packages/audit/
COPY packages/token-vault/package.json packages/token-vault/
COPY packages/bee-sdk/package.json packages/bee-sdk/
COPY apps/orchestrator/package.json apps/orchestrator/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/ packages/
COPY apps/orchestrator/ apps/orchestrator/
RUN pnpm --filter @swarm/orchestrator build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/orchestrator/dist ./dist
COPY --from=build /repo/apps/orchestrator/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages

EXPOSE 8080
CMD ["node", "dist/index.js"]