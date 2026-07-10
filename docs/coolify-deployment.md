# Coolify Deployment Guide — Fairview Adonis

This guide covers deploying **fairview-adonis** to [Coolify](https://coolify.io) using the production `Dockerfile`, with your **existing remote Postgres** and persistent upload volumes.

## Architecture

```
Internet → Coolify Traefik (SSL) → App container (:3333)
                                        ↓
                              External Postgres (13.140.178.27:3815)
                              Volumes: /app/public/storage, /app/storage/app
```

Local development uses `docker-compose.yml` (app + Postgres + optional Redis).

---

## Prerequisites

1. **Coolify server** with Docker and a domain pointed at the app.
2. **Network access** from the Coolify host to `13.140.178.27:3815` (firewall / security group).
3. **Git repository** connected to Coolify (or manual Dockerfile deploy).
4. **APP_KEY** — generate once and store as a Coolify secret:
   ```bash
   node ace generate:key
   ```

---

## 1. Create the Coolify application

1. In Coolify: **New Resource → Application**.
2. Connect your Git repo (`fairview-adonis`).
3. **Build pack:** Dockerfile (root `Dockerfile`).
4. **Port:** `3333` (must match `PORT` env).
5. **Health check:**
   - Path: `/health/db`
   - Interval: `30s`
   - Timeout: `10s`
   - Retries: `3`
   - Start period: `60s` (migrations run on boot)

Fallback liveness (if DB check is too strict during cold start): `/up`

---

## 2. Environment variables (production)

Set these in Coolify → Application → Environment:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `3333` |
| `APP_KEY` | *(secret — from `node ace generate:key`)* |
| `LOG_LEVEL` | `info` |
| `SESSION_DRIVER` | `cookie` |
| `TZ` | `Africa/Lusaka` or `UTC` |
| `DB_HOST` | `13.140.178.27` |
| `DB_PORT` | `3815` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | *(secret)* |
| `DB_DATABASE` | `postgres` |
| `REPORTS_PROCESS_EXPORTS_SYNC` | `true` |
| `RUN_DICTIONARY_SYNC` | `false` *(see first deploy)* |

**Alternative DB config:** set `DATABASE_URL` instead of `DB_*`:

```
postgres://postgres:PASSWORD@13.140.178.27:3815/postgres
```

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

## 3. Persistent storage (critical)

Mount these volumes in Coolify → Application → **Storages** (or Persistent Storage):

| Container path | Purpose |
|---|---|
| `/app/public/storage` | Profile photos, clinic logo, staff signatures (`/storage/...` URLs) |
| `/app/storage/app` | Patient documents, CSV report exports |

**Without these mounts, every redeploy deletes uploads and exports.**

---

## 4. Deploy

1. Push code with `Dockerfile`, `docker/entrypoint.sh`, and `.dockerignore`.
2. Trigger deploy in Coolify.
3. On boot the entrypoint runs:
   - `node ace migration:run --force`
   - `node bin/server.js`

Check logs for `[entrypoint] Starting HTTP server...`.

---

## 5. First deploy checklist

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

## 6. Local docker-compose (full stack)

For local parity with production (uses bundled Postgres, not remote):

```bash
cp .env.docker.example .env.docker
node ace generate:key   # paste into APP_KEY in .env.docker
docker compose up -d --build
```

Optional Redis (future queue/transmit):

```bash
docker compose --profile with-redis up -d
```

First-time dictionary seed:

```bash
docker compose exec app node ace dictionary:sync
```

Stop:

```bash
docker compose down
```

---

## 7. Rollback & redeploy

- **Redeploy:** Coolify rebuilds the image; entrypoint re-runs migrations (idempotent).
- **Rollback:** Redeploy a previous Git commit in Coolify.
- **Data:** Uploads survive only if volume mounts are configured.

---

## 8. Troubleshooting

### Database connection timeout

- Coolify host cannot reach `13.140.178.27:3815`.
- Fix firewall / allowlist the Coolify server IP on the Postgres host.

### 502 Bad Gateway after deploy

- Check container logs for migration failures.
- Ensure `APP_KEY` is set.
- Ensure `HOST=0.0.0.0` and port `3333` match Coolify port mapping.

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

## 9. What is not in v1

| Item | Status |
|---|---|
| Separate queue worker container | Not needed — inline queue |
| Redis required | Optional in compose only |
| S3 object storage | Disk volumes for now |
| CI pipeline | Use Coolify Git integration |

---

## File reference

| File | Role |
|---|---|
| [`Dockerfile`](../Dockerfile) | Multi-stage production image |
| [`docker/entrypoint.sh`](../docker/entrypoint.sh) | Migrate + optional dictionary sync + start server |
| [`docker-compose.yml`](../docker-compose.yml) | Local app + Postgres + optional Redis |
| [`.env.docker.example`](../.env.docker.example) | Local compose env template |
| [`start/env.ts`](../start/env.ts) | Validated environment variables |
| [`config/database.ts`](../config/database.ts) | `DATABASE_URL` or `DB_*` connection |
