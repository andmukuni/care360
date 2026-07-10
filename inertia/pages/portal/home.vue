<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface Doctor {
  id: number
  name: string
  headline: string | null
  photo_url: string | null
  rating: number | null
}

const props = defineProps<{
  patient: Record<string, any>
  guardian: Record<string, any>
  viewingDependent: boolean
  recentEncounters: Array<Record<string, any>>
  unreadNotifications: number
  visitPayload: Record<string, any>
  nextAppointment: Record<string, any> | null
  outstandingBalance: string
  recentLabResults: Array<Record<string, any>>
  recentPrescriptions: Array<Record<string, any>>
  healthTips: Array<{ category: string; title: string; message: string }>
  healthTipRotationSeconds: number
  interestedDoctors: Doctor[]
}>()

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function money(value: string | number): string {
  const n = Number(value)
  return Number.isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function humanizeStage(stage: any): string {
  const s = String(stage ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

const nextApptDate = computed(() =>
  props.nextAppointment ? props.nextAppointment.confirmedDate ?? props.nextAppointment.preferredDate : null
)

// Rotating health tip
const tipIndex = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
const currentTip = computed(() => props.healthTips[tipIndex.value] ?? null)
onMounted(() => {
  if (props.healthTips.length > 1) {
    timer = setInterval(() => {
      tipIndex.value = (tipIndex.value + 1) % props.healthTips.length
    }, (props.healthTipRotationSeconds || 10) * 1000)
  }
})
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-neutral-900">Hello, {{ patient.fullName }}</h1>
      <p class="text-sm text-neutral-500 mt-1 font-mono">
        Patient ID: <span class="font-semibold">{{ patient.patientId }}</span>
      </p>
      <p v-if="viewingDependent" class="mt-2 inline-block rounded bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1">
        Viewing dependent record
      </p>
    </div>

    <div v-if="!visitPayload.has_active_visit"
         class="flex items-start gap-3 mb-6 p-4 rounded-xl bg-teal-50 border border-teal-200">
      <div>
        <p class="text-sm font-semibold text-teal-900">Walk-in visit?</p>
        <p class="text-xs text-teal-800 mt-0.5">
          Show your barcode at Registration so staff can scan you in and start your visit.
        </p>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Link href="/portal/appointments"
            class="theme-surface rounded-xl p-4 transition hover:border-neutral-400">
        <template v-if="nextAppointment">
          <p class="text-sm font-bold text-neutral-900 leading-tight truncate">{{ nextAppointment.appointmentType }}</p>
          <p class="text-xs text-neutral-500 mt-1">{{ fmtDate(nextApptDate) }}</p>
        </template>
        <p v-else class="text-sm font-bold text-neutral-400">None scheduled</p>
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mt-2">Next Appointment</p>
      </Link>

      <Link href="/portal/visit-status"
            class="theme-surface rounded-xl p-4 transition hover:border-neutral-400">
        <template v-if="visitPayload.has_active_visit">
          <p class="text-sm font-bold text-neutral-900 leading-tight">{{ visitPayload.stage_label ?? 'In progress' }}</p>
          <p class="text-xs text-neutral-500 mt-1">{{ visitPayload.status_label ?? 'Active visit' }}</p>
        </template>
        <p v-else class="text-sm font-bold text-neutral-400">No active visit</p>
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mt-2">Visit Status</p>
      </Link>

      <Link href="/portal/billing"
            class="theme-surface rounded-xl p-4 transition hover:border-neutral-400">
        <p class="text-2xl font-bold text-neutral-900 leading-none">K {{ money(outstandingBalance) }}</p>
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mt-2">Outstanding Balance</p>
      </Link>

      <Link href="/portal/notifications"
            class="theme-surface rounded-xl p-4 transition hover:border-neutral-400">
        <p class="text-2xl font-bold text-neutral-900 leading-none">{{ unreadNotifications }}</p>
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mt-2">Unread Alerts</p>
      </Link>
    </div>

    <!-- Health tip -->
    <div v-if="currentTip" class="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
      <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{{ currentTip.category }}</p>
      <p class="text-sm font-bold text-emerald-900 mt-1">{{ currentTip.title }}</p>
      <p class="text-sm text-emerald-800 mt-0.5">{{ currentTip.message }}</p>
    </div>

    <!-- Interested doctors -->
    <div v-if="interestedDoctors.length" class="mb-6">
      <h2 class="text-sm font-bold text-neutral-900 mb-3">Doctors you may be interested in</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link v-for="doctor in interestedDoctors" :key="doctor.id" :href="`/portal/doctors/${doctor.id}`"
              class="theme-surface flex items-center gap-3 p-3 rounded-xl hover:border-neutral-400 transition">
          <img v-if="doctor.photo_url" :src="doctor.photo_url" :alt="doctor.name"
               class="w-12 h-12 rounded-lg object-cover" />
          <div v-else class="w-12 h-12 rounded-lg bg-neutral-100" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-neutral-900 truncate">{{ doctor.name }}</p>
            <p v-if="doctor.headline" class="text-xs text-blue-600 truncate">{{ doctor.headline }}</p>
          </div>
        </Link>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent visits -->
      <div class="lg:col-span-2">
        <div class="theme-surface rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h2 class="text-sm font-bold text-neutral-900">Recent visits</h2>
            <Link href="/portal/visits" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">View all</Link>
          </div>
          <div class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <Link v-for="enc in recentEncounters" :key="enc.id" :href="`/portal/visits/${enc.id}`"
                  class="flex items-start justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-neutral-900 truncate">{{ enc.encounterNumber }}</p>
                <p class="text-xs text-neutral-500 mt-0.5">
                  {{ fmtDate(enc.startedAt) }} · {{ enc.visitType || 'Visit' }}
                </p>
              </div>
              <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0 whitespace-nowrap">
                {{ humanizeStage(enc.currentStage) }}
              </span>
            </Link>
            <p v-if="!recentEncounters.length" class="px-4 py-8 text-sm text-neutral-500 text-center">
              No visits recorded yet
            </p>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-6">
        <!-- Barcode -->
        <div class="theme-surface rounded-xl p-4">
          <h2 class="text-sm font-bold text-neutral-900 mb-3">My barcode</h2>
          <div v-if="patient.barcode" class="theme-surface flex flex-col items-center rounded-lg px-6 py-5">
            <p class="text-sm font-semibold text-neutral-900 text-center">{{ patient.fullName }}</p>
            <p class="text-[11px] text-neutral-500 mb-3 text-center">{{ patient.patientId }}</p>
            <p class="mt-2 text-sm font-bold font-mono tracking-[0.2em] text-neutral-900">{{ patient.barcode }}</p>
            <p class="text-xs text-neutral-400 text-center mt-3">Show this barcode at the clinic for faster check-in.</p>
          </div>
          <p v-else class="text-sm text-neutral-500 text-center py-4">No barcode assigned</p>
        </div>

        <!-- Recent lab results -->
        <div class="theme-surface rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h2 class="text-sm font-bold text-neutral-900">Recent lab results</h2>
            <Link href="/portal/lab-results" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">All</Link>
          </div>
          <div class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <div v-for="result in recentLabResults" :key="result.id" class="px-4 py-3">
              <p class="text-sm font-semibold text-neutral-900 truncate">
                {{ result.labRequestItem?.testName ?? 'Lab test' }}
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">
                {{ result.resultValue || result.resultText || '—' }} · {{ fmtDate(result.releasedToPatientAt) }}
              </p>
            </div>
            <p v-if="!recentLabResults.length" class="px-4 py-8 text-sm text-neutral-500 text-center">
              No released labs yet
            </p>
          </div>
        </div>

        <!-- Recent prescriptions -->
        <div class="theme-surface rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h2 class="text-sm font-bold text-neutral-900">Recent prescriptions</h2>
            <Link href="/portal/prescriptions" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">All</Link>
          </div>
          <div class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <div v-for="rx in recentPrescriptions" :key="rx.id" class="px-4 py-3">
              <p class="text-sm font-semibold text-neutral-900 truncate">{{ rx.prescriptionNumber ?? 'Prescription' }}</p>
              <p class="text-xs text-neutral-500 mt-0.5">
                {{ fmtDate(rx.prescribedAt) }}
                <template v-if="rx.pharmacyPrescriptionItems && rx.pharmacyPrescriptionItems.length">
                  · {{ rx.pharmacyPrescriptionItems[0].drugName }}
                </template>
              </p>
            </div>
            <p v-if="!recentPrescriptions.length" class="px-4 py-8 text-sm text-neutral-500 text-center">
              No prescriptions yet
            </p>
          </div>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
