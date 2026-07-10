/**
 * Generates short TDLTS barcodes in the format HXXXXXXXX / PXXXXXXXX.
 *
 * Faithful port of App\Support\TdltsBarcodeGenerator. The per-character hash
 * loop mirrors the original JS bitwise logic exactly (signed 32-bit rolls)
 * so that, for a given hash input, the resulting code matches the PHP output.
 */
export class TdltsBarcodeGenerator {
  static generate(prefix: string, id: string | number | null = null): string {
    const safePrefix = prefix.trim().toUpperCase() === 'P' ? 'P' : 'H'
    const timestamp = String(Date.now())
    const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      .toString(36)
      .substring(0, 6)
    const hashInput = `${id ?? ''}${timestamp}${random}`

    let hash1 = 0
    let hash2 = 0

    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i)
      // `| 0` forces signed 32-bit integer behaviour, matching the PHP
      // toSigned32() helper applied after each iteration.
      hash1 = (((hash1 << 5) - hash1 + char) | 0)
      hash2 = (((hash2 << 7) - hash2 + char) | 0)
    }

    const combinedHash = Math.abs((hash1 ^ hash2) | 0)
    const hashStr = combinedHash.toString(36).toUpperCase().padStart(8, '0').substring(0, 8)

    return safePrefix + hashStr
  }
}
