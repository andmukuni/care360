# syntax=docker/dockerfile:1

# ── Builder: compile Adonis + Vite assets ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node ace build --ignore-ts-errors

# ── Runtime: production dependencies + compiled app ───────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache tini wget

COPY --from=builder /app/build ./
RUN npm ci --omit=dev

# Writable dirs for uploads and private files (also mounted as volumes in prod)
RUN mkdir -p public/storage storage/app

COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--", "/app/docker/entrypoint.sh"]
