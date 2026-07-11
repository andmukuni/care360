<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, usePage } from '@inertiajs/vue3'
import SignatureSigningPanel from '~/components/staff/users/SignatureSigningPanel.vue'

interface ProfileUser {
  id: number
  name: string
  raw_name: string
  title: string | null
  specialty: string | null
  bio: string | null
  email: string
  is_portal_bookable: boolean
  profile_photo_url: string | null
  roles: string[]
  created_at: string | null
  updated_at: string | null
  email_verified_at: string | null
  is_self: boolean
  signature_url?: string | null
  signature_signed_at?: string | null
  pending_signature_invite?: { url: string; expires_at: string } | null
  can_manage_signature?: boolean
  signature_invite_endpoint?: string | null
}

interface Stats {
  encountersStarted: number
  encountersClosed: number
  prescriptions: number
  dispenses: number
  labRecorded: number
  labVerified: number
  calendarEvents: number
}

interface TimelineItem {
  type: string
  label: string
  sub: string
  ref: string
  date: string | null
  icon: string
  color: string
  href: string | null
  patient_href: string | null
}

interface TimelinePage {
  items: TimelineItem[]
  total: number
  per_page: number
  current_page: number
  last_page: number
  from: number
  to: number
}

interface RecentEncounter {
  id: number
  encounter_number: string
  patient_name: string
  patient_href: string | null
  stage: string
  status: string
  status_key: string
  started_at: string | null
  href: string | null
}

interface RecentPrescription {
  id: number
  encounter_id: number
  prescription_number: string
  patient_name: string
  patient_href: string | null
  status: string
  prescribed_at: string | null
  href: string | null
}

interface RecentLabResult {
  id: number
  encounter_id: number
  patient_name: string
  patient_href: string | null
  interpretation: string | null
  result_status: string
  recorded_at: string | null
  href: string | null
}

interface RecentDispense {
  id: number
  encounter_id: number
  patient_name: string
  patient_href: string | null
  status: string
  date: string | null
  href: string | null
}

const props = defineProps<{
  user: ProfileUser
  stats: Stats
  timeline: TimelinePage
  recentEncounters?: RecentEncounter[]
  recentPrescriptions?: RecentPrescription[]
  recentLabResults?: RecentLabResult[]
  recentDispenses?: RecentDispense[]
  editHref: string
  backHref?: string | null
  canDelete?: boolean
}>()

const page = usePage()
const imageFailed = ref(false)
const activeTab = ref('timeline')

const timelineItems = computed(() => props.timeline.items)
const timelineMeta = computed(() => props.timeline)

const tabs = computed(() => [
  { id: 'timeline', label: 'Timeline', count: timelineMeta.value.total },
  { id: 'encounters', label: 'Encounters', count: props.stats.encountersStarted },
  { id: 'prescriptions', label: 'Prescriptions', count: props.stats.prescriptions },
  { id: 'lab', label: 'Lab', count: props.stats.labRecorded + props.stats.labVerified },
  { id: 'dispenses', label: 'Dispenses', count: props.stats.dispenses },
])

const recentEncounters = computed(() => props.recentEncounters ?? [])
const recentPrescriptions = computed(() => props.recentPrescriptions ?? [])
const recentLabResults = computed(() => props.recentLabResults ?? [])
const recentDispenses = computed(() => props.recentDispenses ?? [])

const statCards = [
  { key: 'encountersStarted', label: 'Encounters Started' },
  { key: 'encountersClosed', label: 'Encounters Closed' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'dispenses', label: 'Dispenses' },
  { key: 'labRecorded', label: 'Lab Recorded' },
  { key: 'labVerified', label: 'Lab Verified' },
  { key: 'calendarEvents', label: 'Calendar Events' },
] as const

