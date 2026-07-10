import { createHash, randomBytes } from 'node:crypto'
import { Secret, safeEqual } from '@adonisjs/core/helpers'
import string from '@adonisjs/core/helpers/string'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import type { AccessTokensProviderContract } from '@adonisjs/auth/types/access_tokens'
import db from '@adonisjs/lucid/services/db'
import type { LucidModel } from '@adonisjs/lucid/types/model'

/**
 * Sanctum-compatible access-tokens provider.
 *
 * The live database was created by a Laravel app using Laravel Sanctum, whose
 * `personal_access_tokens` table differs from the one AdonisJS's stock
 * DbAccessTokensProvider expects:
 *
 *   Sanctum columns : id, tokenable_type, tokenable_id, name, token (sha256 hex),
 *                     abilities (json text), last_used_at, expires_at, timestamps
 *   Adonis columns  : id, tokenable_id, type, name, hash, abilities, ...
 *
 * Sanctum's public token string is `<id>|<plainText>` where the stored `token`
 * value is the sha256 hex digest of the `<plainText>` portion. This provider
 * reproduces that scheme so tokens issued by (or already living in) the Laravel
 * database authenticate transparently, and tokens issued here are readable by
 * the Laravel app.
 *
 * The table is polymorphic and shared between staff (`App\Models\User`) and
 * patients (`App\Models\Patient`). Each provider instance is scoped to a single
 * `tokenableType` so a patient token can never authenticate a staff guard (and
 * vice versa) at the provider level.
 */
export type SanctumAccessTokensProviderOptions<TokenableModel extends LucidModel> = {
  /**
   * The Lucid model the tokens belong to. Used to enforce that create/delete
   * operations receive a persisted instance of the right model.
   */
  tokenableModel: TokenableModel

  /**
   * The polymorphic morph value stored in `tokenable_type`, e.g.
   * `App\\Models\\Patient` or `App\\Models\\User`.
   */
  tokenableType: string

  /**
   * Database table. Defaults to Sanctum's `personal_access_tokens`.
   */
  table?: string

  /**
   * Default expiry applied to newly created tokens. Sanctum defaults to no
   * expiry (long-lived tokens).
   */
  expiresIn?: string | number

  /**
   * Length of the random secret portion of the token. Sanctum uses 40.
   */
  tokenSecretLength?: number
}

