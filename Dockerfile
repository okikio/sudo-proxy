# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Build stage
FROM base AS build

COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

COPY . .
RUN pnpm build

# Production stage
FROM base AS production

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]