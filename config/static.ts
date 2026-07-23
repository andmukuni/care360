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
  // Default cache for static assets (Vite hashed files + public images)
  maxAge: '7d',
  headers: (path) => {
    // serve-static passes an absolute filesystem path — always return an object
    // (returning undefined crashes Object.keys in @adonisjs/static).
    const file = path.replace(/\\/g, '/')
    if (file.includes('/images/auth/')) {
      return {
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    }
    return {}
  },
})

export default staticServerConfig
