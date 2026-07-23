import { defineConfig } from '@adonisjs/static'

/**
 * Configuration options to tweak the static files middleware.
 * The complete set of options are documented on the
 * official documentation website.
 *
 * https://docs.adonisjs.com/guides/basics/static-file-server
 */
const staticServerConfig = defineConfig({
  enabled: true,
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
  // Default cache for static assets; auth hero overrides below with 1 year
  maxAge: '7d',
  headers: (path) => {
    const normalized = path.replace(/^\/+/, '')
    // Login hero is fingerprinted by filename; cache aggressively so repeat visits skip download
    if (normalized.startsWith('images/auth/')) {
      return {
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    }
  },
})

export default staticServerConfig
