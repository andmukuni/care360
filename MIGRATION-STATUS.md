# Migration Status — Laravel → AdonisJS 6 + Inertia + Vue 3

This document is the cutover reference for the port of the Fairview / International
Hospital Zambia Hospital Management System from **Laravel** to **AdonisJS 6 +
Inertia + Vue 3**. It records what is fully ported, the known gaps and deferred
infrastructure (with follow-up steps), and a cutover / rollback checklist.

- **New app (this repo):** `fairview-adonis/`
- **Original Laravel app (reference, read-only):** `../fairview`
- **Last verified:** Phase 8 (final). `tsc --noEmit` = **0 errors**; boot smoke test green (see below).

---

## 1. Fully ported and verified

| Area | Status | Notes |
| --- | --- | --- |
| App boot / config / env | ✅ | `node ace serve` boots clean on `localhost:3333`. |
| TypeScript | ✅ | `./node_modules/.bin/tsc --noEmit` → 0 errors project-wide. |
| Auth + RBAC | ✅ | Session guards (`web`, `patient`), token guards (`api`, `patient_api`), permission/role middleware. |
| Staff app | ✅ | 40 staff controllers + Inertia pages under `inertia/pages/**` (`StaffLayout`). |
| Patient portal (web) | ✅ | 15 portal controllers + pages (`PortalLayout` / `PortalGuestLayout`). |
| JSON APIs | ✅ | 22 API controllers under `/api/v1/portal/*` and `/api/v1/staff/*`. |
| Encounter engine | ✅ | Encounter lifecycle actions/services. |
| Billing & payments | ✅ | Invoices, payment collections, gateway webhooks, mobile-money (Lenco). |
| Reports / jobs / notifications | ✅ | Ported (see deferred infra for queue/PDF/mail specifics). |
| **PWA (Phase 8)** | ✅ | Dynamic manifest, service worker (Inertia-aware), offline page, icons, head tags + SW registration. |
| **Public wellness-fund (Phase 8)** | ✅ | `/wellness-fund`, `/wellness-fund/corporate` (GET/POST), `/wellness-fund/corporate/thank-you`. |
| **Mobile payment route reconciliation (Phase 8)** | ✅ | Canonical `/api/v1/portal/*` payment actions added; legacy `/portal/*` retained. |

### Phase 8 deliverables in detail

**PWA**
- `config/pwa.ts` — ported from `config/pwa.php` (reads `PWA_*` / `APP_NAME` env with identical defaults).
- `app/controllers/pwa_controller.ts` — serves the dynamic manifest as `application/manifest+json`.
- `public/sw.js` — adapted from the Laravel service worker for Inertia client-side navigation:
  network-first for navigations (full page loads **and** Inertia XHR visits, detected via the `X-Inertia`
  header), cache-first for static assets (`/assets/` Vite output, `/pwa/`, `/images/`, manifest, sw).
  Cache name bumped to `ihz-adonis-v1` so returning clients discard stale Laravel caches.
- `public/offline.html`, `public/pwa/{apple-touch-icon,icon-192,icon-512,icon-source}.png`,
  `public/images/app-icon.png` — copied from the Laravel `public/`.
- `resources/views/inertia_layout.edge` — added manifest link, `theme-color`, apple/mobile web-app metas,
  icon + apple-touch-icon links, and the service-worker registration script.

**Public wellness-fund**
- `app/controllers/corporate_membership_controller.ts` — ported from `CorporateMembershipController`
  (`show` / `store` / `thankYou`). Reuses `#support/wellness_fund_settings` and the
  `CorporateMembershipLead` model (neither modified). Validation mirrors `StoreCorporateLeadRequest`.
- `inertia/pages/wellness-fund/corporate.vue` + `corporate_thank_you.vue` — use `~/layouts/PortalGuestLayout.vue`.
- `start/routes/public.ts` — registers `/manifest.webmanifest` and the `/wellness-fund/*` group
  (a bare `/wellness-fund` index was added that resolves to the corporate page).

**Payment route reconciliation**
- Phase 5 flagged that the mobile app calls payment actions under `/api/v1/portal/*`, but Phase 6
  mounted them at `/portal/*` in `start/routes/payments.ts`, and Phase 5's `start/routes/api.ts`
  did **not** define them (it deferred to `payments.ts`).
