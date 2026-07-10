import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import RbacCache from '#services/cache/rbac_cache'

/**
 * RBAC service — replacement for spatie/laravel-permission.
 *
 * The RBAC data lives in the same tables Laravel/Spatie used:
 *   - roles(id, name, guard_name)
 *   - permissions(id, name, guard_name)
 *   - model_has_roles(role_id, model_type, model_id)
 *   - model_has_permissions(permission_id, model_type, model_id)
 *   - role_has_permissions(role_id, permission_id)
 *
 * Spatie stores the owning model as a polymorphic string. For staff users the
 * stored value is the original Laravel FQCN, verified against the live DB:
 *   model_type = 'App\\Models\\User'
 */
export const USER_MORPH_TYPE = 'App\\Models\\User'

interface RbacSnapshot {
  roleNames: string[]
  directPermissionNames: string[]
  permissionNames: string[]
}

/**
 * Per-request memoisation so repeated hasRole()/hasPermission() checks against
 * the same user instance don't re-hit the database. Mirrors Eloquent's
 * loadMissing() relation caching.
 */
const cache = new WeakMap<object, RbacSnapshot>()

export default class RbacService {
  /**
   * Load (and cache) the role names, direct permission names and the full
   * effective permission set (direct + inherited via roles) for a user.
   */
  static async snapshot(user: User): Promise<RbacSnapshot> {
    const cached = cache.get(user)
    if (cached) {
      return cached
    }

    const redisCached = await RbacCache.getOrSet(user.id, async () => {
      return this.loadSnapshotFromDatabase(user)
    })

    cache.set(user, redisCached)
    return redisCached
  }

  private static async loadSnapshotFromDatabase(user: User): Promise<RbacSnapshot> {
    const [roleRows, directRows, viaRoleRows] = await Promise.all([
      db
        .from('roles')
        .join('model_has_roles', 'model_has_roles.role_id', 'roles.id')
        .where('model_has_roles.model_type', USER_MORPH_TYPE)
        .where('model_has_roles.model_id', user.id)
        .select('roles.name'),
      db
        .from('permissions')
        .join('model_has_permissions', 'model_has_permissions.permission_id', 'permissions.id')
        .where('model_has_permissions.model_type', USER_MORPH_TYPE)
        .where('model_has_permissions.model_id', user.id)
        .select('permissions.name'),
      db
        .from('permissions')
        .join('role_has_permissions', 'role_has_permissions.permission_id', 'permissions.id')
        .join('model_has_roles', 'model_has_roles.role_id', 'role_has_permissions.role_id')
        .where('model_has_roles.model_type', USER_MORPH_TYPE)
        .where('model_has_roles.model_id', user.id)
        .select('permissions.name'),
    ])

    const roleNames = roleRows.map((r) => String(r.name))
    const directPermissionNames = directRows.map((r) => String(r.name))
    const permissionNames = [
      ...new Set([...directPermissionNames, ...viaRoleRows.map((r) => String(r.name))]),
    ]

    return { roleNames, directPermissionNames, permissionNames }
  }

  /**
   * Clear the cached snapshot for a user (call after mutating role/permission
   * assignments so subsequent checks reflect the change).
   */
  static forget(user: User): void {
    cache.delete(user)
    void RbacCache.forgetUser(user.id)
  }

  static async getRoleNames(user: User): Promise<string[]> {
    return (await this.snapshot(user)).roleNames
  }

  /**
   * Every effective permission name: those assigned directly plus those
   * inherited through the user's roles.
   */
  static async getPermissionNames(user: User): Promise<string[]> {
    return (await this.snapshot(user)).permissionNames
  }

  /**
   * Only the permissions assigned directly to the user (no role inheritance).
   * Mirrors Spatie's getDirectPermissions().
   */
  static async getDirectPermissionNames(user: User): Promise<string[]> {
    return (await this.snapshot(user)).directPermissionNames
  }

  static async hasRole(user: User, role: string): Promise<boolean> {
    return (await this.getRoleNames(user)).includes(role)
  }

  static async hasAnyRole(user: User, roles: string[]): Promise<boolean> {
    const names = await this.getRoleNames(user)
    return roles.some((role) => names.includes(role))
  }

  static async hasPermission(user: User, permission: string): Promise<boolean> {
    return (await this.getPermissionNames(user)).includes(permission)
  }

  static async hasAnyPermission(user: User, permissions: string[]): Promise<boolean> {
    const names = await this.getPermissionNames(user)
    return permissions.some((permission) => names.includes(permission))
  }

  /**
   * "Legacy" user: has no roles AND no directly-assigned permissions. These
   * accounts predate the RBAC rollout and are granted full access, matching
   * the behaviour of PermissionOrLegacyMiddleware / EncounterPolicy.
   */
  static async isLegacyUserWithoutRbac(user: User): Promise<boolean> {
    const snapshot = await this.snapshot(user)
    return snapshot.roleNames.length === 0 && snapshot.directPermissionNames.length === 0
  }
}
