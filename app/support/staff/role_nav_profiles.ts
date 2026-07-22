/**
 * Role-based staff landing + sidebar profiles.
 *
 * Keep in sync with inertia/support/role_nav_profiles.ts
 */

export type RoleNavProfile = {
  role: string
  landingPath: string
  /** Stage queue hrefs that keep management children in the sidebar. */
  primaryQueueHrefs: string[]
  /** When true, show every stage queue (non-primary as queue-only links). */
  previewOtherQueues: boolean
  hideDashboard: boolean
}

/** Fixed priority for multi-role users (first match wins for landing). */
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

export const ALL_STAGE_VIEW_QUEUE_PERMISSIONS = [
  'registration.view-queue',
  'triage.view-queue',
  'screening.view-queue',
  'lab.view-queue',
  'screening-review.view-queue',
  'pharmacy.view-queue',
  'treatment-room.view-queue',
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

export function landingPathForRoles(roleNames: string[]): string {
  return resolveRoleNav(roleNames).landingPath
}

/**
 * Intended role → permission map for Ace sync / Laravel seeder parity.
 * Clinical roles include all stage view-queue perms for sidebar previews.
 */
export function rolePermissionSyncMap(): Record<string, string[] | ['*']> {
  const screeningAndReviewPermissions = [
    'screening.view-queue',
    'screening.receive',
    'screening.save-draft',
    'screening.manage-assessment',
    'screening.create-lab-request',
    'screening.queue-to-lab',
    'screening.queue-to-pharmacy',
    'screening.queue-to-treatment-room',
    'screening.manage-ward-assignment',
    'screening-review.view-queue',
    'screening-review.receive',
    'screening-review.review-results',
    'screening-review.complete',
    'encounter.view-own',
    'patients.read',
    'medications.read',
    'lab.manage-test-types',
    'test-types.read',
    'notifications.read',
    ...ALL_STAGE_VIEW_QUEUE_PERMISSIONS,
  ]

  const withPreview = (perms: string[]) => [
    ...new Set([...perms, ...ALL_STAGE_VIEW_QUEUE_PERMISSIONS]),
  ]

  return {
    'super-admin': ['*'],
    'registration-clerk': withPreview([
      'registration.view-queue',
      'registration.search-patient',
      'registration.create-encounter',
      'registration.queue-to-triage',
      'registration.manage-households',
      'patients.read',
      'patients.write',
      'patients.manage-portal',
      'households.read',
      'households.write',
      'subscriptions.read',
      'subscriptions.write',
      'memberships.read',
      'notifications.read',
    ]),
    'triage-nurse': withPreview([
      'triage.view-queue',
      'triage.receive',
      'triage.record-vitals',
      'triage.manage-startup-medications',
      'triage.manage-ward-assignment',
      'triage.complete',
      'encounter.view-own',
      'patients.read',
      'medications.read',
      'units.read',
      'wards.read',
      'beds.read',
      'notifications.read',
    ]),
    'screening-clinician': withPreview(screeningAndReviewPermissions),
    'screening-review-clinician': withPreview(screeningAndReviewPermissions),
    'lab-technician': withPreview([
      'lab.view-queue',
      'lab.receive',
      'lab.collect-samples',
      'lab.record-results',
      'lab.update-results',
      'lab.complete',
      'lab.manage-specimen-types',
      'lab.manage-test-types',
      'encounter.view-own',
      'patients.read',
      'test-types.read',
      'test-types.write',
      'notifications.read',
    ]),
    pharmacist: withPreview([
      'pharmacy.view-queue',
      'pharmacy.receive',
      'pharmacy.manage-prescription',
      'pharmacy.dispense',
      'pharmacy.close-encounter',
      'pharmacy.queue-to-treatment-room',
      'treatment-room.view-queue',
      'encounter.view-own',
      'patients.read',
      'medications.read',
      'units.read',
      'notifications.read',
    ]),
    'treatment-room-nurse': withPreview([
      'treatment-room.view-queue',
      'treatment-room.receive',
      'treatment-room.close-encounter',
      'encounter.view-own',
      'patients.read',
      'medications.read',
      'notifications.read',
    ]),
    'ward-nurse': withPreview([
      'wards.read',
      'wards.write',
      'beds.read',
      'beds.write',
      'encounter.view-own',
      'patients.read',
      'notifications.read',
    ]),
    'records-officer': [
      'encounter.view-all',
      'encounter.view-audit-trail',
      ...ALL_STAGE_VIEW_QUEUE_PERMISSIONS,
      'patients.read',
      'households.read',
      'wards.read',
      'beds.read',
      'medications.read',
      'units.read',
      'test-types.read',
      'complaints.read',
      'reports.read',
      'reports.write',
      'encounters.reopen',
      'health_tips.read',
      'health_tips.write',
      'health_tips.manage',
      'featured_doctors.read',
      'featured_doctors.write',
      'featured_doctors.manage',
      'memberships.read',
      'memberships.write',
      'memberships.manage',
      'subscriptions.read',
      'subscriptions.write',
      'subscriptions.manage',
      'notifications.read',
    ],
    'system-auditor': [
      'encounter.view-all',
      'encounter.view-audit-trail',
      ...ALL_STAGE_VIEW_QUEUE_PERMISSIONS,
      'patients.read',
      'households.read',
      'wards.read',
      'beds.read',
      'medications.read',
      'units.read',
      'test-types.read',
      'complaints.read',
      'reports.read',
      'notifications.read',
      'calendar.read',
    ],
    'shift-staff': ['reports.read', 'notifications.read'],
  }
}
