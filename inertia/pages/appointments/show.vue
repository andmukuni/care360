<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface Audit {
  id: number
  actionName: string
  actionStage: string
  actionBy: string | null
  notes: string | null
  createdAt: string | null
  createdAtRelative: string | null
  createdAtFormatted: string | null
}

interface Appointment {
  id: number
  appointmentType: string
  appointmentPurpose: string | null
  reason: string | null
  status: string
  preferredDate: string | null
  preferredTime: string | null
  alternateDate: string | null
  alternateTime: string | null
  confirmedDate: string | null
  confirmedTime: string | null
  provider: string | null
  requestedBy: string | null
  requestedByPatientNumber: string | null
  isDependentBooking: boolean
  confirmedBy: string | null
  staffNotes: string | null
  cancellationReason: string | null
  createdAt: string | null
  createdAtFormatted: string | null
  createdAtRelative: string | null
  backTab: string
  patient: {
    id: number
    patientNumber: string
    fullName: string
    gender: string | null
    nrcNumber: string | null
    phoneNumber: string | null
  } | null
  encounter: {
    id: number
    encounterNumber: string
    currentStage: string
    currentStatus: string
    visitType: string | null
    startedAt: string | null
    startedBy: string | null
    audits: Audit[]
  } | null
}

const props = defineProps<{ appointment: Appointment }>()

type TabId = 'overview' | 'schedule' | 'encounter' | 'activity'

const tab = ref<TabId>('overview')

const tabs = computed(() => {
  const items: Array<{ id: TabId; label: string; icon: string; count?: number }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      id: 'encounter',
      label: 'Encounter',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      count: props.appointment.encounter?.audits.length ?? 0,
    },
  ]
  return items
})

const heroName = computed(() => props.appointment.patient?.fullName ?? props.appointment.appointmentType)

const initials = computed(() => {
  const parts = heroName.value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
})

const avatarClass = computed(() => {
  const gender = String(props.appointment.patient?.gender ?? '').toLowerCase()
  if (gender === 'female' || gender === 'f') return 'hero-avatar--female'
  if (gender === 'male' || gender === 'm') return 'hero-avatar--male'
  return 'hero-avatar--other'
})

const statusBadgeClass = computed(() => {
  switch (props.appointment.status) {
    case 'pending':
      return 'b-amber'
    case 'confirmed':
      return 'b-green'
    case 'declined':
    case 'cancelled':
      return 'b-red'
    default:
      return 'b-gray'
  }
})

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWhen(date: string | null, time: string | null): string {
  const dateLabel = formatDate(date)
  if (dateLabel === '—') return '—'
  return time ? `${dateLabel} · ${time}` : dateLabel
}

