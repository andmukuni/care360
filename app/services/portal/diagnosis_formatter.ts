/**
 * Normalises diagnosis columns that may be plain text or JSON-encoded structured
 * entries into human-readable labels for patient-facing UI.
 *
 * Ported from App\Support\DiagnosisFormatter.
 *
 * PORT-GAP: in Laravel this lives under App\Support (app/support/*). It is placed
 * here under services/portal/ because this port may only create files under
 * app/services/portal/**. Ideally it should be relocated to app/support/.
 */
export default class DiagnosisFormatter {
  static format(raw: string | null | undefined): string {
    const value = String(raw ?? '').trim()
    if (value === '') {
      return ''
    }

    let decoded: unknown
    try {
      decoded = JSON.parse(value)
    } catch {
      decoded = undefined
    }

    if (!Array.isArray(decoded)) {
      const matches = value.match(/^\[(.*)\]$/s)
      if (matches) {
        return matches[1].trim()
      }

      return value
    }

    return decoded
      .map((entry): string => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          return String(entry ?? '').trim()
        }

        const e = entry as Record<string, unknown>

        let label = e.path
          ? String(e.path)
          : [e.level1, e.level2, e.level3]
              .filter((part) => Boolean(part))
              .map((part) => String(part))
              .join(' > ')

        const extras = [e.certainty, e.attendance]
          .filter((part) => Boolean(part))
          .map((part) => String(part))
          .join(', ')

        if (extras !== '') {
          label = `${label} (${extras})`.trim()
        }

        return label !== '' ? label : String(e.type ?? '').trim()
      })
      .filter((label) => label !== '')
      .join(' · ')
  }
}
