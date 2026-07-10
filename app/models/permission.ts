import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from './role.js'
import User from './user.js'

export default class Permission extends BaseModel {
  static table = 'permissions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare guardName: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  /**
   * Roles that grant this permission via `role_has_permissions`.
   */
  @manyToMany(() => Role, {
    pivotTable: 'role_has_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
  })
  declare roles: ManyToMany<typeof Role>

  /**
   * Staff users granted this permission directly via `model_has_permissions`.
   * Scope queries with `.wherePivot('model_type', 'App\\Models\\User')`.
   */
  @manyToMany(() => User, {
    pivotTable: 'model_has_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'model_id',
    pivotColumns: ['model_type'],
  })
  declare users: ManyToMany<typeof User>
}