- **Outcome:** the canonical mobile routes were **added** to `start/routes/api.ts`, delegating to the
  existing `app/controllers/api/portal/payment_controller.ts` (which reuses `MobileMoneyPaymentService`):
  - `POST /api/v1/portal/billing/invoices/:invoice/pay`
  - `GET  /api/v1/portal/payments`
  - `GET  /api/v1/portal/payments/:collection`
  - `POST /api/v1/portal/payments/:collection/otp`
  - `POST /api/v1/portal/payments/:collection/retry`
- The legacy `/portal/*` routes in `payments.ts` were **left in place** (backward compatibility);
  a note documenting the canonical location was added there.

### Boot smoke test (Phase 8, `node ace serve`)

| Route | Method | Expected | Result |
| --- | --- | --- | --- |
| `/manifest.webmanifest` | GET | 200 JSON (`application/manifest+json`) | ✅ 200, correct content-type + body |
| `/wellness-fund` | GET | 200 | ✅ 200 |
| `/wellness-fund/corporate` | GET | 200 | ✅ 200 |
| `/wellness-fund/corporate/thank-you` | GET | 200 | ✅ 200 |
| `/up` | GET | 200 | ✅ 200 |
| `/health/db` | GET | 200 | ✅ 200 |
| `/login` | GET | 200 | ✅ 200 |
| `/encounters` (staff, unauth) | GET | 302 → `/login` | ✅ 302 |
| `/api/v1/staff/login` (bad creds) | POST | 4xx JSON | ✅ 422 validation error |
| `/api/v1/portal/payments/1/otp` (unauth) | POST | 401 | ✅ 401 (confirms reconciled route registered) |
| `/sw.js`, `/offline.html`, `/pwa/icon-192.png` | GET | 200 | ✅ 200 (correct content-types) |

---

## 2. Known PORT-GAPs and deferred infrastructure

These require follow-up before/around production cutover. None block boot or typecheck; each is
currently stubbed, inlined, or documented in the relevant controller/service.

> ⚠️ **Phase 8 was constrained from running `npm install`.** The packages below are **documented, not
> installed** — install them as the first step of closing each gap.

### (a) HTML → PDF engine for downloads
- **Impact:** report / receipt / lab-result "download" endpoints currently return HTML (or a
  placeholder) instead of a real PDF.
- **Follow-up:**
  1. Add a PDF engine — recommended `puppeteer` (Chromium HTML→PDF, matches the Laravel Blade→PDF
     output most faithfully) or a lighter `@react-pdf`/`pdfkit` approach for simple documents.
  2. Introduce a `PdfService` (`#services/pdf/*`) that renders an Edge/HTML template to a buffer.
  3. Wire it into the report, billing receipt, and lab-result report controllers; set
     `Content-Type: application/pdf` + `Content-Disposition: attachment`.
  4. In production, run Chromium with `--no-sandbox` in the container or use a managed headless
     Chrome; cache/queue heavy PDF jobs (see (b)).

### (b) Real background queue worker + throttling
- **Impact:** background work (notifications, emails, heavy report/PDF generation) currently runs
  **inline** in the request lifecycle; API rate limiting (`throttle:6,1` / `throttle:60,1` in
  Laravel) is **not enforced**.
- **Follow-up:**
  1. Install `@rlanz/bull-queue` (or `@adonisjs/bullmq`) + Redis for a real worker; move inline
     dispatch calls to queued jobs; run the worker as a separate process (`node ace queue:listen`
     or equivalent) under the process manager.
  2. Install `@adonisjs/limiter` and add a throttle middleware; re-apply to `/api/v1/portal/*`
     auth routes (login/register/forgot-password) and the authenticated portal group to restore
     brute-force protection (see the `NOTE (throttling)` block in `start/routes/api.ts`).

### (c) Image optimization (profile / doctor photos)
- **Impact:** uploaded profile / doctor photos are stored as-is (no resize/format optimization);
  the Laravel app used image intervention/optimization.
- **Follow-up:**
  1. Install `sharp`.
  2. Add an `ImageService` (`#services/media/*`) to resize + convert to WebP on upload.
  3. Wire into the profile photo (`api/portal/profile_controller.ts` `updatePhoto`) and doctor/
     featured-doctor photo upload paths; store optimized derivatives.

