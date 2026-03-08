# syntax=docker/dockerfile:1

# --------------------------------------------------------------------------- #
# base: shared Node.js + pnpm bootstrap                                        #
# --------------------------------------------------------------------------- #
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# --------------------------------------------------------------------------- #
# deps: fetch & install all packages (layer-cached by pnpm store)              #
# --------------------------------------------------------------------------- #
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

# --------------------------------------------------------------------------- #
# builder: compile the Nitro bundle                                            #
# --------------------------------------------------------------------------- #
FROM deps AS builder
COPY . .
RUN NITRO_PRESET=node-server pnpm build

# --------------------------------------------------------------------------- #
# production: minimal runtime image                                            #
# --------------------------------------------------------------------------- #
FROM node:24-alpine AS production

# Non-root user for least-privilege operation
RUN addgroup -S proxy && adduser -S proxy -G proxy

WORKDIR /app

# Only copy the compiled output — no source, no devDependencies
COPY --from=builder --chown=proxy:proxy /app/.output ./.output

USER proxy

# OCI standard labels.  Dynamic values (version, revision, created) are
# injected at build time by docker/metadata-action in CI via --label flags.
LABEL org.opencontainers.image.title="sudo-proxy" \
      org.opencontainers.image.description="High-performance HTTP/HLS proxy built on Nitro" \
      org.opencontainers.image.url="https://github.com/okikio/sudo-proxy" \
      org.opencontainers.image.source="https://github.com/okikio/sudo-proxy" \
      org.opencontainers.image.licenses="MIT"

# Runtime configuration — all settings are supplied as environment variables.
# See docker-compose.yaml for the full list.
ENV PORT=3000 \
    NODE_ENV=production

EXPOSE 3000

# Health-check using wget (available in node:alpine images by default)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO/dev/null "http://localhost:${PORT}/healthcheck" || exit 1

CMD ["node", ".output/server/index.mjs"]
