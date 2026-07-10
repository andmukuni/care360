import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

export interface NavItem {
  href: string
  label: string
  icon?: string
  permissions?: string[]
  badgeCount?: number
  match?: string | string[]
  labCycle?: boolean
  group?: string
  children?: NavItem[]
}

export interface CycleNavItem extends NavItem {
  stage?: string | null
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

const STAGE_ACTIVE_TEXT: Record<string, string> = {
  dashboard: 'text-orange-700',
  all: 'text-orange-700',
  registration: 'text-sky-700',
  triage: 'text-amber-700',
  screening: 'text-violet-700',
  lab: 'text-cyan-700',
  screening_review: 'text-rose-700',
  pharmacy: 'text-emerald-700',
  treatment_room: 'text-sky-700',
}

const STAGE_BADGE_COLORS: Record<string, string> = {
  registration: 'bg-sky-500 text-white',
  triage: 'bg-amber-500 text-white',
  screening: 'bg-violet-500 text-white',
  lab: 'bg-cyan-500 text-white',
  screening_review: 'bg-rose-500 text-white',
  pharmacy: 'bg-emerald-500 text-white',
  treatment_room: 'bg-sky-500 text-white',
}

const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  match: '/dashboard',
}

const SETTINGS_ICON =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'

export function useStaffNav() {
  const page = usePage()
  const roles = computed(() => (page.props.roles as string[]) ?? [])
  const permissions = computed(() => (page.props.permissions as string[]) ?? [])
  const navBadges = computed(
    () =>
      (page.props.navBadges as {
        stageCounts?: Record<string, number>
        pendingAppointmentCount?: number
        pendingKycCount?: number
      }) ?? {}
  )
  const stageCounts = computed(() => navBadges.value.stageCounts ?? {})
  const pendingAppointmentCount = computed(() => Number(navBadges.value.pendingAppointmentCount ?? 0))
  const pendingKycCount = computed(() => Number(navBadges.value.pendingKycCount ?? 0))

  const currentPath = computed(() => page.url.split('?')[0])

  const isRegistrationClerk = computed(() => roles.value.includes('registration-clerk'))
  const isWardNurse = computed(() => roles.value.includes('ward-nurse'))
  const isLegacyUserWithoutRbac = computed(
    () => roles.value.length === 0 && permissions.value.length === 0
  )

  function canSee(perms: string[]): boolean {
    if (perms.length === 0) return true
    if (isLegacyUserWithoutRbac.value) return true
    return perms.some((p) => permissions.value.includes(p))
  }

  function isActive(match: string | string[] | undefined, href?: string): boolean {
    const path = currentPath.value
    if (!match) {
      return href ? path === href || path.startsWith(`${href}/`) : false
    }
    const patterns = Array.isArray(match) ? match : [match]
    return patterns.some((m) => path === m || path.startsWith(`${m}/`))
  }

  function stageBadge(stage: string | null | undefined): number {
    if (!stage) return 0
    return stageCounts.value[stage] ?? 0
  }

  function itemIsActive(item: NavItem): boolean {
    if (item.href === '#') return false
    const path = currentPath.value
    if (item.href === '/patients' && path === '/patients/create') return false
    return isActive(item.match, item.href)
  }

  function itemHasActiveChild(item: NavItem): boolean {
    return (item.children ?? []).some((child) => itemIsActive(child))
  }

  function itemIsHighlighted(item: NavItem): boolean {
    return itemIsActive(item) || itemHasActiveChild(item)
  }

  function sectionIsActive(section: NavSection): boolean {
    return section.items.some((item) => itemIsHighlighted(item))
  }

  const canSeeDashboard = computed(() => !isRegistrationClerk.value)

  const registrationClerkChildren = computed((): NavItem[] => {
    const children: NavItem[] = []
    if (canSee(['patients.read', 'patients.write'])) {
      children.push({
        href: '/patients',
        label: 'Patients',
        match: ['/patients'],
      })
    }
    if (canSee(['patients.read'])) {
      children.push({
        href: '/appointments',
        label: 'Appointments',
        match: '/appointments',
        badgeCount: pendingAppointmentCount.value,
      })
    }
    if (canSee(['households.read', 'households.write', 'registration.manage-households'])) {
      children.push({
        href: '/households',
        label: 'Households',
        match: '/households',
      })
    }
    return children
  })

  const cycleStages = computed((): CycleNavItem[] => {
    const stages: CycleNavItem[] = [
      {
        href: '/encounters',
        label: 'All Encounters',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        stage: null,
        permissions: ['encounter.view-own', 'encounter.view-all'],
        match: '/encounters',
      },
      {
        href: '/registration',
        label: '1 · Registration',
        icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
        stage: 'registration',
        permissions: [
          'registration.view-queue',
          'registration.search-patient',
          'registration.create-encounter',
          'registration.manage-households',
        ],
        match: '/registration',
      },
      {
        href: '/triage/queue',
        label: '2 · Triage Queue',
        icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
        stage: 'triage',
        permissions: ['triage.view-queue'],
        match: ['/triage/queue', '/triage/show'],
        children: [
          {
            href: '/triage/vitals',
            label: 'Vitals',
            icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
            match: '/triage/vitals',
          },
          {
            href: '/triage/startup-medications',
            label: 'Startup Medications',
            icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
            match: '/triage/startup-medications',
          },
        ],
      },
      {
        href: '/screening/queue',
        label: '3 · Screening Queue',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        stage: 'screening',
        permissions: ['screening.view-queue', 'screening-review.view-queue'],
        match: ['/screening/queue', '/screening/show'],
        children: [
          {
            href: '/screening/entries',
            label: 'Entries',
            icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
            match: '/screening/entries',
          },
        ],
      },
      {
        href: '/lab/queue',
        label: '4 · Lab Queue',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        stage: 'lab',
        permissions: ['lab.view-queue'],
        match: ['/lab/queue', '/lab/show'],
        children: [
          {
            href: '/lab/entries',
            label: 'Entries',
            icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
            match: '/lab/entries',
            labCycle: true,
          },
          {
            href: '/lab/test-results',
            label: 'Test Results',
            icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
            match: '/lab/test-results',
            labCycle: true,
          },
          {
            href: '/lab/specimen-types',
            label: 'Test Samples',
            icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
            match: '/lab/specimen-types',
            labCycle: true,
          },
        ],
      },
      {
        href: '/screening-review/queue',
        label: '5 · Screening Review',
        icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
        stage: 'screening_review',
        permissions: ['screening-review.view-queue', 'screening.view-queue'],
        match: ['/screening-review/queue', '/screening-review/show'],
        children: [
          {
            href: '/screening-review/entries',
            label: 'Entries',
            icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
            match: '/screening-review/entries',
          },
        ],
      },
      {
        href: '/pharmacy/queue',
        label: '6 · Pharmacy Queue',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.78 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        stage: 'pharmacy',
        permissions: ['pharmacy.view-queue'],
        match: ['/pharmacy/queue', '/pharmacy/show'],
        children: [
          {
            href: '/pharmacy/prescriptions',
            label: 'Prescriptions',
            icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
            match: '/pharmacy/prescriptions',
          },
        ],
      },
      {
        href: '/treatment-room/queue',
        label: '7 · Treatment Room',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        stage: 'treatment_room',
        permissions: ['treatment-room.view-queue'],
        match: ['/treatment-room/queue', '/treatment-room/show'],
      },
    ]

    let filtered = stages.filter((s) => canSee(s.permissions ?? []))
    if (isWardNurse.value) {
      filtered = filtered.filter((s) => s.href !== '/encounters')
    }
    if (isRegistrationClerk.value) {
      filtered.sort((a, b) => (a.href === '/registration' ? -1 : b.href === '/registration' ? 1 : 0))
      filtered = filtered.map((s) => {
        if (s.href === '/registration') {
          const children = registrationClerkChildren.value
          return {
            ...s,
            label: 'Registration',
            children: children.length ? children : undefined,
          }
        }
        return s
      })
    }
    return filtered
  })

  const recordsNavItems = computed((): NavItem[] => {
    const items: NavItem[] = [
      {
        href: '/patients',
        label: 'Patients',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
        permissions: ['patients.read', 'patients.write'],
        match: '/patients',
      },
      {
        href: '/appointments',
        label: 'Appointments',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        permissions: ['patients.read'],
        badgeCount: pendingAppointmentCount.value,
        match: '/appointments',
      },
      {
        href: '/portal-registrations',
        label: 'Pending KYC',
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h9m5-3l2 2 4-4',
        permissions: ['patients.read', 'patients.write', 'patients.manage-portal'],
        badgeCount: pendingKycCount.value,
        match: '/portal-registrations',
      },
      {
        href: '/payment-transactions',
        label: 'Transactions',
        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
        permissions: ['patients.read', 'patients.write'],
        match: '/payment-transactions',
      },
      {
        href: '/households',
        label: 'Households',
        icon: 'M3 7h18M3 12h18M3 17h18M7 7v10m5-10v10m5-10v10',
        permissions: ['households.read', 'households.write', 'registration.manage-households'],
        match: '/households',
      },
    ]
    return items.filter((item) => canSee(item.permissions ?? []))
  })

  const catalogNavItems = computed((): NavItem[] => {
    const wardChildren: NavItem[] = []
    if (!isWardNurse.value) {
      wardChildren.push({
        href: '/beds',
        label: 'Beds',
        match: '/beds',
        permissions: ['beds.read', 'beds.write'],
      })
    }
    wardChildren.push({
      href: '/accessories',
      label: 'Accessories',
      match: '/accessories',
      permissions: ['wards.read', 'wards.write'],
    })

    const items: NavItem[] = [
      {
        href: '/dictionary',
        label: 'Medical Library',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        permissions: ['medications.read', 'medications.write', 'test-types.read', 'settings.manage', 'patients.read'],
        match: '/dictionary',
      },
      {
        href: '/medications',
        label: 'Medications',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        permissions: ['medications.read', 'medications.write'],
        match: '/medications',
      },
      {
        href: '/units',
        label: 'Units',
        icon: 'M4 7h16M4 12h16M4 17h16',
        permissions: ['units.read', 'units.write'],
        match: '/units',
      },
      {
        href: '/test-types',
        label: 'Test Types',
        icon: 'M9 12h6m-6 4h6M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z',
        permissions: ['test-types.read', 'test-types.write', 'lab.manage-test-types'],
        match: '/test-types',
        children: [
          { href: '/test-types/categories', label: 'Categories', match: '/test-types/categories' },
          { href: '/test-types/forms', label: 'Result Forms', match: '/test-types/forms' },
          {
            href: '/lab/entries',
            label: 'Lab Entries',
            match: '/lab/entries',
            group: 'Lab configuration',
          },
          {
            href: '/lab/test-results',
            label: 'Lab Test Results',
            match: '/lab/test-results',
            group: 'Lab configuration',
          },
        ],
      },
      {
        href: '/wards',
        label: 'Wards',
        icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
        permissions: ['wards.read', 'wards.write'],
        match: '/wards',
        children: wardChildren.filter((child) => canSee(child.permissions ?? [])),
      },
    ]

    let filtered = items.filter((item) => canSee(item.permissions ?? []))

    if (isWardNurse.value) {
      filtered.unshift({
        href: '/beds',
        label: 'Beds',
        icon: 'M5 12h14M5 12a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 01-2 2M5 12v5a2 2 0 002 2h10a2 2 0 002-2v-5',
        permissions: ['beds.read', 'beds.write'],
        match: '/beds',
      })
    }

    return filtered.map((item) => ({
      ...item,
      children: item.children?.length ? item.children : undefined,
    }))
  })

  const administrationNavItems = computed((): NavItem[] => {
    const items: NavItem[] = [
      {
        href: '/users',
        label: 'Staff Management',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        permissions: ['users.read', 'users.write', 'users.delete'],
        match: '/users',
      },
      {
        href: '/emergency-services',
        label: 'Emergency Services',
        icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
        permissions: ['patients.manage-portal', 'patients.write'],
        match: '/emergency-services',
      },
      {
        href: '/health-tips',
        label: 'Health Tips',
        icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
        permissions: ['health_tips.read', 'health_tips.write', 'health_tips.manage'],
        match: '/health-tips',
      },
      {
        href: '/featured-doctors',
        label: 'Featured Doctors',
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
        permissions: ['featured_doctors.read', 'featured_doctors.write', 'featured_doctors.manage'],
        match: '/featured-doctors',
      },
      {
        href: '/memberships',
        label: 'Membership Plans',
        icon: 'M5 13l4 4L19 7',
        permissions: ['memberships.read', 'memberships.write', 'memberships.manage'],
        match: '/memberships',
      },
      {
        href: '/rate-card',
        label: 'Rate Card',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permissions: ['rate-card.manage', 'settings.manage'],
        match: '/rate-card',
      },
      {
        href: '/subscriptions',
        label: 'Subscriptions',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permissions: ['subscriptions.read', 'subscriptions.write', 'subscriptions.manage'],
        match: '/subscriptions',
      },
      {
        href: '/reports',
        label: 'Reports',
        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        permissions: ['reports.read'],
        match: '/reports',
      },
      {
        href: '/complaints',
        label: 'Complaints',
        icon: 'M12 9v2m0 4h.01M10.29 3.86l-8.08 14A1 1 0 003.08 20h17.84a1 1 0 00.87-1.5l-8.08-14a1 1 0 00-1.74 0z',
        permissions: ['complaints.read', 'complaints.write'],
        match: '/complaints',
      },
      {
        href: '#',
        label: 'Nurses',
        icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
        permissions: ['users.read', 'users.write'],
      },
    ]
    return items.filter((item) => canSee(item.permissions ?? []))
  })

  const toolsNavItems = computed((): NavItem[] => {
    const items: NavItem[] = [
      {
        href: '/notifications',
        label: 'Notifications',
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
        permissions: ['notifications.read', 'notifications.manage'],
        match: '/notifications',
      },
      {
        href: '/calendar',
        label: 'Calendar & Events',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        permissions: ['calendar.read', 'calendar.write'],
        match: '/calendar',
      },
    ]
    return items.filter((item) => canSee(item.permissions ?? []))
  })

  const settingsNavItem = computed((): NavItem | null => {
    if (!canSee(['settings.manage']) && !canSee(['users.read', 'users.write', 'users.delete'])) {
      return null
    }

    const children: NavItem[] = []
    if (canSee(['users.read', 'users.write', 'users.delete'])) {
      children.push({ href: '/users', label: 'Users', match: '/users' })
    }
    if (canSee(['settings.manage'])) {
      children.push({ href: '/access-control', label: 'Roles & Permissions', match: '/access-control' })
      children.push({
        href: '/access-control/user-roles',
        label: 'User Roles',
        match: '/access-control/user-roles',
      })
    }

    if (!canSee(['settings.manage'])) {
      return children.length
        ? { href: '/users', label: 'Settings', icon: SETTINGS_ICON, match: '/users', children }
        : null
    }

    return {
      href: '/settings',
      label: 'Settings',
      icon: SETTINGS_ICON,
      match: ['/settings', '/access-control', '/users'],
      children: children.length ? children : undefined,
    }
  })

  const navSections = computed((): NavSection[] => {
    const sections: NavSection[] = []

    if (canSeeDashboard.value && !isWardNurse.value) {
      sections.push({
        id: 'overview',
        label: 'Overview',
        items: [DASHBOARD_ITEM],
      })
    }

    if (cycleStages.value.length || isRegistrationClerk.value) {
      sections.push({
        id: 'encounter-cycle',
        label: isRegistrationClerk.value ? 'Registration' : 'Encounter Cycle',
        items: cycleStages.value,
      })
    }

    const records = recordsNavItems.value.filter(
      (item) => !(isRegistrationClerk.value && ['/patients', '/households'].includes(item.href))
    )
    if (records.length) {
      sections.push({ id: 'records', label: 'Records', items: records })
    }

    if (catalogNavItems.value.length) {
      sections.push({ id: 'catalog', label: 'Catalog', items: catalogNavItems.value })
    }

    if (administrationNavItems.value.length) {
      sections.push({ id: 'administration', label: 'Administration', items: administrationNavItems.value })
    }

    if (toolsNavItems.value.length) {
      sections.push({ id: 'tools', label: 'Tools', items: toolsNavItems.value })
    }

    return sections
  })

  const defaultActiveText = 'text-orange-700'

  function activeTextForStage(stage: string | null | undefined): string {
    return STAGE_ACTIVE_TEXT[stage ?? 'all'] ?? defaultActiveText
  }

  function activeTextForItem(item: NavItem, stage?: string | null): string {
    if (stage !== undefined) {
      return activeTextForStage(stage)
    }
    return defaultActiveText
  }

  return {
    canSee,
    isActive,
    stageBadge,
    stageActiveText: STAGE_ACTIVE_TEXT,
    stageBadgeColors: STAGE_BADGE_COLORS,
    defaultActiveText,
    canSeeDashboard,
    isRegistrationClerk,
    isWardNurse,
    cycleStages,
    navSections,
    settingsNavItem,
    currentPath,
    itemIsActive,
    itemHasActiveChild,
    itemIsHighlighted,
    sectionIsActive,
    activeTextForStage,
    activeTextForItem,
    canManageSettings: computed(() => canSee(['settings.manage'])),
    canManageUsers: computed(() => canSee(['users.read', 'users.write', 'users.delete'])),
  }
}

export const SIDEBAR_EXPANDED_SECTIONS_KEY = 'sidebar-expanded-sections'
export const SIDEBAR_DEFAULT_EXPANDED_SECTIONS = ['encounter-cycle'] as const

export function loadExpandedSections(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SIDEBAR_EXPANDED_SECTIONS_KEY)
    if (!raw) return new Set(SIDEBAR_DEFAULT_EXPANDED_SECTIONS)
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set(SIDEBAR_DEFAULT_EXPANDED_SECTIONS)
  }
}

export function saveExpandedSections(ids: Set<string>) {
  try {
    sessionStorage.setItem(SIDEBAR_EXPANDED_SECTIONS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}
