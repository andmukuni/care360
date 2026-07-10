import { existsSync, mkdirSync } from 'node:fs'
import app from '@adonisjs/core/services/app'

/**
 * Public URL for a file under public/storage, or null when the path is empty
 * or the file is missing (e.g. after redeploy without a persistent volume).
 */
export function publicStorageUrl(relativePath: string | null | undefined): string | null {
  const path = relativePath?.trim()
  if (!path) {
    return null
  }

  const absolute = app.makePath('public/storage', path)
  if (!existsSync(absolute)) {
    return null
  }

  return `/storage/${path}`
}

/**
 * Ensure upload directories exist under public/storage on container boot.
 */
export function ensurePublicStorageDirs(): void {
  const dirs = [
    'profile-photos',
    'staff-signatures',
    'clinic-branding',
    'patient-profile-photos',
  ]

  for (const dir of dirs) {
    mkdirSync(app.makePath('public/storage', dir), { recursive: true })
  }
}
