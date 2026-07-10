<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import PrintLayout from '~/layouts/PrintLayout.vue'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import {
  formatDateLabel,
  formatPatientAge,
  formatRxDose,
  formatRxDuration,
  formatRxFrequency,
} from '~/support/pharmacy/prescription_formatters'

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
  prescription: {
    prescription_number: string
    status: string
    notes: string | null
    prescribed_by: string | null
    prescribed_at: string | null
    items: {
      id: number
      drug_name: string
      strength: string | null
      formulation: string | null
      dose: string | null
      item_per_dose: number | null
      frequency: string | number | null
      frequency_unit: string | null
      time_per: string | null
      duration: string | number | null
      duration_unit: string | null
      start_date: string | null
      end_date: string | null
      quantity_prescribed: number | null
      route: string | null
      is_passer_by: boolean
      instructions: string | null
    }[]
  }
  dispense: {
    items: { drug_name: string; quantity_dispensed: number; batch_no: string | null }[]
  } | null
  pharmacist: {
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

function printPage() {
  window.print()
}
</script>

<template>
  <PrintLayout>
    <div class="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div class="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link
          :href="`/pharmacy/${encounter.id}`"
          class="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back to pharmacy
        </Link>
        <button
          type="button"
          class="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          @click="printPage"
        >
          Print prescription
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
                Prescription
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
            <p class="font-mono font-semibold">{{ prescription.prescription_number }}</p>
            <p v-if="prescription.prescribed_at" class="text-neutral-600">
              {{ formatDateLabel(prescription.prescribed_at) }}
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
            <div v-if="prescription.prescribed_by" class="flex gap-2">
              <dt class="w-28 text-neutral-500">Prescribed by</dt>
              <dd>{{ prescription.prescribed_by }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="mt-5">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b-2 border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              <th class="px-2 py-2">Drug</th>
              <th class="px-2 py-2">Dose</th>
              <th class="px-2 py-2">Frequency</th>
              <th class="px-2 py-2">Duration</th>
              <th class="px-2 py-2">Qty</th>
              <th class="px-2 py-2">Route</th>
              <th class="px-2 py-2">Dates</th>
              <th class="px-2 py-2">Instructions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in prescription.items"
              :key="item.id"
              class="border-b border-neutral-200 align-top"
            >
              <td class="px-2 py-2.5 font-medium">
                {{ item.drug_name }}
                <span
                  v-if="item.is_passer_by"
                  class="ml-1 text-[9px] font-bold uppercase text-amber-700"
                >
                  (Passer-by)
                </span>
              </td>
              <td class="px-2 py-2.5 text-neutral-700">{{ formatRxDose(item) }}</td>
              <td class="px-2 py-2.5 text-neutral-700">{{ formatRxFrequency(item) }}</td>
              <td class="px-2 py-2.5 text-neutral-700">{{ formatRxDuration(item) }}</td>
              <td class="px-2 py-2.5 font-semibold">{{ item.quantity_prescribed ?? '—' }}</td>
              <td class="px-2 py-2.5 text-neutral-700">{{ item.route ?? '—' }}</td>
              <td class="px-2 py-2.5 text-neutral-600">
                {{ [formatDateLabel(item.start_date), formatDateLabel(item.end_date)].filter((d) => d !== '—').join(' → ') || '—' }}
              </td>
              <td class="px-2 py-2.5 text-neutral-600">{{ item.instructions ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="prescription.notes" class="mt-5 rounded border border-neutral-200 px-4 py-3 text-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Prescription notes</p>
        <p class="mt-1 whitespace-pre-line text-neutral-700">{{ prescription.notes }}</p>
      </section>

      <section v-if="dispense?.items.length" class="mt-5 border-t border-neutral-200 pt-4 text-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Dispensed</p>
        <ul class="mt-2 space-y-1">
          <li v-for="(item, index) in dispense.items" :key="index" class="flex justify-between gap-4">
            <span>{{ item.drug_name }}</span>
            <span class="text-neutral-600">
              × {{ item.quantity_dispensed }}
              <span v-if="item.batch_no"> · Batch {{ item.batch_no }}</span>
            </span>
          </li>
        </ul>
      </section>

      <footer class="mt-10 border-t border-neutral-200 pt-6 text-sm">
        <div class="max-w-sm">
          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Pharmacist</p>
          <div class="mt-4 min-h-16">
            <img
              v-if="pharmacist.signature_url"
              :src="pharmacist.signature_url"
              :alt="`${pharmacist.name} signature`"
              class="max-h-16 max-w-xs object-contain"
            />
            <div v-else class="border-t border-neutral-400 pt-1">
              <p class="text-neutral-400">Signature</p>
            </div>
          </div>
          <p class="mt-2 font-medium text-neutral-800">{{ pharmacist.name }}</p>
        </div>
      </footer>

      <p class="mt-6 text-center text-[10px] text-neutral-400 print:mt-4">
        Printed {{ printedAt }} · {{ prescription.status }}
      </p>
      </div>
    </div>
  </PrintLayout>
</template>
