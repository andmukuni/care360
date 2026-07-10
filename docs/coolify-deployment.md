# Coolify Deployment Guide — Care360 (Fairview Adonis)

Deploy **care360** to [Coolify](https://coolify.io) using the production `Dockerfile` only, with **external Postgres** and persistent upload volumes.

> **Important:** Do **not** use `docker-compose` on Coolify for this app. The local compose file is named `docker-compose.local.yml` so Coolify auto-detects the `Dockerfile` instead of spinning up a bundled Postgres and binding host port `3333`.

## Architecture

```
Internet → Coolify Traefik (SSL) → App container (:3333)
                                        ↓
                              External Postgres (13.140.178.27:3815)
                              Volumes: /app/public/storage, /app/storage/app
```

Local development uses `docker-compose.local.yml` (app + bundled Postgres + optional Redis).

---

## Prerequisites

1. **Coolify server** with Docker and a domain pointed at the app.
2. **Network access** from the Coolify host to `13.140.178.27:3815` (firewall / security group).
3. **Git repository** connected to Coolify (`andmukuni/care360`).
4. **APP_KEY** — generate once and store as a Coolify secret:
   ```bash
   node ace generate:key
   ```

---

## 1. Create the Coolify application

1. In Coolify: **New Resource → Application**.
2. Connect your Git repo (`care360`).
3. **Build pack:** **Dockerfile** (root `Dockerfile`) — **not** Docker Compose.
4. Confirm Coolify is **not** using `docker-compose.yml` (this repo ships `docker-compose.local.yml` for local dev only).
5. **Port (container):** `3333` (must match `PORT` env). Coolify Traefik routes to the container; you do **not** need to publish host port `3333`.
6. **Coolify env scope:** Mark `NODE_ENV`, `APP_KEY`, and all `DB_*` / `DATABASE_URL` as **Runtime only** (uncheck "Available at Buildtime"). Coolify otherwise injects `NODE_ENV=production` during `docker build`, which skips devDependencies and breaks `node ace build`.
7. **Health check:**
   - Path: `/health/db`
   - Interval: `30s`
   - Timeout: `10s`
   - Retries: `3`
   - Start period: `60s` (migrations run on boot)

Fallback liveness (if DB check is too strict during cold start): `/up`

### Persistent storage (critical)

Mount these in Coolify → Application → **Storages**:

| Container path | Purpose |
|---|---|
| `/app/public/storage` | Profile photos, clinic logo, staff signatures |
| `/app/storage/app` | Patient documents, CSV report exports |

**Without these mounts, every redeploy deletes uploads and exports.**

---

## 2. Environment variables (production)

Paste into Coolify → **Production Environment Variables** as plain `KEY=value` lines (no inline `#` comments — Coolify strips them).

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `3333` |
| `APP_KEY` | *(secret — from `node ace generate:key`)* |
| `LOG_LEVEL` | `info` |
| `SESSION_DRIVER` | `cookie` |
| `TZ` | `Africa/Lusaka` or `UTC` |
| `DATABASE_URL` | `postgres://postgres:PASSWORD@13.140.178.27:3815/postgres` |
| `DB_HOST` | `13.140.178.27` |
| `DB_PORT` | `3815` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | *(secret)* |
| `DB_DATABASE` | `postgres` |
| `REPORTS_PROCESS_EXPORTS_SYNC` | `true` |
| `RUN_DICTIONARY_SYNC` | `false` *(see first deploy)* |

`DATABASE_URL` and `DB_*` are both listed because `start/env.ts` validates `DB_*` on boot even when `DATABASE_URL` is set.

### Optional — reports & payments

| Variable | Purpose |
|---|---|
| `REPORT_FACILITY_NAME` | CSV report header |
| `REPORT_PROVINCE` | MoH register metadata |
| `REPORT_DISTRICT` | MoH register metadata |
| `PAYMENTS_GATEWAY` | `sandbox` or `lenco` |
| `LENCO_API_TOKEN` | Live mobile-money collections |
| `LENCO_WEBHOOK_SECRET` | Webhook verification |

---

## 3. Deploy

1. Push code with `Dockerfile`, `docker/entrypoint.sh`, and `.dockerignore`.
2. Trigger deploy in Coolify.
3. On boot the entrypoint runs:
   - `node ace migration:run --force`
   - `node bin/server.js`

Check logs for `[entrypoint] Starting HTTP server...`.

---

## 4. First deploy checklist

After the first successful deploy:

- [ ] `GET https://your-domain/up` → `{ "status": "ok" }`
- [ ] `GET https://your-domain/health/db` → `{ "database": "up" }`
- [ ] Staff login and dashboard load (Vite assets present)
- [ ] **Medical dictionary** (one-off, slow ~5–45 min on remote DB):
  ```bash
  # Coolify → Application → Execute Command
  node ace dictionary:sync
  ```
  Or set `RUN_DICTIONARY_SYNC=true` for a single deploy, then set back to `false`.
- [ ] Upload clinic logo in Settings → restart container → logo still present
- [ ] Generate a report export → download works

---

## 5. Local docker-compose (full stack)

For local dev only (bundled Postgres, **not** used by Coolify):

```bash
cp .env.docker.example .env.docker
node ace generate:key   # paste into APP_KEY in .env.docker
docker compose -f docker-compose.local.yml up -d --build
```

Optional Redis (future queue/transmit):

```bash
docker compose -f docker-compose.local.yml --profile with-redis up -d
```

First-time dictionary seed:

```bash
docker compose -f docker-compose.local.yml exec app node ace dictionary:sync
```

Stop:

```bash
docker compose -f docker-compose.local.yml down
```

---

## 6. Rollback & redeploy

- **Redeploy:** Coolify rebuilds the image; entrypoint re-runs migrations (idempotent).
- **Rollback:** Redeploy a previous Git commit in Coolify.
- **Data:** Uploads survive only if volume mounts are configured.

---

## 7. Troubleshooting

### `Bind for :::3333 failed: port is already allocated`

**Symptom:** Deploy builds successfully but container fails to start.

**Cause:** Coolify deployed via `docker-compose.yml`, which published host port `3333`. Another container on the server already uses that port.

**Fix:**

1. Use **Dockerfile-only** deploy (this repo no longer ships root `docker-compose.yml`).
2. Redeploy — Coolify Traefik routes to container port `3333` without binding the host.
3. If a previous failed deploy left a bundled `postgres-*` container, remove it in Coolify (not needed when using external Postgres at `13.140.178.27:3815`).
4. If you must debug on the server:
   ```bash
   docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep 3333
   ```

### App uses wrong database (local postgres instead of external)

**Cause:** Old `docker-compose.yml` at repo root overrode `DB_HOST=postgres` and started a bundled Postgres service.

**Fix:** Pull latest `main` (uses `docker-compose.local.yml` only). Redeploy with Dockerfile build pack. Confirm env has `DB_HOST=13.140.178.27` and `DB_PORT=3815`.

### Database connection timeout

- Coolify host cannot reach `13.140.178.27:3815`.
- Fix firewall / allowlist the Coolify server IP (`13.140.178.28`) on the Postgres host.

### Build fails at `node ace build`

- Set `NODE_ENV`, `APP_KEY`, `DATABASE_URL`, and `DB_*` to **Runtime only** in Coolify.
- Dockerfile builder stage forces `npm ci --include=dev` regardless.

### 502 Bad Gateway after deploy

- Check container logs for migration failures.
- Ensure `APP_KEY` is set.
- Ensure `HOST=0.0.0.0` and container port `3333` match Coolify port setting.

### Login works but assets 404

- Build failed during `node ace build` (Vite). Check build logs.
- Verify `public/assets/.vite/manifest.json` exists in the image.

### Uploads disappear after redeploy

- Add persistent mounts for `/app/public/storage` and `/app/storage/app`.

### Session / CSRF issues over HTTPS

- App sets `trustProxy: true` in production ([`config/app.ts`](../config/app.ts)).
- Ensure Coolify Traefik forwards `X-Forwarded-Proto: https`.

### Dictionary search empty

- Run `node ace dictionary:sync` once against the production database.

---

## 8. What is not in v1

| Item | Status |
|---|---|
| Separate queue worker container | Not needed — inline queue |
| Redis required | Optional in local compose only |
| S3 object storage | Disk volumes for now |
| CI pipeline | Use Coolify Git integration |

---

## File reference

| File | Role |
|---|---|
| [`Dockerfile`](../Dockerfile) | Multi-stage production image (Coolify) |
| [`docker/entrypoint.sh`](../docker/entrypoint.sh) | Migrate + optional dictionary sync + start server |
| [`docker-compose.local.yml`](../docker-compose.local.yml) | **Local dev only** — app + Postgres + optional Redis |
| [`.env.docker.example`](../.env.docker.example) | Local compose env template |
| [`start/env.ts`](../start/env.ts) | Validated environment variables |
| [`config/database.ts`](../config/database.ts) | `DATABASE_URL` or `DB_*` connection |
