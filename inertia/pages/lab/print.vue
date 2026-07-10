<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import PrintLayout from '~/layouts/PrintLayout.vue'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import {
  formatInterpretationLabel,
  formatLabResultValue,
} from '~/support/lab/lab_result_formatters'
import { formatDateLabel, formatPatientAge } from '~/support/pharmacy/prescription_formatters'

const props = defineProps<{
  facilityName: string
  facilityAddress?: string
  facilityPhone?: string
  facilityEmail?: string
  facilityLogoUrl?: string
  encounter: {
    id: number
    encounter_number: string
    started_at: string | null
    patient: {
      patient_id: string
      full_name: string
      gender: string | null
      date_of_birth: string | null
      phone_number: string | null
      nrc_number: string | null
      allergies: string | null
    } | null
  }
  reviewContext: { final_diagnosis: string | null } | null
  initialScreening: { provisional_diagnosis: string | null } | null
  labRequest: {
    request_number: string
    priority_level: string | null
    status: string
    request_notes: string | null
    requested_by: string | null
    requested_at: string | null
    completed_at: string | null
    items: {
      id: number
      test_name: string
      specimen_type: string | null
      test_group: string | null
      instructions: string | null
      status: string
      result: {
        id: number
        result_value: string | null
        result_text: string | null
        reference_range: string | null
        interpretation: string | null
        remarks: string | null
        result_status: string
        verified_by: { name: string; role: string | null } | null
        verified_at: string | null
      } | null
    }[]
  }
  labTechnician: {
    name: string
    signature_url: string | null
  }
  printedAt: string
}>()

const patientAge = computed(() => formatPatientAge(props.encounter.patient?.date_of_birth ?? null))

const diagnosis = computed(
  () =>
    props.reviewContext?.final_diagnosis ??
    formatDiagnosisLabel(props.initialScreening?.provisional_diagnosis) ??
    null
)

const resultedCount = computed(
  () => props.labRequest.items.filter((item) => item.result !== null).length
)

function printPage() {
  window.print()
}

function stageText(value: string | null | undefined) {
  if (!value) return '—'
  const withSpaces = value.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}
</script>

