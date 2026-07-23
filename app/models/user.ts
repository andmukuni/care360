import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import { SanctumAccessTokensProvider } from '#lib/sanctum_access_tokens_provider'
import RbacService from '#services/auth/rbac_service'
import Encounter from './encounter.js'
import Role from './role.js'
import Permission from './permission.js'

/**
 * Staff user. Backed by the existing `users` table. Passwords are Laravel
 * bcrypt hashes ($2y$...); the "laravel_bcrypt" hash driver (configured in
 * config/hash.ts) verifies them transparently.
 */
const AuthFinder = withAuthFinder(() => hash.use('laravel_bcrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  static table = 'users'

  /**
   * Access tokens for the staff JSON API. Backed by the Sanctum-compatible
   * `personal_access_tokens` table (shared with patient tokens via the
   * polymorphic tokenable columns).
   */
  static accessTokens = SanctumAccessTokensProvider.forModel(User, {
    table: 'personal_access_tokens',
    tokenableType: 'App\\Models\\User',
  })

  /**
   * The access token used to authenticate the current request (set by the
   * access-tokens guard).
   */
  declare currentAccessToken?: AccessToken

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare title: string | null

  @column()
  declare specialty: string | null

  @column()
  declare bio: string | null

  @column()
  declare isPortalBookable: boolean

  @column()
  declare rating: number | null

  @column()
  declare patientsCount: number | null

  @column()
  declare yearsExperience: number | null

  @column()
  declare reviewCount: number | null

  @column()
  declare sessionFee: number | null

  @column()
  declare email: string

  @column()
  declare profilePhotoPath: string | null

  @column()
  declare signaturePath: string | null

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column({ serializeAs: null })
  declare password: string

  /**
   * When true, staff must visit the post-login password choice page
   * (change to a new password, or explicitly keep the current one).
   */
  @column()
  declare mustChangePassword: boolean

  @column({ serializeAs: null })
  declare rememberToken: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Encounter, { foreignKey: 'startedBy' })
  declare startedEncounters: HasMany<typeof Encounter>

  @hasMany(() => Encounter, { foreignKey: 'closedBy' })
  declare closedEncounters: HasMany<typeof Encounter>

  /**
   * Roles assigned to this user via the Spatie-style `model_has_roles` pivot.
   * The pivot is polymorphic; queries should scope to the staff morph type via
   * `.wherePivot('model_type', USER_MORPH_TYPE)`. Prefer the RBAC helper
   * methods below (they apply the scope for you).
   */
  @manyToMany(() => Role, {
    pivotTable: 'model_has_roles',
    pivotForeignKey: 'model_id',
    pivotRelatedForeignKey: 'role_id',
    pivotColumns: ['model_type'],
  })
  declare roles: ManyToMany<typeof Role>

  /**
   * Permissions assigned directly to this user (not via a role) through the
   * polymorphic `model_has_permissions` pivot.
   */
  @manyToMany(() => Permission, {
    pivotTable: 'model_has_permissions',
    pivotForeignKey: 'model_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotColumns: ['model_type'],
  })
  declare permissions: ManyToMany<typeof Permission>

  /**
   * RBAC convenience helpers. These delegate to RbacService which reads the
   * Spatie tables and applies the `App\\Models\\User` morph scope.
   */
  getRoleNames(): Promise<string[]> {
    return RbacService.getRoleNames(this)
  }

  getPermissionNames(): Promise<string[]> {
    return RbacService.getPermissionNames(this)
  }

  getDirectPermissionNames(): Promise<string[]> {
    return RbacService.getDirectPermissionNames(this)
  }

  hasRole(role: string): Promise<boolean> {
    return RbacService.hasRole(this, role)
  }

  hasAnyRole(roles: string[]): Promise<boolean> {
    return RbacService.hasAnyRole(this, roles)
  }

  hasPermission(permission: string): Promise<boolean> {
    return RbacService.hasPermission(this, permission)
  }

  hasAnyPermission(permissions: string[]): Promise<boolean> {
    return RbacService.hasAnyPermission(this, permissions)
  }

  /**
   * Spatie alias: `can()` checks a single permission.
   */
  can(permission: string): Promise<boolean> {
    return RbacService.hasPermission(this, permission)
  }

  isLegacyUserWithoutRbac(): Promise<boolean> {
    return RbacService.isLegacyUserWithoutRbac(this)
  }
}
