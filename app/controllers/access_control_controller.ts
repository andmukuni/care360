import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import Permission from '#models/permission'
import User from '#models/user'
import RbacService, { USER_MORPH_TYPE } from '#services/auth/rbac_service'

/**
 * RBAC administration. Ported from App\Http\Controllers\AccessControlController.
 *
 * Role/permission assignment lives in the Spatie-style pivot tables
 * (`model_has_roles`, `role_has_permissions`). Since RbacService only exposes
 * read helpers, the sync operations are performed with raw pivot writes here
 * (scoping `model_has_roles` to the `App\\Models\\User` morph type).
 */
async function existingRoleNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const rows = await db.from('roles').whereIn('name', names).select('name')
  return rows.map((r) => String(r.name))
}

async function syncUserRoles(user: User, roleNames: string[]): Promise<void> {
  const valid = await existingRoleNames(roleNames)
  const roleRows = valid.length ? await db.from('roles').whereIn('name', valid).select('id') : []

  await db
    .from('model_has_roles')
    .where('model_type', USER_MORPH_TYPE)
    .where('model_id', user.id)
    .delete()

  if (roleRows.length) {
    await db.table('model_has_roles').multiInsert(
      roleRows.map((r) => ({ role_id: r.id, model_type: USER_MORPH_TYPE, model_id: user.id }))
    )
  }

  RbacService.forget(user)
}

async function syncRolePermissions(role: Role, permissionNames: string[]): Promise<void> {
  const permRows = permissionNames.length
    ? await db.from('permissions').whereIn('name', permissionNames).select('id')
    : []

  await db.from('role_has_permissions').where('role_id', role.id).delete()

  if (permRows.length) {
    await db.table('role_has_permissions').multiInsert(
      permRows.map((p) => ({ permission_id: p.id, role_id: role.id }))
    )
  }
}

const storeRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(100).regex(/^[a-z0-9-]+$/),
  })
)

const permissionsValidator = vine.compile(
  vine.object({
    permissions: vine.array(vine.string()).optional(),
  })
)

const rolesValidator = vine.compile(
  vine.object({
    roles: vine.array(vine.string()).optional(),
    _redirect: vine.string().optional(),
  })
)

export default class AccessControlController {
  async index({ inertia }: HttpContext) {
    const roles = await Role.query()
      .preload('permissions', (q) => q.select('id', 'name'))
      .orderBy('name')

    const userCountRows = await db
      .from('model_has_roles')
      .where('model_type', USER_MORPH_TYPE)
      .groupBy('role_id')
      .select('role_id')
      .count('* as total')
    const userCounts = new Map<number, number>()
    for (const row of userCountRows) {
      userCounts.set(Number(row.role_id), Number(row.total))
    }

    const permissions = await Permission.query().orderBy('name').select('id', 'name')
    const permissionGroups: Record<string, { id: number; name: string }[]> = {}
    for (const p of permissions) {
      const key = p.name.split('.')[0] || 'other'
      ;(permissionGroups[key] ??= []).push({ id: p.id, name: p.name })
    }

    const users = await User.query()
      .preload('roles', (q) => q.wherePivot('model_type', USER_MORPH_TYPE).select('id', 'name'))
      .orderBy('name')
      .select('id', 'name', 'email')

    return inertia.render('access-control/index', {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions.map((p) => p.name),
        permissions_count: r.permissions.length,
        users_count: userCounts.get(r.id) ?? 0,
      })),
      permissionGroups,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles.map((r) => r.name),
      })),
    })
  }

  async userRoles({ inertia }: HttpContext) {
    const roles = await Role.query().orderBy('name').select('id', 'name')

    const users = await User.query()
      .preload('roles', (q) => q.wherePivot('model_type', USER_MORPH_TYPE).select('id', 'name'))
      .orderBy('name')
      .select('id', 'name', 'email')

    return inertia.render('access-control/user-roles', {
      roles: roles.map((r) => ({ id: r.id, name: r.name })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles.map((r) => r.name),
      })),
    })
  }

  async storeRole({ request, response, session }: HttpContext) {
    const { name } = await request.validateUsing(storeRoleValidator)

    const existing = await Role.query().where('name', name).first()
    if (existing) {
      session.flash('error', 'A role with that name already exists.')
      return response.redirect().back()
    }

    await Role.create({ name, guardName: 'web' })

    session.flash('success', 'Role created successfully.')
    return response.redirect().toPath('/access-control')
  }

  async updateRolePermissions({ params, request, response, session }: HttpContext) {
    const role = await Role.findOrFail(params.role)
    const { permissions } = await request.validateUsing(permissionsValidator)

    if (role.name === 'super-admin') {
      session.flash('error', 'The super-admin role is protected and always has all permissions.')
      return response.redirect().toPath('/access-control')
    }

    await syncRolePermissions(role, permissions ?? [])

    session.flash('success', `Permissions updated for role: ${role.name}.`)
    return response.redirect().toPath('/access-control')
  }

  async updateUserRoles({ params, request, response, session }: HttpContext) {
    const user = await User.findOrFail(params.user)
    const { roles, _redirect } = await request.validateUsing(rolesValidator)

    await syncUserRoles(user, roles ?? [])

    const target =
      _redirect === 'access-control.user-roles' ? '/access-control/user-roles' : '/access-control'

    session.flash('success', `Roles updated for ${user.name}.`)
    return response.redirect().toPath(target)
  }

  async destroyRole({ params, response, session }: HttpContext) {
    const role = await Role.findOrFail(params.role)

    if (role.name === 'super-admin') {
      session.flash('error', 'The super-admin role cannot be deleted.')
      return response.redirect().toPath('/access-control')
    }

    await db.from('role_has_permissions').where('role_id', role.id).delete()
    await db.from('model_has_roles').where('role_id', role.id).delete()
    await role.delete()

    session.flash('success', 'Role deleted successfully.')
    return response.redirect().toPath('/access-control')
  }
}
