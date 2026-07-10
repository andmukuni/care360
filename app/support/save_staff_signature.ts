import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'

const PNG_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/

/**
 * Decode a canvas data URL and persist it under public/storage/staff-signatures.
 * Returns the relative storage path (e.g. staff-signatures/uuid.png).
 */
export function saveStaffSignatureFromDataUrl(dataUrl: string): string | null {
  const match = PNG_DATA_URL_RE.exec(dataUrl.trim())
  if (!match) {
    return null
  }

  const buffer = Buffer.from(match[1], 'base64')
  // Reject empty or near-empty canvases (tiny PNG blobs).
  if (buffer.length < 500 || buffer.length > 2 * 1024 * 1024) {
    return null
  }

  const dir = app.makePath('public/storage/staff-signatures')
  mkdirSync(dir, { recursive: true })
  const fileName = `${randomUUID()}.png`
  writeFileSync(app.makePath('public/storage/staff-signatures', fileName), buffer)

  return `staff-signatures/${fileName}`
}
