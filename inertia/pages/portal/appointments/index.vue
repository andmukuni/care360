<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface Appointment {
  id: number
  appointment_type: string
  appointment_purpose: string | null
  status: string
  preferred_date: string | null
  preferred_time: string | null
  confirmed_date: string | null
  confirmed_time: string | null
}

const props = defineProps<{
  guardian: Record<string, any>
  patient: Record<string, any>
  appointments: { data: Appointment[]; meta: Record<string, any> }
  upcoming: Appointment[]
  pending: Appointment[]
}>()

const next = computed(() => props.upcoming[0] ?? null)
const totalCount = computed(() => props.appointments.meta?.total ?? props.appointments.data.length)

const defaultTab = props.pending.length ? 'pending' : props.upcoming.length ? 'upcoming' : 'history'
const activeTab = ref<'pending' | 'upcoming' | 'history'>(defaultTab)

function fmtDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(value: string | null): string {
  return value ? value.substring(0, 5) : ''
}
function scheduledDate(a: Appointment): string | null {
  return a.confirmed_date ?? a.preferred_date
}
function scheduledTime(a: Appointment): string | null {
  return a.confirmed_time ?? a.preferred_time
}

const tabs = computed(() => [
  { id: 'pending' as const, label: 'Pending review', count: props.pending.length },
  { id: 'upcoming' as const, label: 'Upcoming', count: props.upcoming.length },
  { id: 'history' as const, label: 'History', count: totalCount.value },
])
</script>

<template>
  <PortalLayout>
    <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Appointments</h1>
        <p class="text-sm text-neutral-500 mt-1">Request, track, and review your hospital appointments.</p>
      </div>
      <Link href="/portal/appointments/create"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition">
        Request new
      </Link>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Link :href="next ? `/portal/appointments/${next.id}` : '/portal/appointments/create'"
            class="relative overflow-hidden theme-surface rounded-xl p-5 hover:border-neutral-300 transition">
        <span class="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden="true"></span>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Next Appointment</p>
        <template v-if="next">
          <p class="text-base font-bold leading-tight truncate mt-3">{{ next.appointment_type }}</p>
          <p class="text-xs text-neutral-500 mt-1">
            {{ fmtDate(scheduledDate(next)) }}
            <span v-if="scheduledTime(next)">· {{ fmtTime(scheduledTime(next)) }}</span>
          </p>
        </template>
        <template v-else>
          <p class="text-base font-bold text-neutral-400 mt-3">None scheduled</p>
          <p class="text-xs text-neutral-400 mt-1">Request a new appointment</p>
        </template>
      </Link>

      <div class="theme-surface rounded-xl p-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Pending Review</p>
        <p class="text-2xl font-bold leading-none mt-3">{{ pending.length }}</p>
        <p class="text-xs text-neutral-500 mt-1.5">Awaiting confirmation</p>
      </div>

      <div class="theme-surface rounded-xl p-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Total Appointments</p>
        <p class="text-2xl font-bold leading-none mt-3">{{ totalCount }}</p>
        <p class="text-xs text-neutral-500 mt-1.5">{{ upcoming.length }} upcoming</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-4" role="tablist">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab"
              @click="activeTab = tab.id"
              :class="['inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition',
                       activeTab === tab.id ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400']">
        {{ tab.label }}
        <span v-if="tab.count > 0" class="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full bg-neutral-100 text-neutral-600">{{ tab.count }}</span>
      </button>
    </div>

    <div v-show="activeTab === 'pending'">
      <div v-if="pending.length" class="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p class="text-sm font-semibold text-amber-900">Awaiting hospital confirmation</p>
        <p class="text-xs text-amber-700 mt-0.5">The hospital will confirm your preferred slot. You will be notified once a decision is made.</p>
      </div>
      <div class="theme-surface rounded-xl divide-y divide-neutral-100">
        <Link v-for="a in pending" :key="a.id" :href="`/portal/appointments/${a.id}`" class="block px-4 py-3 hover:bg-neutral-50">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ a.appointment_type }}</p>
              <p class="text-xs text-neutral-500">{{ fmtDate(a.preferred_date) }} <span v-if="a.preferred_time">· {{ fmtTime(a.preferred_time) }}</span></p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span>
          </div>
        </Link>
        <p v-if="!pending.length" class="px-4 py-8 text-center text-sm text-neutral-500">No pending requests.</p>
      </div>
    </div>

    <div v-show="activeTab === 'upcoming'">
      <div class="theme-surface rounded-xl divide-y divide-neutral-100">
        <Link v-for="a in upcoming" :key="a.id" :href="`/portal/appointments/${a.id}`" class="block px-4 py-3 hover:bg-neutral-50">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ a.appointment_type }}</p>
              <p class="text-xs text-neutral-500">{{ fmtDate(scheduledDate(a)) }} <span v-if="scheduledTime(a)">· {{ fmtTime(scheduledTime(a)) }}</span></p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Confirmed</span>
          </div>
        </Link>
        <p v-if="!upcoming.length" class="px-4 py-8 text-center text-sm text-neutral-500">Nothing upcoming.</p>
      </div>
    </div>

    <div v-show="activeTab === 'history'">
      <div class="theme-surface rounded-xl divide-y divide-neutral-100">
        <Link v-for="a in appointments.data" :key="a.id" :href="`/portal/appointments/${a.id}`" class="block px-4 py-3 hover:bg-neutral-50">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ a.appointment_type }}</p>
              <p class="text-xs text-neutral-500">{{ fmtDate(a.preferred_date) }} <span v-if="a.preferred_time">· {{ fmtTime(a.preferred_time) }}</span></p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">{{ a.status }}</span>
          </div>
        </Link>
        <div v-if="!appointments.data.length" class="px-4 py-10 text-center">
          <p class="text-sm font-semibold">No appointments yet</p>
          <p class="text-xs text-neutral-500 mt-1">Submit a request and the hospital will confirm your slot.</p>
          <Link href="/portal/appointments/create" class="inline-flex mt-4 px-5 py-2.5 text-sm font-semibold bg-neutral-900 text-white rounded-lg">Request appointment</Link>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
