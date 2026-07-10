import type User from '#models/user'

export type QueueUserBadge = {
  name: string
  role: string | null
}

export function queueUserBadge(user: User | null | undefined): QueueUserBadge | null {
  const name = user?.name?.trim()
  if (!name) {
    return null
  }

  const role = user?.title?.trim() || user?.specialty?.trim() || null

  return { name, role }
}
