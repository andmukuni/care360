import User from '#models/user'

export async function canManageUserSignature(
  user: User | undefined | null,
  targetUserId: number
): Promise<boolean> {
  if (!user) return false
  if (user.id === targetUserId) return true
  if (await user.isLegacyUserWithoutRbac()) return true
  if (await user.hasAnyPermission(['users.write', 'settings.manage'])) return true
  return user.hasRole('super-admin')
}

export async function clearStaffSignature(user: User): Promise<void> {
  if (user.signaturePath) {
    user.signaturePath = null
    await user.save()
  }

  const { CachedSessionUserProvider } = await import('#services/auth/cached_session_user_provider')
  CachedSessionUserProvider.forgetUser(user.id)
}
