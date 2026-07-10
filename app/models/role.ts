import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Permission from './permission.js'

export default class Role extends BaseModel {
  static table = 'roles'

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
   * Permissions granted to this role via `role_has_permissions`.
   */
  @manyToMany(() => Permission, {
    pivotTable: 'role_has_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
  })
  declare permissions: ManyToMany<typeof Permission>

  /**
   * Staff users holding this role via the polymorphic `model_has_roles` pivot.
   * Scope queries with `.wherePivot('model_type', 'App\\Models\\User')`.
   */
  @manyToMany(() => User, {
    pivotTable: 'model_has_roles',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'model_id',
    pivotColumns: ['model_type'],
  })
  declare users: ManyToMany<typeof User>
}
