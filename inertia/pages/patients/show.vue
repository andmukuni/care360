<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import JsBarcode from 'jsbarcode'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface NotificationItem {
  id: string
  type: string
  data: Record<string, any>
  readAt: string | null
  createdAt: string | null
}

interface EncounterRow {
  id: number
  encounter_number: string
  current_stage: string
  current_status: string
  priority_level?: string
  visit_type?: string
  started_at: string | null
  closed_at: string | null
}

interface HouseholdMember {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  relationshipToHead: string
  phoneNumber: string
  isSelf: boolean
}

type TabId =
  | 'overview'
  | 'demographics'
  | 'medical'
  | 'household'
  | 'encounters'
  | 'barcode'
  | 'portal'

const props = defineProps<{
  patient: Record<string, any>
  patientDbId: number
  household: Record<string, any> | null
  recentEncounters: EncounterRow[]
  householdMembers: HouseholdMember[]
  isRegistrationClerk: boolean
  canStartEncounter: boolean
  patientNotifications: NotificationItem[]
}>()

const tab = ref<TabId>('overview')
const notifications = ref<NotificationItem[]>([...props.patientNotifications])
const showPasswordForm = ref(false)
const barcodeSvgRef = ref<SVGSVGElement | null>(null)

const passwordForm = useForm({
  password: '',
  password_confirmation: '',
})

const ACTIVE_STAGES = new Set([
  'registration',
  'triage',
  'screening',
  'lab',
  'screening_review',
  'pharmacy',
])

const tabs = computed(() => {
  const items: Array<{ id: TabId; label: string; icon: string; count?: number }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      id: 'demographics',
      label: 'Demographics',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      id: 'household',
      label: 'Household',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      id: 'barcode',
      label: 'Barcode',
      icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    },
  ]

  if (!props.isRegistrationClerk) {
    items.splice(2, 0, {
      id: 'medical',
      label: 'Medical',
      icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    })
    items.splice(4, 0, {
      id: 'encounters',
      label: 'Encounters',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      count: props.recentEncounters.length,
    })
    items.push({
      id: 'portal',
      label: 'Portal',
      icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    })
  }

  return items
})

const initials = computed(() => {
  const parts = String(props.patient.fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
})

const avatarClass = computed(() => {
  const gender = String(props.patient.gender ?? '').toLowerCase()
  if (gender === 'female' || gender === 'f') return 'hero-avatar--female'
  if (gender === 'male' || gender === 'm') return 'hero-avatar--male'
  return 'hero-avatar--other'
})

const age = computed(() => calcAge(props.patient.dateOfBirth))
const birthLabel = computed(() => {
  const dob = formatDate(props.patient.dateOfBirth)
  if (dob === '—') return '—'
  return age.value !== null ? `${dob} (${age.value} yrs)` : dob
})
const registeredLabel = computed(() => formatDate(props.patient.createdAt))

const encounterStats = computed(() => {
  const total = props.recentEncounters.length
  const active = props.recentEncounters.filter(
    (enc) =>
      ACTIVE_STAGES.has(String(enc.current_stage ?? '').toLowerCase()) &&
      String(enc.current_status ?? '').toLowerCase() !== 'completed'
  ).length
  const done = props.recentEncounters.filter((enc) => isEncounterClosed(enc)).length
  const last = props.recentEncounters[0]?.started_at
  return {
    total,
    active,
    done,
    lastVisit: last ? formatDate(last) : '—',
  }
})

const unreadNotificationCount = computed(
  () => notifications.value.filter((n) => !n.readAt).length
)

const hasAllergies = computed(() => {
  const value = String(props.patient.allergies ?? '').trim()
  return value !== '' && value !== '—' && value.toLowerCase() !== 'none'
})

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) years--
  return years
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16).replace('T', ' ')
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function display(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  return text === '' ? '—' : text
}

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '—'
  return stage.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isEncounterClosed(enc: EncounterRow): boolean {
  return enc.closed_at !== null || String(enc.current_stage ?? '').toLowerCase() === 'completed'
}

