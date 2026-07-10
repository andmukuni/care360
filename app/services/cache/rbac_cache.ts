import cache from '@adonisjs/cache/services/main'
import env from '#start/env'

export const RBAC_TAG = 'rbac'

export interface RbacSnapshotPayload {
  roleNames: string[]
  directPermissionNames: string[]
  permissionNames: string[]
}

const RBAC_TTL = env.get('CACHE_RBAC_TTL', '1h')

export function rbacUserKey(userId: number | string): string {
  return `rbac:user:${userId}`
}

export function rbacUserTag(userId: number | string): string {
  return `rbac:user:${userId}`
}

export function rbacRoleTag(roleName: string): string {
  return `rbac:role:${roleName}`
}

export default class RbacCache {
  static ttl(): string {
    return RBAC_TTL
  }

  static async getOrSet(
    userId: number,
    factory: () => Promise<RbacSnapshotPayload>
  ): Promise<RbacSnapshotPayload> {
    const cached = await cache.get<RbacSnapshotPayload>({ key: rbacUserKey(userId) })
    if (cached) {
      return cached
    }

    const snapshot = await factory()
    await cache.set({
      key: rbacUserKey(userId),
      value: snapshot,
      ttl: RBAC_TTL,
      tags: [
        RBAC_TAG,
        rbacUserTag(userId),
        ...snapshot.roleNames.map((role) => rbacRoleTag(role)),
      ],
    })

    return snapshot
  }

  static async forgetUser(userId: number): Promise<void> {
    await cache.deleteMany({ keys: [rbacUserKey(userId)] })
    await cache.deleteByTag({ tags: [rbacUserTag(userId)] })
  }

  static async forgetRole(roleName: string): Promise<void> {
    await cache.deleteByTag({ tags: [rbacRoleTag(roleName)] })
  }
}
