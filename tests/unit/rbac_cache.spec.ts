import { test } from '@japa/runner'
import cache from '@adonisjs/cache/services/main'
import RbacCache, { rbacRoleTag, rbacUserKey } from '#services/cache/rbac_cache'

test.group('RBAC cache service', () => {
  test('getOrSet caches snapshot and tags role names', async ({ assert }) => {
    let factoryCalls = 0
    const userId = 42_001

    const snapshot = {
      roleNames: ['nurse', 'lab-tech'],
      directPermissionNames: ['view-lab'],
      permissionNames: ['view-lab', 'receive-queue'],
    }

    const first = await RbacCache.getOrSet(userId, async () => {
      factoryCalls++
      return snapshot
    })

    const second = await RbacCache.getOrSet(userId, async () => {
      factoryCalls++
      return {
        roleNames: ['admin'],
        directPermissionNames: [],
        permissionNames: ['*'],
      }
    })

    assert.deepEqual(first, second)
    assert.equal(factoryCalls, 1)
    assert.isTrue(await cache.has({ key: rbacUserKey(userId) }))
  })

  test('forgetRole clears users tagged with that role', async ({ assert }) => {
    const nurseId = 42_002
    const adminId = 42_003

    await RbacCache.getOrSet(nurseId, async () => ({
      roleNames: ['nurse'],
      directPermissionNames: [],
      permissionNames: ['triage.receive'],
    }))

    await RbacCache.getOrSet(adminId, async () => ({
      roleNames: ['admin'],
      directPermissionNames: [],
      permissionNames: ['*'],
    }))

    await RbacCache.forgetRole('nurse')

    assert.isFalse(await cache.has({ key: rbacUserKey(nurseId) }))
    assert.isTrue(await cache.has({ key: rbacUserKey(adminId) }))

    await cache.deleteByTag({ tags: [rbacRoleTag('admin')] })
  })

  test('forgetUser clears only that user snapshot', async ({ assert }) => {
    const userA = 42_004
    const userB = 42_005

    await RbacCache.getOrSet(userA, async () => ({
      roleNames: ['pharmacist'],
      directPermissionNames: [],
      permissionNames: ['pharmacy.dispense'],
    }))

    await RbacCache.getOrSet(userB, async () => ({
      roleNames: ['pharmacist'],
      directPermissionNames: [],
      permissionNames: ['pharmacy.dispense'],
    }))

    await RbacCache.forgetUser(userA)

    assert.isFalse(await cache.has({ key: rbacUserKey(userA) }))
    assert.isTrue(await cache.has({ key: rbacUserKey(userB) }))

    await cache.deleteByTag({ tags: [rbacRoleTag('pharmacist')] })
  })
})