### (d) Email transport for notifications
- **Impact:** transactional email (password reset links, portal invitations, notifications) is
  **not sent** — tokens are persisted and flows work, but no mail leaves the app.
- **Follow-up:**
  1. Install `@adonisjs/mail`; add `config/mail.ts` and the `MAIL_*` env vars.
  2. Configure a transport (SMTP / Resend / SES) for the target environment.
  3. Replace the "email sending is wired in a later phase" stubs (e.g. patient auth reset link,
     portal invitations, notification mailers) with real `mail.send(...)` calls, ideally queued (b).

### (e) Authenticated end-to-end parity testing vs. live Laravel
- **Impact:** smoke tests cover boot + unauthenticated/302 behavior; full authenticated parity
  (staff workflows, portal, mobile API) has not been diffed against the live Laravel app.
- **Follow-up:**
  1. Stand up the Laravel app and this app against a shared (or cloned) database snapshot.
  2. Script authenticated request/response comparisons for the critical journeys: registration →
     triage → encounter → billing → payment; portal login → appointments/billing; mobile API
     login → dashboard → pay.
  3. Reconcile any JSON-shape / redirect / permission differences before cutover.

### (f) Rotate the shared DB credential ⚠️ SECURITY
- **Impact:** a database credential was shared in chat during the migration and must be considered
  compromised.
- **Follow-up (do before production cutover):**
  1. Rotate the DB user password (and any other secret pasted in chat).
  2. Update `.env` (`DB_PASSWORD`) in every environment / secret store; never commit `.env`.
  3. Audit DB access logs for unexpected use of the old credential.

---

## 3. Packages to install (documented, NOT installed)

| Gap | Package(s) |
| --- | --- |
| (a) PDF | `puppeteer` (or `pdfkit` / `@react-pdf/renderer`) |
| (b) Queue | `@rlanz/bull-queue` (or `@adonisjs/bullmq`) + Redis |
| (b) Throttling | `@adonisjs/limiter` |
| (c) Images | `sharp` |
| (d) Mail | `@adonisjs/mail` |

Install with the package manager (latest versions), then run any `node ace configure <pkg>` steps.

---

## 4. Cutover / rollback checklist

### Pre-cutover
- [ ] Rotate the shared DB credential and all secrets pasted in chat (gap **f**).
- [ ] Install deferred packages and close gaps **a–d** (at minimum: mail + queue + throttling for a safe launch).
- [ ] Set production env: `APP_KEY`, `NODE_ENV=production`, `SESSION_DRIVER`, DB_*, PWA_* (optional), MAIL_*.
- [ ] Add `/payments/webhook/*` to `config/shield.ts` `csrf.exceptions` (documented in `start/routes/payments.ts`) so inbound gateway webhooks are not CSRF-blocked.
- [ ] Build assets: `node ace build` (or `npm run build`) → confirm `public/assets/.vite/manifest.json`.
- [ ] `./node_modules/.bin/tsc --noEmit` → 0 errors.
- [ ] Run authenticated E2E parity checks vs. Laravel (gap **e**).
- [ ] Verify PWA on a device: install prompt, offline page, service-worker update.
- [ ] Confirm payment gateway (Lenco) sandbox → live keys and webhook URL.

### Cutover
- [ ] Put Laravel app in maintenance mode; take a fresh DB backup/snapshot.
- [ ] Point DNS / reverse proxy to the AdonisJS app; run `node ace serve`/production process under the process manager (pm2/systemd) + worker process.
- [ ] Smoke test in production: `/up`, `/health/db`, `/login`, `/manifest.webmanifest`, a staff route (302), an API login, a real mobile-money payment in sandbox.
- [ ] Monitor logs + error tracking for the first hours.

### Rollback
- [ ] Repoint DNS / reverse proxy back to the Laravel app; disable Laravel maintenance mode.
- [ ] If schema changed during cutover, restore the pre-cutover DB snapshot (both apps share the schema; avoid destructive migrations during the cutover window to keep rollback cheap).
- [ ] Instruct PWA users to reload; the new service worker (`ihz-adonis-v1`) can be neutralized by shipping an empty/no-op `sw.js` if a cached client misbehaves.
- [ ] Re-rotate credentials if they were changed as part of cutover.
