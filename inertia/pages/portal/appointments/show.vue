<script setup lang="ts">
import { computed } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

const props = defineProps<{
  guardian: Record<string, any>
  appointment: Record<string, any>
  encounter: Record<string, any> | null
}>()

const a = computed(() => props.appointment)
const canManage = computed(() => ['pending', 'confirmed'].includes(a.value.status))

function fmtDate(value: string | null, withWeekday = true): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    weekday: withWeekday ? 'short' : undefined,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
function fmtDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(value: string | null): string {
  return value ? value.substring(0, 5) : ''
}

const rescheduleForm = useForm({
  preferred_date: a.value.preferred_date ? String(a.value.preferred_date).substring(0, 10) : '',
  preferred_time: a.value.preferred_time ? fmtTime(a.value.preferred_time) : '',
})
const cancelForm = useForm({ cancellation_reason: '' })
const today = new Date().toISOString().substring(0, 10)

function submitReschedule() {
  rescheduleForm.put(`/portal/appointments/${a.value.id}`)
}
async function submitCancel() {
  if (!(await confirmDialog('Cancel this appointment?'))) return
  cancelForm.post(`/portal/appointments/${a.value.id}/cancel`)
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <Link href="/portal/appointments" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">&larr; All appointments</Link>
      <div class="flex items-center gap-2 flex-wrap mt-2">
        <h1 class="text-2xl font-bold tracking-tight">{{ a.appointment_type }}</h1>
        <span v-if="a.appointment_purpose" class="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{{ a.appointment_purpose }}</span>
        <span class="text-[10px] font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">{{ a.status_label }}</span>
      </div>
      <p class="text-xs text-neutral-500 mt-1.5">Reference #{{ a.id }} · Submitted {{ fmtDate(a.created_at, false) }}</p>
    </div>

    <div v-if="a.status === 'pending'" class="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <p class="text-sm font-semibold text-amber-900">Awaiting hospital confirmation</p>
      <p class="text-xs text-amber-700 mt-1">Your request has been submitted. The hospital will review your preferred slot and notify you when confirmed.</p>
    </div>
    <div v-else-if="a.status === 'confirmed'" class="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
      <p class="text-sm font-semibold text-emerald-900">Appointment confirmed</p>
      <p class="text-sm text-emerald-800 mt-1">{{ fmtDate(a.confirmed_date) }} <span v-if="a.confirmed_time">at {{ fmtTime(a.confirmed_time) }}</span></p>
    </div>
    <div v-else-if="a.status === 'declined'" class="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
      <p class="text-sm font-semibold text-red-900">Request declined</p>
      <p class="text-xs text-red-700 mt-1">{{ a.staff_notes || 'Please contact the hospital or submit a new request with different dates.' }}</p>
    </div>
    <div v-else-if="a.status === 'cancelled'" class="mb-4 p-4 rounded-xl bg-neutral-100 border border-neutral-200">
      <p class="text-sm font-semibold text-neutral-800">Appointment cancelled</p>
      <p v-if="a.cancelled_at" class="text-xs text-neutral-500 mt-1">Cancelled {{ fmtDate(a.cancelled_at, false) }}</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
      <div class="rounded-xl theme-surface p-4">
        <h2 class="text-sm font-semibold mb-3">Schedule</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Preferred date</dt>
            <dd class="font-medium mt-0.5">{{ fmtDate(a.preferred_date) }}<span v-if="a.preferred_time"> · {{ fmtTime(a.preferred_time) }}</span></dd>
          </div>
          <div v-if="a.alternate_date">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Alternate date</dt>
            <dd class="font-medium mt-0.5">{{ fmtDate(a.alternate_date) }}<span v-if="a.alternate_time"> · {{ fmtTime(a.alternate_time) }}</span></dd>
          </div>
          <div v-if="a.confirmed_date">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Confirmed date</dt>
            <dd class="font-semibold text-emerald-700 mt-0.5">{{ fmtDate(a.confirmed_date) }}<span v-if="a.confirmed_time"> · {{ fmtTime(a.confirmed_time) }}</span></dd>
          </div>
          <div v-if="a.confirmedByUser">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Confirmed by</dt>
            <dd class="font-medium mt-0.5">{{ a.confirmedByUser.name }}</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-xl theme-surface p-4">
        <h2 class="text-sm font-semibold mb-3">Details</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Type</dt>
            <dd class="font-medium mt-0.5">{{ a.appointment_type }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Purpose</dt>
            <dd class="font-medium mt-0.5">{{ a.appointment_purpose || '—' }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Preferred provider</dt>
            <dd class="font-medium mt-0.5">
              <template v-if="a.provider_display_name">
                {{ a.provider_display_name }}<span v-if="a.provider_subtitle" class="text-neutral-400 font-normal"> · {{ a.provider_subtitle }}</span>
              </template>
              <span v-else class="text-neutral-400">No preference</span>
            </dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Patient</dt>
            <dd class="font-medium mt-0.5">
              {{ a.patient?.full_name ?? '—' }}
              <span v-if="a.patient?.patient_id" class="text-neutral-400 font-mono font-normal">({{ a.patient.patient_id }})</span>
            </dd>
          </div>
          <div v-if="a.requested_by_patient_id !== a.patient_id && a.requestedByPatient">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Requested by</dt>
            <dd class="font-medium mt-0.5">{{ a.requestedByPatient.full_name }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Submitted on</dt>
            <dd class="font-medium mt-0.5">{{ fmtDateTime(a.created_at) }}</dd>
          </div>
          <div v-if="a.reason" class="sm:col-span-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Reason / details</dt>
            <dd class="font-medium mt-0.5 whitespace-pre-line">{{ a.reason }}</dd>
          </div>
          <div v-if="a.staff_notes && a.status !== 'declined'" class="sm:col-span-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Hospital notes</dt>
            <dd class="font-medium mt-0.5 whitespace-pre-line">{{ a.staff_notes }}</dd>
          </div>
          <div v-if="a.cancellation_reason" class="sm:col-span-2">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Cancellation reason</dt>
            <dd class="font-medium mt-0.5">{{ a.cancellation_reason }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Care journey (linked encounter) -->
    <div v-if="encounter" class="rounded-xl theme-surface p-4 mb-4">
      <h2 class="text-sm font-semibold mb-2">Care journey</h2>
      <p class="text-xs text-neutral-500 mb-4">
        Encounter <span class="font-mono font-semibold">{{ encounter.encounter_number }}</span>
        · {{ encounter.current_stage }} ({{ encounter.current_status }})
        · started {{ fmtDateTime(encounter.started_at) }}
      </p>

      <div v-if="encounter.triageRecords?.length" class="mb-4">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Triage</p>
        <div v-for="t in encounter.triageRecords" :key="t.id" class="text-sm text-neutral-700">
          <span v-if="t.systolic_bp && t.diastolic_bp">BP {{ t.systolic_bp }}/{{ t.diastolic_bp }} mmHg · </span>
          <span v-if="t.pulse">Pulse {{ t.pulse }} bpm · </span>
          <span v-if="t.temperature">Temp {{ t.temperature }} °C</span>
          <p v-if="t.chief_complaint_brief" class="text-xs text-neutral-500">Chief complaint: {{ t.chief_complaint_brief }}</p>
        </div>
      </div>

      <div v-if="encounter.screeningRecords?.length" class="mb-4">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Screening</p>
        <div v-for="s in encounter.screeningRecords" :key="s.id" class="text-sm text-neutral-700 mb-1">
          <p v-if="s.assessment_notes" class="whitespace-pre-line">{{ s.assessment_notes }}</p>
        </div>
      </div>

      <div v-if="encounter.labRequests?.length" class="mb-4">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Lab</p>
        <div v-for="lr in encounter.labRequests" :key="lr.id">
          <div v-for="res in (lr.labResults ?? [])" :key="res.id" class="text-sm text-neutral-700">
            <span class="font-semibold">{{ res.labRequestItem?.test_name ?? 'Test' }}:</span>
            {{ res.result_value || '—' }}
            <span v-if="res.reference_range" class="text-neutral-400">(Ref: {{ res.reference_range }})</span>
          </div>
        </div>
      </div>

      <div v-if="encounter.pharmacyPrescriptions?.length">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Pharmacy</p>
        <div v-for="rx in encounter.pharmacyPrescriptions" :key="rx.id" class="mb-2">
          <p class="text-xs text-neutral-500">{{ rx.prescription_number ?? 'Prescription' }}</p>
          <ul class="text-sm text-neutral-700 list-disc list-inside">
            <li v-for="item in (rx.pharmacyPrescriptionItems ?? [])" :key="item.id">
              {{ item.drug_name }}<span v-if="item.dose"> · {{ item.dose }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Manage -->
    <template v-if="canManage">
      <div class="rounded-xl theme-surface p-4 mb-4">
        <h2 class="text-sm font-semibold mb-3">Reschedule</h2>
        <form @submit.prevent="submitReschedule" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">New preferred date</label>
              <input type="date" v-model="rescheduleForm.preferred_date" required :min="today" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">Preferred time</label>
              <input type="time" v-model="rescheduleForm.preferred_time" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
          </div>
          <ActionButton type="submit" variant="primary" :loading="rescheduleForm.processing" loading-text="Submitting…">Request reschedule</ActionButton>
        </form>
      </div>

      <div class="rounded-xl theme-surface p-4">
        <h2 class="text-sm font-semibold mb-3">Cancel appointment</h2>
        <form @submit.prevent="submitCancel" class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Reason (optional)</label>
            <input type="text" v-model="cancelForm.cancellation_reason" maxlength="500" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
          </div>
          <ActionButton type="submit" variant="danger" :loading="cancelForm.processing" loading-text="Cancelling…">Cancel appointment</ActionButton>
        </form>
      </div>
    </template>
  </PortalLayout>
</template>
