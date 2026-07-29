<script setup lang="ts">
import { watch } from 'vue'
import { useForm } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

const VISIT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Admission', 'Appointment', 'Other']
const PRIORITY_LEVELS = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
]

const props = defineProps<{
  open: boolean
  patientDbId: number
  patientName: string
  isDeceased?: boolean
  status?: string | null
  activeEncounterId?: number | null
}>()

const emit = defineEmits<{
  close: []
}>()

const form = useForm({
  patient_id: props.patientDbId as number | null,
  visit_type: '',
  priority_level: 'normal',
  registration_notes: '',
  confirm_inactive_patient: false,
})

watch(
  () => props.patientDbId,
  (id) => {
    form.patient_id = id
  }
)

function close() {
  form.reset()
  form.patient_id = props.patientDbId
  form.priority_level = 'normal'
  form.confirm_inactive_patient = false
  emit('close')
}

async function submit() {
  if (props.isDeceased) {
    await confirmDialog({
      title: 'Cannot start encounter',
      message: 'This patient is marked as deceased. New encounters cannot be started.',
      confirmLabel: 'OK',
      variant: 'danger',
    })
    return
  }

  if (props.activeEncounterId) {
    await confirmDialog({
      title: 'Active encounter exists',
      message: 'This patient already has an active encounter. Finish or reopen it from registration instead.',
      confirmLabel: 'OK',
      variant: 'warning',
    })
    return
  }

  if (props.status === 'inactive') {
    if (
      !(await confirmDialog({
        title: 'Inactive patient',
        message: 'This patient is inactive. Start an encounter anyway?',
        confirmLabel: 'Start anyway',
        variant: 'warning',
      }))
    ) {
      return
    }
    form.confirm_inactive_patient = true
  }

  form.patient_id = props.patientDbId
  form.post('/encounters/start', {
    onSuccess: () => close(),
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
      @click.self="close"
      @keydown.escape.window="close"
    >
      <div class="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl" @click.stop>
        <div class="flex flex-shrink-0 items-center justify-between theme-card-header px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-900 dark:bg-white">
              <svg class="h-4 w-4 text-white dark:text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
              Start Encounter —
              <span class="text-neutral-600 dark:text-neutral-400">{{ patientName }}</span>
            </h2>
          </div>
          <button type="button" class="text-neutral-400 transition hover:text-neutral-600" @click="close">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <form class="space-y-4 p-5" @submit.prevent="submit">
            <div
              v-if="isDeceased"
              class="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              This patient is marked as <strong>deceased</strong>. New encounters cannot be started.
            </div>
            <div
              v-else-if="activeEncounterId"
              class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
            >
              This patient already has an <strong>active encounter</strong>.
            </div>
            <div
              v-else-if="status === 'inactive'"
              class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
            >
              This patient is <strong>inactive</strong>. You will be asked to confirm before starting.
            </div>

            <div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div class="theme-card-header px-4 py-2.5">
                <h3 class="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                  Encounter Details
                </h3>
              </div>
              <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div>
                  <label class="field-label">Visit Type</label>
                  <select v-model="form.visit_type" class="field-input">
                    <option value="">— Select —</option>
                    <option v-for="visitType in VISIT_TYPES" :key="visitType" :value="visitType">
                      {{ visitType }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="field-label">Priority Level</label>
                  <select v-model="form.priority_level" class="field-input">
                    <option v-for="level in PRIORITY_LEVELS" :key="level.value" :value="level.value">
                      {{ level.label }}
                    </option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="field-label">Registration Notes</label>
                  <textarea
                    v-model="form.registration_notes"
                    rows="3"
                    class="field-input"
                    placeholder="Any relevant notes for this visit…"
                  />
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 border-t border-neutral-100 pt-2 dark:border-neutral-800">
              <ActionButton
                type="submit"
                :loading="form.processing"
                loading-text="Starting…"
                :disabled="!!isDeceased || !!activeEncounterId"
              >
                <template #icon>
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </template>
                Start Encounter
              </ActionButton>
              <button type="button" class="btn-secondary" @click="close">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
