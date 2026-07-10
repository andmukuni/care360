<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface Audit {
  id: number
  actionName: string
  actionStage: string
  actionBy: string | null
  notes: string | null
  createdAt: string | null
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
  confirmedBy: string | null
  staffNotes: string | null
  cancellationReason: string | null
  createdAt: string | null
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
    startedBy: string | null
    audits: Audit[]
  } | null
}

defineProps<{ appointment: Appointment }>()
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Appointment #{{ appointment.id }}</h1>
    </template>

    <div class="mb-4">
      <Link href="/appointments" class="text-sm text-blue-600 hover:underline">← Back to appointments</Link>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-3 text-base font-semibold">Details</h2>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-sand-11">Status</dt><dd class="capitalize">{{ appointment.status }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Type</dt><dd>{{ appointment.appointmentType }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Purpose</dt><dd>{{ appointment.appointmentPurpose ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Reason</dt><dd>{{ appointment.reason ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Preferred</dt><dd>{{ appointment.preferredDate ?? '—' }} {{ appointment.preferredTime }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Alternate</dt><dd>{{ appointment.alternateDate ?? '—' }} {{ appointment.alternateTime }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Confirmed</dt><dd>{{ appointment.confirmedDate ?? '—' }} {{ appointment.confirmedTime }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Provider</dt><dd>{{ appointment.provider ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Requested by</dt><dd>{{ appointment.requestedBy ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Confirmed by</dt><dd>{{ appointment.confirmedBy ?? '—' }}</dd></div>
          <div><dt class="text-sand-11">Staff notes</dt><dd class="whitespace-pre-line">{{ appointment.staffNotes ?? '—' }}</dd></div>
        </dl>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-3 text-base font-semibold">Patient</h2>
        <dl v-if="appointment.patient" class="space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-sand-11">Name</dt><dd>{{ appointment.patient.fullName }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Patient ID</dt><dd>{{ appointment.patient.patientNumber }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Gender</dt><dd>{{ appointment.patient.gender ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">NRC</dt><dd>{{ appointment.patient.nrcNumber ?? '—' }}</dd></div>
          <div class="flex justify-between"><dt class="text-sand-11">Phone</dt><dd>{{ appointment.patient.phoneNumber ?? '—' }}</dd></div>
        </dl>
        <p v-else class="text-sm text-sand-11">No linked patient.</p>

        <template v-if="appointment.encounter">
          <h3 class="mb-2 mt-6 text-sm font-semibold">Encounter {{ appointment.encounter.encounterNumber }}</h3>
          <div class="text-sm">
            <div class="flex justify-between"><span class="text-sand-11">Stage</span><span class="capitalize">{{ appointment.encounter.currentStage }}</span></div>
            <div class="flex justify-between"><span class="text-sand-11">Status</span><span class="capitalize">{{ appointment.encounter.currentStatus }}</span></div>
            <div class="flex justify-between"><span class="text-sand-11">Started by</span><span>{{ appointment.encounter.startedBy ?? '—' }}</span></div>
          </div>
          <ul v-if="appointment.encounter.audits.length" class="mt-3 space-y-1 border-t border-sand-4 pt-3 text-xs text-sand-11">
            <li v-for="a in appointment.encounter.audits" :key="a.id">
              <span class="font-medium text-sand-12">{{ a.actionName }}</span> · {{ a.actionStage }} · {{ a.actionBy ?? 'system' }}
              <span v-if="a.createdAt"> · {{ a.createdAt }}</span>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </StaffLayout>
</template>
