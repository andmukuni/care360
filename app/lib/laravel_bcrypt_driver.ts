import bcrypt from 'bcryptjs'
import type { HashDriverContract } from '@adonisjs/core/types/hash'

/**
 * Hash driver that is compatible with Laravel's bcrypt hashes ($2y$...).
 *
 * Laravel stores bcrypt hashes with the `$2y$` prefix. bcryptjs understands
 * `$2a$`/`$2b$`, so we normalise the prefix for verification. New hashes are
 * produced with the `$2b$` prefix (also verifiable by Laravel).
 */
export class LaravelBcryptDriver implements HashDriverContract {
  constructor(private rounds: number = 10) {}

  private normalize(hash: string): string {
    if (hash.startsWith('$2y$')) return '$2b$' + hash.slice(4)
    return hash
  }

  isValidHash(value: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(value)
  }

  async make(value: string): Promise<string> {
    return bcrypt.hash(value, this.rounds)
  }

  async verify(hashedValue: string, plainValue: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainValue, this.normalize(hashedValue))
    } catch {
      return false
    }
  }

  needsReHash(hashedValue: string): boolean {
    // Re-hash anything that is not already a bcrypt hash.
    return !this.isValidHash(hashedValue)
  }
}
