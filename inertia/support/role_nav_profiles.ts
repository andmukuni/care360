/**
 * Role-based staff landing + sidebar profiles (frontend).
 *
 * Keep in sync with app/support/staff/role_nav_profiles.ts
 */

export type RoleNavProfile = {
  role: string
  landingPath: string
  primaryQueueHrefs: string[]
  previewOtherQueues: boolean
  hideDashboard: boolean
}

export const ROLE_NAV_PRIORITY = [
  'registration-clerk',
  'triage-nurse',
  'screening-clinician',
  'screening-review-clinician',
  'lab-technician',
  'pharmacist',
  'treatment-room-nurse',
  'ward-nurse',
] as const

export const STAGE_QUEUE_HREFS = [
  '/registration',
  '/triage/queue',
  '/screening/queue',
  '/lab/queue',
  '/screening-review/queue',
  '/pharmacy/queue',
  '/treatment-room/queue',
] as const

export const ROLE_NAV_PROFILES: Record<string, RoleNavProfile> = {
  'registration-clerk': {
    role: 'registration-clerk',
    landingPath: '/registration',
    primaryQueueHrefs: ['/registration'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'triage-nurse': {
    role: 'triage-nurse',
    landingPath: '/triage/queue',
    primaryQueueHrefs: ['/triage/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'screening-clinician': {
    role: 'screening-clinician',
    landingPath: '/screening/queue',
    primaryQueueHrefs: ['/screening/queue', '/screening-review/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'screening-review-clinician': {
    role: 'screening-review-clinician',
    landingPath: '/screening-review/queue',
    primaryQueueHrefs: ['/screening/queue', '/screening-review/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'lab-technician': {
    role: 'lab-technician',
    landingPath: '/lab/queue',
    primaryQueueHrefs: ['/lab/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  pharmacist: {
    role: 'pharmacist',
    landingPath: '/pharmacy/queue',
    primaryQueueHrefs: ['/pharmacy/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'treatment-room-nurse': {
    role: 'treatment-room-nurse',
    landingPath: '/treatment-room/queue',
    primaryQueueHrefs: ['/treatment-room/queue'],
    previewOtherQueues: true,
    hideDashboard: true,
  },
  'ward-nurse': {
    role: 'ward-nurse',
    landingPath: '/beds',
    primaryQueueHrefs: [],
    previewOtherQueues: true,
    hideDashboard: true,
  },
}

export type ResolvedRoleNav = {
  landingPath: string
  primaryQueueHrefs: Set<string>
  previewOtherQueues: boolean
  hideDashboard: boolean
  isRegistrationClerk: boolean
  isWardNurse: boolean
  matchedRoles: string[]
}

export function resolveRoleNav(roleNames: string[]): ResolvedRoleNav {
  const matched: RoleNavProfile[] = []
  for (const role of ROLE_NAV_PRIORITY) {
    if (roleNames.includes(role) && ROLE_NAV_PROFILES[role]) {
      matched.push(ROLE_NAV_PROFILES[role])
    }
  }

  const primaryQueueHrefs = new Set<string>()
  let previewOtherQueues = false
  let hideDashboard = false

  for (const profile of matched) {
    for (const href of profile.primaryQueueHrefs) primaryQueueHrefs.add(href)
    if (profile.previewOtherQueues) previewOtherQueues = true
    if (profile.hideDashboard) hideDashboard = true
  }

  return {
    landingPath: matched[0]?.landingPath ?? '/dashboard',
    primaryQueueHrefs,
    previewOtherQueues,
    hideDashboard,
    isRegistrationClerk: roleNames.includes('registration-clerk'),
    isWardNurse: roleNames.includes('ward-nurse'),
    matchedRoles: matched.map((m) => m.role),
  }
}