function encounterTitle(enc: EncounterRow): string {
  return stageLabel(enc.current_stage) || 'Visit'
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function memberAvatarClass(gender: string): string {
  const g = gender.toLowerCase()
  if (g === 'female' || g === 'f') return 'hero-avatar--female'
  if (g === 'male' || g === 'm') return 'hero-avatar--male'
  return 'hero-avatar--other'
}

function startEncounter(visitType: string) {
  router.post('/encounters/start', {
    patient_id: props.patientDbId,
    visit_type: visitType,
  })
}

function sendInvitation() {
  router.post(`/patients/${props.patient.patientId}/portal-invitation`, {}, { preserveScroll: true })
}

function submitPassword() {
  passwordForm.put(`/patients/${props.patient.patientId}/portal-password`, {
    preserveScroll: true,
    onSuccess: () => {
      passwordForm.reset()
      showPasswordForm.value = false
    },
  })
}

function readXsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function markRead(id: string) {
  await fetch(`/patients/${props.patient.patientId}/notifications/${id}/read`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': readXsrfToken(), Accept: 'application/json' },
  })
  const n = notifications.value.find((x) => x.id === id)
  if (n) n.readAt = new Date().toISOString()
}

async function markAllRead() {
  await fetch(`/patients/${props.patient.patientId}/notifications/read-all`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': readXsrfToken(), Accept: 'application/json' },
  })
  notifications.value.forEach((n) => (n.readAt = n.readAt ?? new Date().toISOString()))
}

function notificationText(n: NotificationItem): string {
  return String(n.data.message ?? n.data.title ?? n.type)
}

function printBarcode() {
  window.print()
}