<template>
  <PrintLayout>
    <div class="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div class="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link
          :href="`/lab/${encounter.id}`"
          class="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back to lab
        </Link>
        <button
          type="button"
          class="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          @click="printPage"
        >
          Print results
        </button>
      </div>

      <div class="print-preview-card rounded-lg border border-neutral-200 p-6">
      <header class="border-b border-neutral-300 pb-4 dark:border-neutral-600">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <img
              v-if="facilityLogoUrl"
              :src="facilityLogoUrl"
              :alt="facilityName"
              class="h-12 w-12 rounded object-contain"
            />
            <div>
              <h1 class="text-xl font-bold tracking-tight">{{ facilityName }}</h1>
              <p class="mt-1 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Laboratory Test Results
              </p>
              <p v-if="facilityAddress" class="mt-1 text-xs text-neutral-600">{{ facilityAddress }}</p>
              <p v-if="facilityPhone || facilityEmail" class="text-xs text-neutral-600">
                <span v-if="facilityPhone">{{ facilityPhone }}</span>
                <span v-if="facilityPhone && facilityEmail"> · </span>
                <span v-if="facilityEmail">{{ facilityEmail }}</span>
              </p>
            </div>
          </div>
          <div class="text-right text-sm">
            <p class="font-mono font-semibold">{{ labRequest.request_number }}</p>
            <p v-if="labRequest.requested_at" class="text-neutral-600">
              Requested {{ labRequest.requested_at }}
            </p>
            <p v-if="labRequest.completed_at" class="text-neutral-600">
              Completed {{ labRequest.completed_at }}
            </p>
          </div>
        </div>
      </header>

      <section class="mt-5 grid gap-4 border-b border-neutral-200 pb-5 text-sm sm:grid-cols-2">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Patient</p>
          <p class="mt-1 text-base font-semibold">{{ encounter.patient?.full_name ?? '—' }}</p>
          <dl class="mt-2 space-y-1 text-neutral-700">
            <div class="flex gap-2">
              <dt class="w-24 text-neutral-500">Patient ID</dt>
              <dd>{{ encounter.patient?.patient_id ?? '—' }}</dd>
            </div>
            <div v-if="encounter.patient?.gender" class="flex gap-2">
              <dt class="w-24 text-neutral-500">Gender</dt>
              <dd>{{ encounter.patient.gender }}</dd>
            </div>
            <div v-if="patientAge || encounter.patient?.date_of_birth" class="flex gap-2">
              <dt class="w-24 text-neutral-500">Age / DOB</dt>
              <dd>
                <span v-if="patientAge">{{ patientAge }}</span>
                <span v-if="patientAge && encounter.patient?.date_of_birth"> · </span>
                <span v-if="encounter.patient?.date_of_birth">
                  {{ formatDateLabel(encounter.patient.date_of_birth) }}
                </span>
              </dd>
            </div>
            <div v-if="encounter.patient?.phone_number" class="flex gap-2">
              <dt class="w-24 text-neutral-500">Phone</dt>
              <dd>{{ encounter.patient.phone_number }}</dd>
            </div>
            <div v-if="encounter.patient?.nrc_number" class="flex gap-2">
              <dt class="w-24 text-neutral-500">NRC</dt>
              <dd>{{ encounter.patient.nrc_number }}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Encounter</p>
          <dl class="mt-2 space-y-1 text-neutral-700">
            <div class="flex gap-2">
              <dt class="w-28 text-neutral-500">Encounter #</dt>
              <dd class="font-mono">{{ encounter.encounter_number }}</dd>
            </div>
            <div v-if="encounter.started_at" class="flex gap-2">
              <dt class="w-28 text-neutral-500">Visit date</dt>
              <dd>{{ encounter.started_at }}</dd>
            </div>
            <div v-if="diagnosis" class="flex gap-2">
              <dt class="w-28 shrink-0 text-neutral-500">Diagnosis</dt>
              <dd class="font-medium">{{ diagnosis }}</dd>
            </div>
            <div v-if="encounter.patient?.allergies" class="flex gap-2">
              <dt class="w-28 shrink-0 text-neutral-500">Allergies</dt>
              <dd class="font-semibold text-red-700">{{ encounter.patient.allergies }}</dd>
            </div>
            <div v-if="labRequest.requested_by" class="flex gap-2">
              <dt class="w-28 text-neutral-500">Requested by</dt>
              <dd>{{ labRequest.requested_by }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-28 text-neutral-500">Priority</dt>
              <dd>{{ stageText(labRequest.priority_level) }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-28 text-neutral-500">Status</dt>
              <dd>{{ stageText(labRequest.status) }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section v-if="labRequest.request_notes" class="mt-5 rounded border border-neutral-200 px-4 py-3 text-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Request notes</p>
        <p class="mt-1 whitespace-pre-line text-neutral-700">{{ labRequest.request_notes }}</p>
      </section>

      <section class="mt-5">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b-2 border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              <th class="px-2 py-2">Test</th>
              <th class="px-2 py-2">Specimen</th>
              <th class="px-2 py-2">Result</th>
              <th class="px-2 py-2">Reference</th>
              <th class="px-2 py-2">Interpretation</th>
              <th class="px-2 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in labRequest.items"
              :key="item.id"
              class="border-b border-neutral-200 align-top"
            >
              <td class="px-2 py-2.5 font-medium">
                {{ item.test_name }}
                <span v-if="item.test_group" class="block text-[10px] font-normal text-neutral-500">
                  {{ item.test_group }}
                </span>
              </td>
              <td class="px-2 py-2.5 text-neutral-700">{{ item.specimen_type ?? '—' }}</td>
              <td class="px-2 py-2.5 whitespace-pre-line text-neutral-800">
                {{ formatLabResultValue(item.result) }}
              </td>
              <td class="px-2 py-2.5 text-neutral-600">
                {{ item.result?.reference_range ?? '—' }}
              </td>
              <td class="px-2 py-2.5 font-medium">
                {{ formatInterpretationLabel(item.result?.interpretation) }}
              </td>
              <td class="px-2 py-2.5 text-neutral-600">
                {{ item.result?.remarks ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer class="mt-10 border-t border-neutral-200 pt-6 text-sm">
        <div class="max-w-sm">
          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Lab technician</p>
          <div class="mt-4 min-h-16">
            <img
              v-if="labTechnician.signature_url"
              :src="labTechnician.signature_url"
              :alt="`${labTechnician.name} signature`"
              class="max-h-16 max-w-xs object-contain"
            />
            <div v-else class="border-t border-neutral-400 pt-1">
              <p class="text-neutral-400">Signature</p>
            </div>
          </div>
          <p class="mt-2 font-medium text-neutral-800">{{ labTechnician.name }}</p>
        </div>
      </footer>

      <p class="mt-6 text-center text-[10px] text-neutral-400 print:mt-4">
        Printed {{ printedAt }} · {{ resultedCount }} of {{ labRequest.items.length }} test(s) resulted
      </p>
      </div>
    </div>
  </PrintLayout>
</template>
