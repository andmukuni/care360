import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class StaffSignatureInvite extends BaseModel {
  static table = 'staff_signature_invites'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare token: string

  @column()
  declare createdBy: number | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  @column()
  declare signerIp: string | null

  @column()
  declare signerUserAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  isActive(): boolean {
    if (this.completedAt !== null && this.completedAt !== undefined) {
      return false
    }

    const expires =
      this.expiresAt instanceof DateTime
        ? this.expiresAt
        : DateTime.fromISO(String(this.expiresAt ?? ''))

    return expires.isValid && expires > DateTime.now()
  }
}