function display(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  return text === '' ? '—' : text
}

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '—'
  return stage.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function headline(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/appointments" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">
        Appointments
      </Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">#{{ appointment.id }}</span>
    </template>

    <div class="hero-card mb-5">
      <div class="hero-top">
        <div class="hero-avatar" :class="avatarClass">{{ initials }}</div>

        <div class="min-w-0 flex-1">
          <div class="hero-name">{{ heroName }}</div>
          <div class="hero-sub">
            <span v-if="appointment.patient">{{ appointment.patient.patientNumber }}</span>
            <span v-if="display(appointment.patient?.gender) !== '—'">{{ appointment.patient?.gender }}</span>
            <span v-if="display(appointment.patient?.phoneNumber) !== '—'">{{ appointment.patient?.phoneNumber }}</span>
            <span v-if="display(appointment.patient?.nrcNumber) !== '—'">NRC {{ appointment.patient?.nrcNumber }}</span>
            <span>{{ appointment.appointmentType }}</span>
            <span v-if="appointment.appointmentPurpose">{{ appointment.appointmentPurpose }}</span>
          </div>
          <div class="hero-badges mt-2">
            <span class="badge b-black font-mono text-xs">#{{ appointment.id }}</span>
            <span class="badge" :class="statusBadgeClass">{{ appointment.status }}</span>
            <span v-if="appointment.appointmentPurpose" class="badge b-blue">{{ appointment.appointmentPurpose }}</span>
            <span class="badge b-gray">{{ appointment.appointmentType }}</span>
            <span v-if="display(appointment.provider) !== '—'" class="badge b-gray">{{ appointment.provider }}</span>
            <span v-if="appointment.encounter" class="badge b-green font-mono text-xs">
              {{ appointment.encounter.encounterNumber }}
            </span>
          </div>
        </div>

        <div class="flex-shrink-0 text-right text-xs text-neutral-500 dark:text-neutral-400">
          <div class="mb-1 text-[10px] font-semibold uppercase">Submitted</div>
          <div class="font-semibold text-neutral-700 dark:text-neutral-200">
            {{ appointment.createdAtFormatted ?? '—' }}
          </div>
          <div v-if="appointment.createdAtRelative">{{ appointment.createdAtRelative }}</div>
          <div v-if="appointment.confirmedDate" class="mt-2 text-green-600 font-semibold">
            Confirmed {{ formatWhen(appointment.confirmedDate, appointment.confirmedTime) }}
          </div>
        </div>
      </div>

      <div class="patient-stats-strip">
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ formatWhen(appointment.preferredDate, appointment.preferredTime) }}</div>
          <div class="patient-stat-lbl">Preferred</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ formatWhen(appointment.alternateDate, appointment.alternateTime) }}</div>
          <div class="patient-stat-lbl">Alternate</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ formatWhen(appointment.confirmedDate, appointment.confirmedTime) }}</div>
          <div class="patient-stat-lbl">Confirmed</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ display(appointment.provider) }}</div>
          <div class="patient-stat-lbl">Provider</div>
        </div>
      </div>

      <div class="patient-action-row">
        <Link :href="`/appointments?tab=${appointment.backTab}`" class="patient-action-btn">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          All Appointments
        </Link>
        <Link
          v-if="appointment.patient"
          :href="`/patients/${appointment.patient.patientNumber}`"
          class="patient-action-btn"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          View Patient
        </Link>
        <Link
          v-if="appointment.encounter"
          :href="`/encounters/${appointment.encounter.id}`"
          class="patient-action-btn patient-action-btn--primary"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          Open Encounter
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
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span class="sc-title">Appointment Details</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item">
                  <label>Reference</label>
                  <span class="font-mono font-semibold">#{{ appointment.id }}</span>
                </div>
                <div class="kv-item">
                  <label>Status</label>
                  <span class="capitalize">{{ appointment.status }}</span>
                </div>
                <div class="kv-item">
                  <label>Type</label>
                  <span>{{ appointment.appointmentType }}</span>
                </div>
                <div class="kv-item">
                  <label>Purpose</label>
                  <span>{{ display(appointment.appointmentPurpose) }}</span>
                </div>
                <div class="kv-item">
                  <label>Provider</label>
                  <span>{{ display(appointment.provider) }}</span>
                </div>
                <div class="kv-item">
                  <label>Confirmed By</label>
                  <span>{{ display(appointment.confirmedBy) }}</span>
                </div>
                <div class="kv-item">
                  <label>Submitted</label>
                  <span>{{ appointment.createdAtFormatted ?? '—' }}</span>
                </div>
              </div>
              <div v-if="appointment.reason" class="mt-3 theme-surface rounded p-3">
                <p class="text-[10px] font-bold uppercase text-neutral-500">Reason / Details</p>
                <p class="mt-1 whitespace-pre-line text-sm text-neutral-700">{{ appointment.reason }}</p>
              </div>
            </div>
          </div>

          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span class="sc-title">Patient</span>
            </div>
            <div v-if="appointment.patient" class="sc-bd">
              <div class="kv">
                <div class="kv-item">
                  <label>Full Name</label>
                  <span class="font-semibold">{{ appointment.patient.fullName }}</span>
                </div>
                <div class="kv-item">
                  <label>Patient ID</label>
                  <span class="font-mono">{{ appointment.patient.patientNumber }}</span>
                </div>
                <div class="kv-item">
                  <label>Gender</label>
                  <span>{{ display(appointment.patient.gender) }}</span>
                </div>
                <div class="kv-item">
                  <label>Phone</label>
                  <span>{{ display(appointment.patient.phoneNumber) }}</span>
                </div>
                <div class="kv-item">
                  <label>NRC</label>
                  <span>{{ display(appointment.patient.nrcNumber) }}</span>
                </div>
                <div v-if="appointment.isDependentBooking" class="kv-item">
                  <label>Requested By</label>
                  <span>{{ display(appointment.requestedBy) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="sc-bd">
              <p class="text-sm text-neutral-400">No linked patient.</p>
            </div>
          </div>
        </div>

        <div v-if="appointment.staffNotes || appointment.cancellationReason" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div v-if="appointment.staffNotes" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Staff Notes</span>
            </div>
            <div class="sc-bd">
              <p class="whitespace-pre-line text-sm text-neutral-700">{{ appointment.staffNotes }}</p>
            </div>
          </div>
          <div v-if="appointment.cancellationReason" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Cancellation Reason</span>
            </div>
            <div class="sc-bd">
              <p class="text-sm text-neutral-700">{{ appointment.cancellationReason }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Schedule -->
      <div class="enc-panel" :class="{ active: tab === 'schedule' }">
        <div class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="sc-title">Scheduling</span>
          </div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item">
                <label>Preferred</label>
                <span class="font-semibold">{{ formatWhen(appointment.preferredDate, appointment.preferredTime) }}</span>
              </div>
              <div class="kv-item">
                <label>Alternate</label>
                <span>{{ formatWhen(appointment.alternateDate, appointment.alternateTime) }}</span>
              </div>
              <div class="kv-item">
                <label>Confirmed</label>
                <span class="font-semibold text-green-700 dark:text-green-400">
                  {{ formatWhen(appointment.confirmedDate, appointment.confirmedTime) }}
                </span>
              </div>
              <div class="kv-item">
                <label>Preferred Provider</label>
                <span>{{ display(appointment.provider) }}</span>
              </div>
              <div class="kv-item">
                <label>Submitted</label>
                <span>{{ appointment.createdAtFormatted ?? '—' }}</span>
              </div>
              <div class="kv-item">
                <label>Confirmed By</label>
                <span>{{ display(appointment.confirmedBy) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Encounter -->
      <div class="enc-panel" :class="{ active: tab === 'encounter' }">
        <div class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="sc-title">Linked Encounter</span>
            <span v-if="appointment.encounter" class="badge b-gray ml-auto">{{ appointment.encounter.encounterNumber }}</span>
          </div>
          <div v-if="appointment.encounter" class="sc-bd">
            <div class="kv">
              <div class="kv-item">
                <label>Encounter #</label>
                <span class="font-mono font-semibold">{{ appointment.encounter.encounterNumber }}</span>
              </div>
              <div class="kv-item">
                <label>Visit Type</label>
                <span>{{ display(appointment.encounter.visitType) }}</span>
              </div>
              <div class="kv-item">
                <label>Current Stage</label>
                <span>{{ stageLabel(appointment.encounter.currentStage) }}</span>
              </div>
              <div class="kv-item">
                <label>Status</label>
                <span class="capitalize">{{ appointment.encounter.currentStatus }}</span>
              </div>
              <div class="kv-item">
                <label>Started</label>
                <span>{{ display(appointment.encounter.startedAt) }}</span>
              </div>
              <div class="kv-item">
                <label>Started By</label>
                <span>{{ display(appointment.encounter.startedBy) }}</span>
              </div>
            </div>
            <Link
              :href="`/encounters/${appointment.encounter.id}`"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              Open encounter
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div v-else class="sc-bd">
            <div class="empty-state">
              <p>No encounter started from this appointment yet.</p>
              <p v-if="appointment.status === 'confirmed'" class="mt-1 text-xs text-neutral-400">
                Use <span class="font-semibold">Queue patient</span> on the Confirmed tab to start one.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity -->
      <div class="enc-panel" :class="{ active: tab === 'activity' }">
        <div class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="sc-title">Activity</span>
            <span v-if="appointment.encounter?.audits.length" class="badge b-gray ml-auto">
              {{ appointment.encounter.audits.length }}
            </span>
          </div>
          <div class="sc-bd">
            <div v-if="appointment.encounter?.audits.length" class="timeline">
              <div v-for="audit in appointment.encounter.audits" :key="audit.id" class="tl-item">
                <div class="tl-dot tl-dot-done" />
                <div class="tl-stage">{{ headline(audit.actionName) }}</div>
                <div class="tl-meta">
                  {{ stageLabel(audit.actionStage) }}
                  <template v-if="audit.actionBy"> · {{ audit.actionBy }}</template>
                  <template v-if="audit.createdAtRelative"> · {{ audit.createdAtRelative }}</template>
                </div>
                <div v-if="audit.notes" class="mt-1 text-xs italic text-neutral-500">{{ audit.notes }}</div>
              </div>
            </div>
            <div v-else class="empty-state">
              <p>No clinical activity yet.</p>
              <p class="mt-1 text-xs text-neutral-400">
                Appointment submitted {{ appointment.createdAtFormatted ?? '—' }}
                <template v-if="appointment.confirmedDate">
                  · confirmed for {{ formatDate(appointment.confirmedDate) }}
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