function renderBarcode() {
  const node = barcodeSvgRef.value
  const value = String(props.patient.barcode ?? '').trim()
  if (!node || !value) return
  try {
    JsBarcode(node, value, {
      format: 'CODE128',
      width: 2.2,
      height: 55,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    node.innerHTML = ''
  }
}

onMounted(() => {
  if (tab.value === 'barcode') renderBarcode()
})

watch(tab, (next) => {
  if (next === 'barcode') {
    setTimeout(renderBarcode, 0)
  }
})
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/patients" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">Patients</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ patient.fullName }}</span>
    </template>

    <div
      v-if="patient.isDeceased"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
    >
      <strong>Deceased patient.</strong>
      <template v-if="patient.deceasedAt"> Recorded {{ formatDate(patient.deceasedAt) }}.</template>
      New encounters should not be started for this patient.
    </div>

    <div class="hero-card mb-5">
      <div class="hero-top">
        <div class="hero-avatar" :class="avatarClass">{{ initials }}</div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <div class="hero-name">{{ patient.fullName }}</div>
            <span
              v-if="isRegistrationClerk"
              class="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600"
            >
              Registration Mode
            </span>
          </div>
          <div class="hero-sub">
            <span>{{ patient.patientId }}</span>
            <span>{{ display(patient.gender) }}</span>
            <span>{{ birthLabel }}</span>
            <span v-if="display(patient.phoneNumber) !== '—'">{{ patient.phoneNumber }}</span>
            <span v-if="display(patient.nrcNumber) !== '—'">NRC {{ patient.nrcNumber }}</span>
            <span v-if="!isRegistrationClerk && display(patient.nupn) !== '—'">NUPN {{ patient.nupn }}</span>
          </div>
          <div class="hero-badges">
            <span class="badge b-black font-mono text-xs">{{ patient.patientId }}</span>
            <span
              class="badge"
              :class="patient.status?.toLowerCase() === 'inactive' ? 'b-gray' : 'b-green'"
            >
              {{ patient.status }}
            </span>
            <span v-if="patient.isDeceased" class="badge b-red">Deceased</span>
            <span v-if="!isRegistrationClerk && display(patient.bloodGroup) !== '—'" class="badge b-blue">
              🩸 {{ patient.bloodGroup }}
            </span>
            <span v-if="!isRegistrationClerk && hasAllergies" class="badge b-red">⚠ Allergies</span>
            <span v-if="!isRegistrationClerk && display(patient.artNumber) !== '—'" class="badge b-gray">
              ART {{ patient.artNumber }}
            </span>
            <span v-if="!isRegistrationClerk && encounterStats.active > 0" class="badge b-amber">
              {{ encounterStats.active }} Active Visit
            </span>
          </div>
        </div>

        <div class="flex-shrink-0 text-right text-xs text-neutral-500 dark:text-neutral-400">
          <div class="mb-1 text-[10px] font-semibold uppercase">Registered</div>
          <div class="font-semibold text-neutral-700 dark:text-neutral-200">{{ registeredLabel }}</div>
        </div>
      </div>

      <div v-if="!isRegistrationClerk" class="patient-stats-strip">
        <div class="patient-stat-cell">
          <div class="patient-stat-val">{{ encounterStats.total }}</div>
          <div class="patient-stat-lbl">Total Visits</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val" :class="encounterStats.active > 0 ? 'text-amber-500' : ''">
            {{ encounterStats.active }}
          </div>
          <div class="patient-stat-lbl">Active</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-green-600">{{ encounterStats.done }}</div>
          <div class="patient-stat-lbl">Completed</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ encounterStats.lastVisit }}</div>
          <div class="patient-stat-lbl">Last Visit</div>
        </div>
        <div v-if="household" class="patient-stat-cell">
          <div class="patient-stat-val truncate text-sm font-semibold">{{ household.headOfHouseName }}</div>
          <div class="patient-stat-lbl">Household</div>
        </div>
      </div>

      <div class="patient-action-row">
        <Link :href="`/patients/${patient.patientId}/edit`" class="patient-action-btn">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Profile
        </Link>

        <template v-if="canStartEncounter && !patient.isDeceased">
          <button type="button" class="patient-action-btn patient-action-btn--primary" @click="startEncounter('OPD')">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {{ isRegistrationClerk ? 'Start Encounter' : 'Attend to Patient' }}
          </button>
          <button type="button" class="patient-action-btn" @click="startEncounter('Admission')">Admission</button>
          <button type="button" class="patient-action-btn" @click="startEncounter('Appointment')">Appointment</button>
        </template>

        <Link
          v-if="!isRegistrationClerk"
          :href="`/patients/${patient.patientId}/encounters`"
          class="patient-action-btn"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Full Visit History
        </Link>
      </div>
    </div>

    <div class="space-y-4">
      <div class="stage-tab-nav-sticky">
        <nav class="enc-tab-nav">
          <button
            v-for="tb in tabs"
            :key="tb.id"
            type="button"
            class="enc-tab-btn"
            :class="{ active: tab === tb.id }"
            @click="tab = tb.id"
          >
            <svg class="h-[13px] w-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tb.icon" />
            </svg>
            {{ tb.label }}
            <span
              v-if="tb.count"
              class="ml-1 rounded-full bg-neutral-600 px-1.5 py-0.5 text-[10px] text-white"
            >
              {{ tb.count }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Overview -->
      <div class="enc-panel" :class="{ active: tab === 'overview' }">
        <div
          v-if="!isRegistrationClerk && hasAllergies"
          class="mb-4 flex items-start gap-3 rounded border border-l-4 border-red-300 border-l-red-500 bg-red-50 p-4"
        >
          <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="text-sm font-bold text-red-700">⚠ Known Allergies</p>
            <p class="mt-0.5 text-sm text-red-600">{{ patient.allergies }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.418 2 2.83" />
              </svg>
              <span class="sc-title">Identity</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item"><label>Patient ID</label><span class="font-mono font-semibold">{{ patient.patientId }}</span></div>
                <div class="kv-item"><label>Full Name</label><span class="font-semibold">{{ patient.fullName }}</span></div>
                <div class="kv-item"><label>Gender</label><span>{{ display(patient.gender) }}</span></div>
                <div class="kv-item"><label>Date of Birth</label><span>{{ birthLabel }}</span></div>
                <div class="kv-item"><label>NRC Number</label><span class="font-mono">{{ display(patient.nrcNumber) }}</span></div>
                <div class="kv-item"><label>NUPN</label><span class="font-mono">{{ display(patient.nupn) }}</span></div>
                <div class="kv-item"><label>Registered On</label><span>{{ registeredLabel }}</span></div>
                <div class="kv-item"><label>Country</label><span>{{ display(patient.country) }}</span></div>
                <div class="kv-item"><label>Status</label><span>{{ patient.status }}</span></div>
              </div>
            </div>
          </div>

          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span class="sc-title">Contact</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item"><label>Phone</label><span>{{ display(patient.phoneNumber) }}</span></div>
                <div v-if="display(patient.otherCellphone) !== '—'" class="kv-item"><label>Other Cell</label><span>{{ patient.otherCellphone }}</span></div>
                <div v-if="display(patient.email) !== '—'" class="kv-item"><label>Email</label><span>{{ patient.email }}</span></div>
                <div class="kv-item"><label>City / Town</label><span>{{ display(patient.cityTownVillage) }}</span></div>
                <div v-if="display(patient.area) !== '—'" class="kv-item"><label>Area</label><span>{{ patient.area }}</span></div>
                <div v-if="display(patient.roadStreet) !== '—'" class="kv-item"><label>Street</label><span>{{ patient.roadStreet }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!isRegistrationClerk" class="sc mt-4">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span class="sc-title">Patient Notifications</span>
            <button
              v-if="unreadNotificationCount > 0"
              type="button"
              class="ml-auto text-[11px] text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
              @click="markAllRead"
            >
              Mark all as read
            </button>
            <span v-if="notifications.length" class="badge b-gray">{{ notifications.length }} recent</span>
            <span class="badge" :class="unreadNotificationCount > 0 ? 'b-amber' : 'b-gray'">
              {{ unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'All read' }}
            </span>
          </div>
          <div v-if="notifications.length">
            <div v-for="n in notifications" :key="n.id" class="patient-enc-row">
              <div>
                <span class="badge" :class="n.readAt ? 'b-gray' : 'b-amber'">{{ n.readAt ? 'Seen' : 'New' }}</span>
              </div>
              <div class="patient-enc-info">
                <div class="patient-enc-diag">{{ n.data.title ?? 'Patient update' }}</div>
                <div class="patient-enc-meta">{{ notificationText(n) }}</div>
              </div>
              <span class="badge b-blue">{{ (n.data.type ?? 'info').toString() }}</span>
              <div class="patient-enc-date">
                <div>{{ formatDateTime(n.createdAt) }}</div>
                <button
                  v-if="!n.readAt"
                  type="button"
                  class="mt-1 text-[11px] text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
                  @click="markRead(n.id)"
                >
                  Mark read
                </button>
              </div>
            </div>
          </div>
          <div v-else class="sc-bd">
            <div class="empty-state">
              <p>No patient notifications yet.</p>
            </div>
          </div>
        </div>

        <div v-if="!isRegistrationClerk && recentEncounters.length" class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="sc-title">Recent Visits</span>
            <button type="button" class="ml-auto text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-800" @click="tab = 'encounters'">
              View all →
            </button>
          </div>
          <div>
            <Link
              v-for="enc in recentEncounters.slice(0, 4)"
              :key="enc.id"
              :href="`/encounters/${enc.id}`"
              class="patient-enc-row"
            >
              <div class="patient-enc-num">{{ enc.encounter_number }}</div>
              <div class="patient-enc-info">
                <div class="patient-enc-diag">{{ encounterTitle(enc) }}</div>
                <div class="patient-enc-meta">
                  {{ display(enc.visit_type) }} · Stage: {{ stageLabel(enc.current_stage) }}
                </div>
              </div>
              <span class="badge" :class="isEncounterClosed(enc) ? 'b-green' : 'b-amber'">
                {{ isEncounterClosed(enc) ? 'Completed' : 'Active' }}
              </span>
              <div class="patient-enc-date">{{ formatDate(enc.started_at) }}</div>
            </Link>
          </div>
        </div>
      </div>

      <!-- Demographics -->
      <div class="enc-panel" :class="{ active: tab === 'demographics' }">
        <div class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="sc-title">Personal Information</span>
          </div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>Full Name</label><span class="font-semibold">{{ patient.fullName }}</span></div>
              <div class="kv-item"><label>Gender</label><span>{{ display(patient.gender) }}</span></div>
              <div class="kv-item"><label>Date of Birth</label><span>{{ formatDate(patient.dateOfBirth) }}</span></div>
              <div class="kv-item"><label>Age</label><span>{{ age !== null ? `${age} years` : '—' }}</span></div>
              <div class="kv-item"><label>Marital Status</label><span>{{ display(patient.maritalStatus) }}</span></div>
              <div class="kv-item"><label>Occupation</label><span>{{ display(patient.occupation) }}</span></div>
              <div class="kv-item"><label>Home Language</label><span>{{ display(patient.homeLanguage) }}</span></div>
              <div class="kv-item"><label>Country</label><span>{{ display(patient.country) }}</span></div>
              <div class="kv-item"><label>NRC Number</label><span class="font-mono">{{ display(patient.nrcNumber) }}</span></div>
              <div class="kv-item"><label>Registered On</label><span>{{ registeredLabel }}</span></div>
            </div>
          </div>
        </div>

        <div v-if="display(patient.spouseFirstName) !== '—' || display(patient.spouseSurname) !== '—'" class="sc">
          <div class="sc-hd"><span class="sc-title">Spouse</span></div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>First Name</label><span>{{ display(patient.spouseFirstName) }}</span></div>
              <div class="kv-item"><label>Surname</label><span>{{ display(patient.spouseSurname) }}</span></div>
            </div>
          </div>
        </div>

        <div class="sc">
          <div class="sc-hd"><span class="sc-title">Contact Information</span></div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>Cellphone</label><span>{{ display(patient.phoneNumber) }}</span></div>
              <div class="kv-item"><label>Other Cellphone</label><span>{{ display(patient.otherCellphone) }}</span></div>
              <div class="kv-item"><label>Landline</label><span>{{ display(patient.landline) }}</span></div>
              <div class="kv-item"><label>Email</label><span>{{ display(patient.email) }}</span></div>
              <div class="kv-item"><label>House Number</label><span>{{ display(patient.houseNumber) }}</span></div>
              <div class="kv-item"><label>Road / Street</label><span>{{ display(patient.roadStreet) }}</span></div>
              <div class="kv-item"><label>Area</label><span>{{ display(patient.area) }}</span></div>
              <div class="kv-item"><label>City / Town / Village</label><span>{{ display(patient.cityTownVillage) }}</span></div>
              <div v-if="display(patient.landmarks) !== '—'" class="kv-item kv-w">
                <label>Landmarks & Directions</label><span>{{ patient.landmarks }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="sc">
          <div class="sc-hd"><span class="sc-title">Place of Birth</span></div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>Born in Zambia</label><span>{{ display(patient.bornInZambia) }}</span></div>
              <div class="kv-item"><label>Province of Birth</label><span>{{ display(patient.provinceOfBirth) }}</span></div>
              <div class="kv-item"><label>District of Birth</label><span>{{ display(patient.districtOfBirth) }}</span></div>
              <div class="kv-item"><label>Place of Birth</label><span>{{ display(patient.placeOfBirth) }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Medical -->
      <div v-if="!isRegistrationClerk" class="enc-panel" :class="{ active: tab === 'medical' }">
        <div
          v-if="hasAllergies"
          class="mb-4 flex items-start gap-3 rounded border border-l-4 border-red-300 border-l-red-600 bg-red-50 p-4"
        >
          <div>
            <p class="mb-1 text-sm font-bold text-red-700">⚠ Known Allergies — Review Before Prescribing</p>
            <p class="text-sm text-red-600">{{ patient.allergies }}</p>
          </div>
        </div>

        <div class="sc">
          <div class="sc-hd"><span class="sc-title">Medical Identifiers & Biometrics</span></div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>ART Number</label><span class="font-mono font-semibold">{{ display(patient.artNumber) }}</span></div>
              <div class="kv-item"><label>NUPN</label><span class="font-mono">{{ display(patient.nupn) }}</span></div>
              <div class="kv-item">
                <label>Blood Group</label>
                <span>
                  <span v-if="display(patient.bloodGroup) !== '—'" class="badge b-blue text-sm font-bold">{{ patient.bloodGroup }}</span>
                  <template v-else>—</template>
                </span>
              </div>
              <div class="kv-item"><label>Allergies</label><span>{{ display(patient.allergies) }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Household -->
      <div class="enc-panel" :class="{ active: tab === 'household' }">
        <template v-if="household">
          <div class="sc">
            <div class="sc-hd">
              <span class="sc-title">Household</span>
              <Link
                :href="`/households/${household.householdId}`"
                class="ml-auto text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-800"
              >
                View household →
              </Link>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item"><label>Head of House</label><span class="font-semibold">{{ household.headOfHouseName }}</span></div>
                <div class="kv-item"><label>Household ID</label><span class="font-mono">{{ household.householdId }}</span></div>
                <div v-if="display(household.phoneNumber) !== '—'" class="kv-item"><label>Phone</label><span>{{ household.phoneNumber }}</span></div>
                <div v-if="display(household.village) !== '—'" class="kv-item"><label>Village</label><span>{{ household.village }}</span></div>
                <div v-if="display(household.town) !== '—'" class="kv-item"><label>Town</label><span>{{ household.town }}</span></div>
                <div class="kv-item"><label>Relationship to Head</label><span>{{ display(patient.relationshipToHead) }}</span></div>
              </div>
            </div>
          </div>

          <div v-if="householdMembers.length" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Household Members</span>
              <span class="ml-auto badge b-gray">{{ householdMembers.length }}</span>
            </div>
            <div>
              <div
                v-for="member in householdMembers"
                :key="member.patientId"
                class="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800"
                :class="member.isSelf ? 'bg-neutral-50 dark:bg-neutral-900/40' : ''"
              >
                <div class="hero-avatar !h-9 !w-9 !text-xs" :class="memberAvatarClass(member.gender)">
                  {{ memberInitials(member.fullName) }}
                </div>
                <div class="min-w-0 flex-1">
                  <template v-if="member.isSelf">
                    <div class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ member.fullName }}</div>
                  </template>
                  <Link
                    v-else
                    :href="`/patients/${member.patientId}`"
                    class="text-sm font-bold text-neutral-900 hover:text-blue-700 hover:underline dark:text-neutral-100"
                  >
                    {{ member.fullName }}
                  </Link>
                  <div class="text-[11px] text-neutral-400">
                    {{ member.patientId }}
                    <template v-if="calcAge(member.dateOfBirth) !== null"> · {{ calcAge(member.dateOfBirth) }}y</template>
                    <template v-if="member.gender"> · {{ member.gender }}</template>
                    <template v-if="member.relationshipToHead"> · {{ member.relationshipToHead }}</template>
                  </div>
                </div>
                <span v-if="member.isSelf" class="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-600">You</span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <p>This patient is not linked to a household.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Encounters -->
      <div v-if="!isRegistrationClerk" class="enc-panel" :class="{ active: tab === 'encounters' }">
        <div v-if="recentEncounters.length" class="sc">
          <div class="sc-hd">
            <span class="sc-title">Visit History</span>
            <span class="ml-auto badge b-gray">{{ recentEncounters.length }} encounters</span>
          </div>
          <Link
            v-for="enc in recentEncounters"
            :key="enc.id"
            :href="`/encounters/${enc.id}`"
            class="patient-enc-row"
          >
            <div class="patient-enc-num">{{ enc.encounter_number }}</div>
            <div class="patient-enc-info">
              <div class="patient-enc-diag">{{ encounterTitle(enc) }}</div>
              <div class="patient-enc-meta flex flex-wrap gap-3">
                <span>{{ display(enc.visit_type) }}</span>
                <span>Stage: {{ stageLabel(enc.current_stage) }}</span>
              </div>
            </div>
            <span class="badge" :class="isEncounterClosed(enc) ? 'b-green' : 'b-amber'">
              {{ isEncounterClosed(enc) ? 'Completed' : 'Active' }}
            </span>
            <div class="patient-enc-date">
              <div>{{ formatDate(enc.started_at) }}</div>
              <div v-if="enc.started_at" class="mt-0.5 text-[10px]">
                {{ new Date(enc.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}
              </div>
            </div>
          </Link>
          <div v-if="recentEncounters.length >= 20" class="border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
            <Link
              :href="`/patients/${patient.patientId}/encounters`"
              class="text-xs font-semibold text-neutral-600 transition hover:text-neutral-900"
            >
              View full history →
            </Link>
          </div>
        </div>
        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <p>No encounters found for this patient.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Barcode -->
      <div class="enc-panel" :class="{ active: tab === 'barcode' }">
        <div v-if="display(patient.barcode) !== '—'" class="sc">
          <div class="sc-hd">
            <span class="sc-title">Patient Barcode</span>
            <button type="button" class="patient-action-btn ml-auto text-xs" @click="printBarcode">
              Print Barcode
            </button>
          </div>
          <div class="sc-bd flex flex-col items-center py-8">
            <div id="patient-barcode-printable" class="patient-barcode-label">
              <p class="patient-barcode-label__name">{{ patient.fullName }}</p>
              <p v-if="display(patient.phoneNumber) !== '—'" class="patient-barcode-label__name !mb-2 !font-normal !text-[11px]">
                {{ patient.phoneNumber }}
              </p>
              <svg ref="barcodeSvgRef" />
              <p class="patient-barcode-label__value">{{ patient.barcode }}</p>
            </div>
            <p class="mt-4 text-xs text-neutral-400">Use CODE128 scanner to look up this patient</p>
          </div>
        </div>
        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <p>No barcode assigned to this patient.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Portal -->
      <div v-if="!isRegistrationClerk" class="enc-panel" :class="{ active: tab === 'portal' }">
        <div class="sc">
          <div class="sc-hd"><span class="sc-title">Patient Portal</span></div>
          <div class="sc-bd space-y-4">
            <div class="kv">
              <div class="kv-item">
                <label>Portal Email</label>
                <span :class="patient.email ? 'text-green-700' : ''">
                  {{ patient.email ? patient.email : 'No email on file' }}
                </span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="patient-action-btn patient-action-btn--primary" @click="sendInvitation">
                Send Portal Invitation
              </button>
              <button type="button" class="patient-action-btn" @click="showPasswordForm = !showPasswordForm">
                Set Portal Password
              </button>
            </div>
            <form
              v-if="showPasswordForm"
              class="space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800"
              @submit.prevent="submitPassword"
            >
              <input
                v-model="passwordForm.password"
                type="password"
                placeholder="New password"
                class="theme-field w-full rounded px-3 py-2 text-sm"
              />
              <p v-if="passwordForm.errors.password" class="text-xs text-red-600">{{ passwordForm.errors.password }}</p>
              <input
                v-model="passwordForm.password_confirmation"
                type="password"
                placeholder="Confirm password"
                class="theme-field w-full rounded px-3 py-2 text-sm"
              />
              <ActionButton type="submit" variant="primary" :loading="passwordForm.processing" loading-text="Saving…">
                Save Password
              </ActionButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