const summaryItems = [
  { key: 'encountersStarted', label: 'Encounters started', color: 'bg-blue-500' },
  { key: 'encountersClosed', label: 'Encounters closed', color: 'bg-green-500' },
  { key: 'prescriptions', label: 'Prescriptions written', color: 'bg-purple-500' },
  { key: 'dispenses', label: 'Dispenses performed', color: 'bg-orange-500' },
  { key: 'labRecorded', label: 'Lab results recorded', color: 'bg-teal-500' },
  { key: 'labVerified', label: 'Lab results verified', color: 'bg-indigo-500' },
  { key: 'calendarEvents', label: 'Calendar events created', color: 'bg-rose-500' },
] as const

const dotClass: Record<string, string> = {
  blue: 'staff-profile__tl-dot--blue',
  green: 'staff-profile__tl-dot--green',
  purple: 'staff-profile__tl-dot--purple',
  orange: 'staff-profile__tl-dot--orange',
  teal: 'staff-profile__tl-dot--teal',
  indigo: 'staff-profile__tl-dot--indigo',
  rose: 'staff-profile__tl-dot--rose',
}

const initials = computed(() => props.user.raw_name.trim().charAt(0).toUpperCase() || 'U')

const totalActions = computed(() =>
  Object.values(props.stats).reduce((sum, value) => sum + Number(value ?? 0), 0)
)

const resolvedPhotoUrl = computed(() => {
  if (imageFailed.value || !props.user.profile_photo_url) return null
  return props.user.profile_photo_url
})

function relativeDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs = Date.now() - d.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, 'month')
  return rtf.format(-Math.round(diffMonth / 12), 'year')
}

function updatedRelative(): string {
  return relativeDate(props.user.updated_at)
}

