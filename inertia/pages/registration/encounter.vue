<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionLink from '~/components/ui/ActionLink.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'

const props = defineProps<{
  encounter: {
    id: number
    encounter_number: string
    stage: string
    stage_label: string
    status: string
    status_label: string
    visit_type: string | null
    priority: string | null
    started_at: string | null
    patient: {
      id: number
      patient_id: string
      full_name: string
      gender: string | null
      date_of_birth: string | null
      phone_number: string | null
      nrc_number: string | null
    } | null
    registration: {
      was_existing_patient: boolean
      attendant_type: string
      registration_notes: string | null
      registered_at: string | null
    } | null
    can_queue_to_triage: boolean
    is_queued_to_triage: boolean
  }
}>()

const form = useForm({ notes: '' })

function queueToTriage() {
  form.post(`/encounters/${props.encounter.id}/queue/triage`)
}

function priorityLabel(level: string | null): string {
  if (!level) return 'Normal'
  return level.charAt(0).toUpperCase() + level.slice(1)
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/registration" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">Registration</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ encounter.encounter_number }}</span>
    </template>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <div v-if="encounter.patient" class="card">
          <div class="flex items-center gap-3 theme-card-header px-6 py-4">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
              {{ encounter.patient.full_name.charAt(0) }}
            </div>
            <div>
              <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">{{ encounter.patient.full_name }}</h2>
              <p class="text-xs text-neutral-500">{{ encounter.patient.patient_id }}</p>
            </div>
          </div>
          <div class="px-6 py-4">
            <div class="detail-row">
              <span class="detail-label">Gender</span>
              <span class="detail-value">{{ encounter.patient.gender ?? '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date of Birth</span>
              <span class="detail-value">{{ encounter.patient.date_of_birth ?? '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Phone</span>
              <span class="detail-value">{{ encounter.patient.phone_number ?? '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">NRC</span>
              <span class="detail-value">{{ encounter.patient.nrc_number ?? '—' }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center gap-3 theme-card-header px-6 py-4">
            <div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-900 dark:bg-white">
              <svg class="h-4 w-4 text-white dark:text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Encounter</h2>
          </div>
          <div class="px-6 py-4">
            <div class="detail-row">
              <span class="detail-label">Encounter Number</span>
              <span class="detail-value font-mono font-semibold">{{ encounter.encounter_number }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Current Stage</span>
              <span class="detail-value">{{ encounter.stage_label }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status</span>
              <span class="badge" :class="`badge-${encounter.status}`">{{ encounter.status_label }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Visit Type</span>
              <span class="detail-value">{{ encounter.visit_type ?? '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Priority</span>
              <span v-if="encounter.priority && encounter.priority !== 'normal'" class="badge" :class="`badge-${encounter.priority}`">
                {{ priorityLabel(encounter.priority) }}
              </span>
              <span v-else class="detail-value">Normal</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Started At</span>
              <span class="detail-value">{{ encounter.started_at ?? '—' }}</span>
            </div>
            <div v-if="encounter.registration?.registration_notes" class="detail-row">
              <span class="detail-label">Notes</span>
              <span class="detail-value text-neutral-600">{{ encounter.registration.registration_notes }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div v-if="encounter.can_queue_to_triage" class="card overflow-hidden">
          <div class="flex items-center gap-3 theme-card-header px-6 py-4">
            <div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-900 dark:bg-white">
              <svg class="h-4 w-4 text-white dark:text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Queue to Triage</h2>
          </div>
          <div class="p-6">
            <p class="mb-4 text-sm text-neutral-500">Registration is complete. Send this patient to the Triage nurse.</p>
            <label class="field-label">Handover Notes <span class="font-normal text-neutral-500">(optional)</span></label>
            <textarea
              v-model="form.notes"
              rows="3"
              class="field-input"
              placeholder="Any information the triage nurse should know…"
            />
          </div>
          <QueueFooter
            label="Send to Triage"
            aria-label="Send patient to triage queue"
            :loading="form.processing"
            loading-text="Sending…"
            @click="queueToTriage"
          />
        </div>

        <div
          v-if="encounter.is_queued_to_triage"
          class="rounded border border-neutral-300 bg-neutral-100 px-6 py-5 text-sm text-neutral-800 dark:text-neutral-200"
        >
          <div class="mb-1 flex items-center gap-2">
            <svg class="h-4 w-4 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="font-semibold">Queued to Triage</span>
          </div>
          <p class="text-neutral-600 dark:text-neutral-400">This encounter has been sent to the Triage queue and is awaiting a nurse.</p>
        </div>

        <ActionLink href="/registration" class="w-full">
          <template #icon>
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </template>
          Back to Registration Desk
        </ActionLink>
      </div>
    </div>
  </StaffLayout>
</template>

<style scoped>
.detail-row {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e5e5e5;
}
.detail-row:last-child {
  border-bottom: none;
}
.detail-label {
  flex-shrink: 0;
  width: 180px;
  font-size: 12px;
  font-weight: 600;
  color: #525252;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.detail-value {
  font-size: 14px;
  color: #171717;
}
.dark .detail-label {
  color: #a3a3a3;
}
.dark .detail-value {
  color: #f5f5f5;
}
</style>
