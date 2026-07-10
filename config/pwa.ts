/*
|--------------------------------------------------------------------------
| PWA configuration
|--------------------------------------------------------------------------
|
| Ported from the Laravel `config/pwa.php`. Drives the dynamic web app
| manifest served by `PwaController` and the PWA head tags injected into the
| Inertia root template (`resources/views/inertia_layout.edge`).
|
| Values are read from the environment with the same defaults as the Laravel
| original. These keys are intentionally read from `process.env` (rather than
| the typed `#start/env` service) so that no changes to `start/env.ts` are
| required to expose them.
|
*/

const appName = process.env.PWA_NAME ?? process.env.APP_NAME ?? 'International Hospital Zambia'

const pwaConfig = {
  name: appName,
  shortName: process.env.PWA_SHORT_NAME ?? 'International Hospital Zambia',
  description:
    process.env.PWA_DESCRIPTION ?? 'Hospital management system for International Hospital Zambia',
  themeColor: process.env.PWA_THEME_COLOR ?? '#171717',
  backgroundColor: process.env.PWA_BACKGROUND_COLOR ?? '#ffffff',
  startUrl: process.env.PWA_START_URL ?? '/',
  scope: process.env.PWA_SCOPE ?? '/',
}

export default pwaConfig