function humanize(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function encounterStatusClass(key: string): string {
  if (key === 'completed') return 'staff-profile__pill--green'
  if (key === 'cancelled') return 'staff-profile__pill--muted'
  if (['started', 'queued', 'in_progress'].includes(key)) return 'staff-profile__pill--amber'
  return 'staff-profile__pill--muted'
}

function prescriptionStatusClass(status: string): string {
  const key = status.toLowerCase()
  if (key === 'dispensed') return 'staff-profile__pill--green'
  if (key === 'pending') return 'staff-profile__pill--amber'
  return 'staff-profile__pill--muted'
}

function interpretationClass(value: string | null): string {
  const key = String(value ?? '').toLowerCase()
  if (key === 'normal') return 'staff-profile__pill--green'
  if (key === 'critical') return 'staff-profile__pill--red'
  if (key) return 'staff-profile__pill--amber'
  return 'staff-profile__pill--muted'
}

function labStatusClass(status: string): string {
  return status.toLowerCase() === 'verified'
    ? 'staff-profile__pill--green'
    : 'staff-profile__pill--muted'
}

function goTimelinePage(nextPage: number) {
  const baseUrl = page.url.split('?')[0]
  router.get(
    baseUrl,
    { timeline_page: nextPage },
    { preserveState: true, preserveScroll: true, only: ['timeline'] }
  )
}
</script>

<template>
  <div class="staff-profile">
    <div class="staff-profile__hero theme-panel">
      <div class="staff-profile__banner" aria-hidden="true">
        <svg class="staff-profile__banner-grid" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="staff-profile-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" stroke-width="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#staff-profile-grid)" />
        </svg>
      </div>

      <div class="staff-profile__body">
        <div class="staff-profile__avatar-wrap">
          <img
            v-if="resolvedPhotoUrl"
            :src="resolvedPhotoUrl"
            :alt="props.user.name"
            class="staff-profile__avatar staff-profile__avatar--photo"
            @error="imageFailed = true"
          />
          <div v-else class="staff-profile__avatar">{{ initials }}</div>
        </div>

        <div class="staff-profile__identity">
          <div class="staff-profile__name">
            {{ props.user.name }}
            <span v-if="props.user.is_self" class="staff-profile__you-badge">You</span>
          </div>

          <div class="staff-profile__meta">
            <span v-if="props.user.specialty">{{ props.user.specialty }}</span>
            <span v-if="props.user.specialty && props.user.is_portal_bookable" class="staff-profile__meta-dot">·</span>
            <span v-if="props.user.is_portal_bookable" class="staff-profile__portal-badge">Portal doctor</span>
            <span v-if="props.user.specialty || props.user.is_portal_bookable" class="staff-profile__meta-dot">·</span>
            <span>{{ props.user.email }}</span>
            <span v-if="props.user.created_at" class="staff-profile__meta-dot">·</span>
            <span v-if="props.user.created_at">Member since {{ props.user.created_at }}</span>
            <template v-if="props.user.email_verified_at">
              <span class="staff-profile__meta-dot">·</span>
              <span class="staff-profile__verified">Verified</span>
            </template>
            <span class="staff-profile__meta-dot">·</span>
            <span>International Hospital Zambia</span>
          </div>

          <div v-if="props.user.roles.length" class="staff-profile__roles">
            <span v-for="role in props.user.roles" :key="role" class="staff-profile__role-pill">{{ role }}</span>
          </div>

          <div class="staff-profile__actions">
            <Link :href="editHref" class="staff-profile__btn staff-profile__btn--primary">Edit Profile</Link>
            <Link v-if="backHref" :href="backHref" class="staff-profile__btn staff-profile__btn--secondary">All Users</Link>
            <button
              v-if="canDelete"
              type="button"
              class="staff-profile__btn staff-profile__btn--danger"
              @click="$emit('delete')"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      <div class="staff-profile__stats">
        <div v-for="card in statCards" :key="card.key" class="staff-profile__stat">
          <div class="staff-profile__stat-val">{{ props.stats[card.key] }}</div>
          <div class="staff-profile__stat-lbl">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <div class="staff-profile__grid">
      <div class="staff-profile__sidebar">
        <section class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">About</span>
          </header>
          <div class="staff-profile__about">
            <div class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Email</p>
                <p class="staff-profile__field-value">{{ props.user.email }}</p>
              </div>
            </div>
            <div v-if="props.user.title" class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Title</p>
                <p class="staff-profile__field-value">{{ props.user.title }}</p>
              </div>
            </div>
            <div v-if="props.user.specialty" class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Specialty</p>
                <p class="staff-profile__field-value">{{ props.user.specialty }}</p>
              </div>
            </div>
            <div v-if="props.user.created_at" class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Member Since</p>
                <p class="staff-profile__field-value">{{ props.user.created_at }}</p>
              </div>
            </div>
            <div class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Email Verified</p>
                <p
                  class="staff-profile__field-value"
                  :class="props.user.email_verified_at ? 'staff-profile__verified' : 'staff-profile__muted'"
                >
                  {{ props.user.email_verified_at ?? 'Not verified' }}
                </p>
              </div>
            </div>
            <div class="staff-profile__about-row">
              <div>
                <p class="staff-profile__field-label">Last Updated</p>
                <p class="staff-profile__field-value">{{ updatedRelative() }}</p>
              </div>
            </div>
          </div>
        </section>

        <section v-if="props.user.bio" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Bio</span>
          </header>
          <div class="staff-profile__bio">{{ props.user.bio }}</div>
        </section>

        <section
          v-if="props.user.can_manage_signature && props.user.signature_invite_endpoint"
          class="staff-profile__card staff-profile__card--signature"
        >
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Signature</span>
          </header>
          <div class="staff-profile__signature-panel">
            <SignatureSigningPanel
              compact
              :staff-name="props.user.raw_name"
              :invite-endpoint="props.user.signature_invite_endpoint"
              :signature-url="props.user.signature_url"
              :signed-at="props.user.signature_signed_at"
              :pending-invite="props.user.pending_signature_invite"
            />
          </div>
        </section>

        <section class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Activity Summary</span>
          </header>
          <div class="staff-profile__summary">
            <div v-for="item in summaryItems" :key="item.key" class="staff-profile__summary-row">
              <span class="staff-profile__summary-dot" :class="item.color" />
              <span class="staff-profile__summary-label">{{ item.label }}</span>
              <span class="staff-profile__summary-val">{{ props.stats[item.key] }}</span>
            </div>
            <div class="staff-profile__summary-row staff-profile__summary-row--total">
              <span class="staff-profile__summary-dot bg-neutral-700" />
              <span class="staff-profile__summary-label">Total Actions</span>
              <span class="staff-profile__summary-val">{{ totalActions }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="staff-profile__main">
        <nav class="staff-profile__tabs" aria-label="Activity sections">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="staff-profile__tab"
            :class="{ 'staff-profile__tab--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span class="staff-profile__tab-count">{{ tab.count }}</span>
          </button>
        </nav>

        <section v-show="activeTab === 'timeline'" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Recent Activity</span>
            <span v-if="timelineMeta.total" class="staff-profile__card-count">
              Showing {{ timelineMeta.from }}–{{ timelineMeta.to }} of {{ timelineMeta.total }}
            </span>
          </header>

          <p v-if="!timelineItems.length" class="staff-profile__empty">No recorded activity yet.</p>

          <ul v-else class="staff-profile__timeline">
            <li v-for="(item, i) in timelineItems" :key="i" class="staff-profile__tl-item">
              <div class="staff-profile__tl-dot" :class="dotClass[item.color] ?? 'staff-profile__tl-dot--blue'" />
              <div class="staff-profile__tl-body">
                <div class="staff-profile__tl-label">
                  <Link v-if="item.href" :href="item.href" class="staff-profile__link">{{ item.label }}</Link>
                  <span v-else>{{ item.label }}</span>
                </div>
                <div class="staff-profile__tl-sub">
                  <Link v-if="item.patient_href" :href="item.patient_href" class="staff-profile__link">
                    {{ item.sub }}
                  </Link>
                  <span v-else>{{ item.sub }}</span>
                </div>
                <div class="staff-profile__tl-ref">
                  <Link v-if="item.href" :href="item.href" class="staff-profile__link">Ref: {{ item.ref }}</Link>
                  <span v-else>Ref: {{ item.ref }}</span>
                </div>
              </div>
              <div class="staff-profile__tl-time">{{ relativeDate(item.date) }}</div>
            </li>
          </ul>

          <div
            v-if="timelineMeta.last_page > 1"
            class="staff-profile__pagination"
          >
            <button
              type="button"
              class="staff-profile__page-btn"
              :disabled="timelineMeta.current_page <= 1"
              @click="goTimelinePage(timelineMeta.current_page - 1)"
            >
              Previous
            </button>
            <span class="staff-profile__page-meta">
              Page {{ timelineMeta.current_page }} of {{ timelineMeta.last_page }}
            </span>
            <button
              type="button"
              class="staff-profile__page-btn"
              :disabled="timelineMeta.current_page >= timelineMeta.last_page"
              @click="goTimelinePage(timelineMeta.current_page + 1)"
            >
              Next
            </button>
          </div>
        </section>

        <section v-show="activeTab === 'encounters'" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Encounters Started</span>
            <span class="staff-profile__card-count">
              {{ props.stats.encountersStarted }} total · showing {{ recentEncounters.length }}
            </span>
          </header>
          <p v-if="!recentEncounters.length" class="staff-profile__empty">No encounters started yet.</p>
          <div v-else class="staff-profile__table-wrap">
            <table class="staff-profile__table">
              <thead>
                <tr>
                  <th>Encounter #</th>
                  <th>Patient</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recentEncounters" :key="row.id">
                  <td class="staff-profile__mono">
                    <Link v-if="row.href" :href="row.href" class="staff-profile__link">{{ row.encounter_number }}</Link>
                    <span v-else>{{ row.encounter_number }}</span>
                  </td>
                  <td>
                    <Link v-if="row.patient_href" :href="row.patient_href" class="staff-profile__link">
                      {{ row.patient_name }}
                    </Link>
                    <span v-else>{{ row.patient_name }}</span>
                  </td>
                  <td><span class="staff-profile__pill staff-profile__pill--muted">{{ row.stage }}</span></td>
                  <td>
                    <span class="staff-profile__pill" :class="encounterStatusClass(row.status_key)">
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="staff-profile__muted-cell">{{ row.started_at ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-show="activeTab === 'prescriptions'" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Prescriptions Written</span>
            <span class="staff-profile__card-count">
              {{ props.stats.prescriptions }} total · showing {{ recentPrescriptions.length }}
            </span>
          </header>
          <p v-if="!recentPrescriptions.length" class="staff-profile__empty">No prescriptions written yet.</p>
          <div v-else class="staff-profile__table-wrap">
            <table class="staff-profile__table">
              <thead>
                <tr>
                  <th>Rx #</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Prescribed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recentPrescriptions" :key="row.id">
                  <td class="staff-profile__mono">
                    <Link v-if="row.href" :href="row.href" class="staff-profile__link">{{ row.prescription_number }}</Link>
                    <span v-else>{{ row.prescription_number }}</span>
                  </td>
                  <td>
                    <Link v-if="row.patient_href" :href="row.patient_href" class="staff-profile__link">
                      {{ row.patient_name }}
                    </Link>
                    <span v-else>{{ row.patient_name }}</span>
                  </td>
                  <td>
                    <span class="staff-profile__pill" :class="prescriptionStatusClass(row.status)">
                      {{ humanize(row.status) }}
                    </span>
                  </td>
                  <td class="staff-profile__muted-cell">{{ row.prescribed_at ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-show="activeTab === 'lab'" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Lab Results Recorded</span>
            <span class="staff-profile__card-count">
              {{ props.stats.labRecorded }} total · showing {{ recentLabResults.length }}
            </span>
          </header>
          <p v-if="!recentLabResults.length" class="staff-profile__empty">No lab results recorded yet.</p>
          <div v-else class="staff-profile__table-wrap">
            <table class="staff-profile__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient</th>
                  <th>Interpretation</th>
                  <th>Status</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recentLabResults" :key="row.id">
                  <td class="staff-profile__muted-cell">
                    <Link v-if="row.href" :href="row.href" class="staff-profile__link">#{{ row.id }}</Link>
                    <span v-else>#{{ row.id }}</span>
                  </td>
                  <td>
                    <Link v-if="row.patient_href" :href="row.patient_href" class="staff-profile__link">
                      {{ row.patient_name }}
                    </Link>
                    <span v-else>{{ row.patient_name }}</span>
                  </td>
                  <td>
                    <span
                      v-if="row.interpretation"
                      class="staff-profile__pill"
                      :class="interpretationClass(row.interpretation)"
                    >
                      {{ humanize(row.interpretation) }}
                    </span>
                    <span v-else class="staff-profile__muted-cell">—</span>
                  </td>
                  <td>
                    <span class="staff-profile__pill" :class="labStatusClass(row.result_status)">
                      {{ humanize(row.result_status) }}
                    </span>
                  </td>
                  <td class="staff-profile__muted-cell">{{ row.recorded_at ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-show="activeTab === 'dispenses'" class="staff-profile__card">
          <header class="staff-profile__card-hd">
            <span class="staff-profile__card-title">Pharmacy Dispenses</span>
            <span class="staff-profile__card-count">
              {{ props.stats.dispenses }} total · showing {{ recentDispenses.length }}
            </span>
          </header>
          <p v-if="!recentDispenses.length" class="staff-profile__empty">No dispenses performed yet.</p>
          <div v-else class="staff-profile__table-wrap">
            <table class="staff-profile__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recentDispenses" :key="row.id">
                  <td class="staff-profile__muted-cell">
                    <Link v-if="row.href" :href="row.href" class="staff-profile__link">#{{ row.id }}</Link>
                    <span v-else>#{{ row.id }}</span>
                  </td>
                  <td>
                    <Link v-if="row.patient_href" :href="row.patient_href" class="staff-profile__link">
                      {{ row.patient_name }}
                    </Link>
                    <span v-else>{{ row.patient_name }}</span>
                  </td>
                  <td>
                    <span class="staff-profile__pill staff-profile__pill--green">{{ humanize(row.status) }}</span>
                  </td>
                  <td class="staff-profile__muted-cell">{{ row.date ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
