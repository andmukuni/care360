import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import RbacCache from '#services/cache/rbac_cache'
import { ROLE_NAV_PRIORITY, rolePermissionSyncMap } from '#support/staff/role_nav_profiles'

/**
 * Sync role → permission assignments from the canonical role nav / RBAC map.
 * Mirrors Laravel RolePermissionSeeder against Spatie pivot tables.
 *
 *   node ace rbac:sync-role-permissions
 *   node ace rbac:sync-role-permissions --dry-run
 *   node ace rbac:sync-role-permissions --all
 */
export default class SyncRolePermissions extends BaseCommand {
  static commandName = 'rbac:sync-role-permissions'
  static description =
    'Sync clinical role permissions (including all-stage view-queue previews) from the role nav map'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Show changes without writing' })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Also sync records-officer, system-auditor, shift-staff, and super-admin',
  })
  declare all: boolean

  async run() {
    const map = rolePermissionSyncMap()
    const clinicalRoles = new Set<string>(ROLE_NAV_PRIORITY)
    const allPermissionNames = (
      await db.from('permissions').select('name')
    ).map((row) => String(row.name))
    const allPermissionSet = new Set(allPermissionNames)

    let synced = 0
    let skipped = 0

    for (const [roleName, permissionNames] of Object.entries(map)) {
      if (!this.all && !clinicalRoles.has(roleName)) {
        continue
      }
      const role = await db.from('roles').where('name', roleName).where('guard_name', 'web').first()
      if (!role) {
        this.logger.warning(`Role missing, skipped: ${roleName}`)
        skipped++
        continue
      }

      const targetNames =
        permissionNames.length === 1 && permissionNames[0] === '*'
          ? allPermissionNames
          : permissionNames.filter((name) => {
              if (allPermissionSet.has(name)) return true
              this.logger.warning(`Permission missing for ${roleName}: ${name}`)
              return false
            })

      const existing = await db
        .from('role_has_permissions')
        .join('permissions', 'permissions.id', 'role_has_permissions.permission_id')
        .where('role_has_permissions.role_id', role.id)
        .select('permissions.name')

      const existingSet = new Set(existing.map((row) => String(row.name)))
      const targetSet = new Set(targetNames)
      const adding = targetNames.filter((name) => !existingSet.has(name))
      const removing = [...existingSet].filter((name) => !targetSet.has(name))

      this.logger.info(
        `${roleName}: ${targetNames.length} perms (+${adding.length} / -${removing.length})`
      )

      if (this.dryRun) {
        synced++
        continue
      }

      const permRows = targetNames.length
        ? await db.from('permissions').whereIn('name', targetNames).select('id')
        : []

      await db.from('role_has_permissions').where('role_id', role.id).delete()
      if (permRows.length) {
        await db.table('role_has_permissions').multiInsert(
          permRows.map((p) => ({ permission_id: p.id, role_id: role.id }))
        )
      }
      await RbacCache.forgetRole(roleName)
      synced++
    }

    if (this.dryRun) {
      this.logger.success(`Dry run complete. Would sync ${synced} roles (${skipped} skipped).`)
      return
    }

    this.logger.success(`Synced permissions for ${synced} roles (${skipped} skipped).`)
  }
}