type SanctumTokenRow = {
  id: number | string
  tokenable_type: string
  tokenable_id: number | string
  name: string | null
  token: string
  abilities: string | null
  last_used_at: Date | string | null
  expires_at: Date | string | null
  created_at: Date | string | null
  updated_at: Date | string | null
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Generate the plain-text secret portion of a Sanctum token. Laravel uses
 * `Str::random(40)` (alphanumeric); the exact alphabet is irrelevant for
 * round-tripping since only the sha256 digest is persisted.
 */
function randomSecret(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

export class SanctumAccessTokensProvider<TokenableModel extends LucidModel>
  implements AccessTokensProviderContract<TokenableModel>
{
  protected options: SanctumAccessTokensProviderOptions<TokenableModel>
  protected table: string
  protected tokenSecretLength: number

  constructor(options: SanctumAccessTokensProviderOptions<TokenableModel>) {
    this.options = options
    this.table = options.table || 'personal_access_tokens'
    this.tokenSecretLength = options.tokenSecretLength || 40
  }

  /**
   * Factory mirroring DbAccessTokensProvider.forModel for drop-in use in models.
   */
  static forModel<TokenableModel extends LucidModel>(
    model: TokenableModel,
    options: Omit<SanctumAccessTokensProviderOptions<TokenableModel>, 'tokenableModel'>
  ): SanctumAccessTokensProvider<TokenableModel> {
    return new SanctumAccessTokensProvider({ tokenableModel: model, ...options })
  }

  #ensureIsPersisted(user: InstanceType<TokenableModel>): void {
    const model = this.options.tokenableModel
    if (user instanceof model === false) {
      throw new Error(`Invalid user object. It must be an instance of the "${model.name}" model`)
    }
    if (!(user as any).$primaryKeyValue) {
      throw new Error(
        `Cannot use "${model.name}" model for managing access tokens. The primary key is undefined`
      )
    }
  }

  #rowToAccessToken(row: SanctumTokenRow): AccessToken {
    return new AccessToken({
      identifier: Number(row.id),
      tokenableId: Number(row.tokenable_id),
      type: 'auth_token',
      name: row.name,
      // Sanctum stores the sha256 digest in `token`; AccessToken.verify() also
      // hashes with sha256, so exposing it as `hash` keeps `.verify()` working.
      hash: row.token,
      abilities: row.abilities ? (JSON.parse(row.abilities) as string[]) : ['*'],
      createdAt: toDate(row.created_at) ?? new Date(),
      updatedAt: toDate(row.updated_at) ?? new Date(),
      lastUsedAt: toDate(row.last_used_at),
      expiresAt: toDate(row.expires_at),
    })
  }

  /**
   * Create and persist a token for the given user, returning an AccessToken
   * whose `.value` is the public `<id>|<plainText>` string.
   */
  async create(
    user: InstanceType<TokenableModel>,
    abilities: string[] = ['*'],
    options?: { name?: string; expiresIn?: string | number }
  ): Promise<AccessToken> {
    this.#ensureIsPersisted(user)

    const plainText = randomSecret(this.tokenSecretLength)
    const hashed = sha256(plainText)

    const expiresInValue = options?.expiresIn ?? this.options.expiresIn
    let expiresAt: Date | null = null
    if (expiresInValue) {
      expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + string.seconds.parse(expiresInValue))
    }

    const now = new Date()
    const abilitiesJson = JSON.stringify(abilities)

    const result = await db
      .table(this.table)
      .insert({
        tokenable_type: this.options.tokenableType,
        tokenable_id: (user as any).$primaryKeyValue,
        name: options?.name ?? null,
        token: hashed,
        abilities: abilitiesJson,
        last_used_at: null,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      })
      .returning('id')

    const rawId = result[0]
    const id = typeof rawId === 'object' && rawId !== null ? (rawId as any).id : rawId

    const token = new AccessToken({
      identifier: Number(id),
      tokenableId: Number((user as any).$primaryKeyValue),
      type: 'auth_token',
      name: options?.name ?? null,
      hash: hashed,
      abilities,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      expiresAt,
    })

    // Sanctum public token format: "<id>|<plainText>".
    token.value = new Secret(`${id}|${plainText}`)

    return token
  }

  /**
   * Verify a publicly shared token. Returns the AccessToken when valid and not
   * expired, otherwise null. Scoped to this provider's tokenableType.
   */
  async verify(tokenValue: Secret<string>): Promise<AccessToken | null> {
    const raw = tokenValue.release()
    if (!raw) return null

    let identifier: string | null = null
    let plainText = raw

    const sepIndex = raw.indexOf('|')
    if (sepIndex > -1) {
      identifier = raw.slice(0, sepIndex)
      plainText = raw.slice(sepIndex + 1)
    }

    if (!plainText) return null

    const digest = sha256(plainText)

    const query = db.query<SanctumTokenRow>().from(this.table).where('tokenable_type', this.options.tokenableType)

    if (identifier !== null) {
      if (!/^\d+$/.test(identifier)) return null
      query.where('id', identifier)
    } else {
      // Tokens without an explicit id are matched by their digest directly.
      query.where('token', digest)
    }

    const row = await query.limit(1).first()
    if (!row) return null

    // Constant-time comparison of the stored digest and the computed digest.
    if (!safeEqual(row.token, digest)) return null

    const accessToken = this.#rowToAccessToken(row)
    if (accessToken.isExpired()) return null

    // Touch last_used_at (best-effort; mirrors Sanctum behaviour).
    const now = new Date()
    await db.from(this.table).where('id', row.id).update({ last_used_at: now })

    return accessToken
  }

  /**
   * Invalidate a token by its public value.
   */
  async invalidate(tokenValue: Secret<string>): Promise<boolean> {
    const raw = tokenValue.release()
    if (!raw) return false

    const sepIndex = raw.indexOf('|')
    const query = db.from(this.table).where('tokenable_type', this.options.tokenableType)

    if (sepIndex > -1) {
      const identifier = raw.slice(0, sepIndex)
      if (!/^\d+$/.test(identifier)) return false
      query.where('id', identifier)
    } else {
      query.where('token', sha256(raw))
    }

    const affected = await query.del()
    return Number(affected) > 0
  }

  /**
   * Find a token owned by the user by its id. Used by portal middleware.
   */
  async find(
    user: InstanceType<TokenableModel>,
    identifier: string | number | BigInt
  ): Promise<AccessToken | null> {
    this.#ensureIsPersisted(user)
    const row = await db
      .query<SanctumTokenRow>()
      .from(this.table)
      .where('id', identifier.toString())
      .where('tokenable_type', this.options.tokenableType)
      .where('tokenable_id', (user as any).$primaryKeyValue)
      .limit(1)
      .first()

    return row ? this.#rowToAccessToken(row) : null
  }

  /**
   * Delete a single token owned by the user. Used by portal middleware to burn
   * a token when access is withdrawn.
   */
  async delete(
    user: InstanceType<TokenableModel>,
    identifier: string | number | BigInt
  ): Promise<number> {
    this.#ensureIsPersisted(user)
    const affected = await db
      .from(this.table)
      .where('id', identifier.toString())
      .where('tokenable_type', this.options.tokenableType)
      .where('tokenable_id', (user as any).$primaryKeyValue)
      .del()

    return Number(affected)
  }

  /**
   * Delete all tokens for a user (optionally scoped to a device/name).
   */
  async deleteAll(user: InstanceType<TokenableModel>, name?: string): Promise<number> {
    this.#ensureIsPersisted(user)
    const query = db
      .from(this.table)
      .where('tokenable_type', this.options.tokenableType)
      .where('tokenable_id', (user as any).$primaryKeyValue)

    if (name !== undefined) {
      query.where('name', name)
    }

    const affected = await query.del()
    return Number(affected)
  }

  /**
   * All tokens for a user, newest first.
   */
  async all(user: InstanceType<TokenableModel>): Promise<AccessToken[]> {
    this.#ensureIsPersisted(user)
    const rows = await db
      .query<SanctumTokenRow>()
      .from(this.table)
      .where('tokenable_type', this.options.tokenableType)
      .where('tokenable_id', (user as any).$primaryKeyValue)
      .orderBy('id', 'desc')

    return rows.map((row) => this.#rowToAccessToken(row))
  }
}
