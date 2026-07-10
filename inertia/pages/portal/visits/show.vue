<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  encounter: Record<string, any>
  diagnoses: string[]
}>()

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

const triage = computed(() => (props.encounter.triageRecords ?? [])[0] ?? null)
const screeningRecords = computed<any[]>(() => props.encounter.screeningRecords ?? [])
const initialScreening = computed(
  () => screeningRecords.value.find((r) => r.screeningType === 'initial') ?? screeningRecords.value[0] ?? null
)
const reviewScreening = computed(
  () => screeningRecords.value.find((r) => r.screeningType === 'review_after_lab') ?? null
)

// All released lab results across the encounter's lab requests
const labResults = computed<any[]>(() => {
  const out: any[] = []
  for (const req of props.encounter.labRequests ?? []) {
    for (const res of req.labResults ?? []) {
      out.push(res)
    }
  }
  return out
})

const prescriptions = computed<any[]>(() => props.encounter.pharmacyPrescriptions ?? [])

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'triage', label: 'Triage' },
  { id: 'screening', label: 'Screening' },
  { id: 'lab', label: 'Lab Results' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'pharmacy', label: 'Prescriptions' },
]
const activeTab = ref('overview')

function interpChip(interp: string | null | undefined): string {
  const i = String(interp ?? '')
  if (i === 'critical') return 'bg-red-50 text-red-700 border border-red-200'
  if (i === 'abnormal') return 'bg-amber-50 text-amber-700 border border-amber-200'
  if (i === 'normal') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  return 'bg-neutral-50 text-neutral-600 border border-neutral-200'
}

const screeningFields: Array<[string, string]> = [
  ['Complaints', 'complaints'],
  ['History of Illness', 'historyOfPresentingIllness'],
  ['Past Medical History', 'pastMedicalHistory'],
  ['Medication History', 'medicationHistory'],
  ['Allergy History', 'allergyHistory'],
  ['Chronic Conditions', 'chronicConditions'],
  ['Examination', 'physicalExamination'],
  ['Plan', 'plan'],
]
</script>

<template>
  <PortalLayout>
    <Link href="/portal/visits" class="text-sm text-neutral-500 hover:text-neutral-900 mb-4 inline-block">
      ← All visits
    </Link>

    <!-- Hero -->
    <div class="theme-surface rounded-xl p-5 mb-4">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p class="text-lg font-bold text-neutral-900">{{ patient.fullName }}</p>
          <p class="text-xs text-neutral-500 mt-1">
            {{ patient.patientId }} · {{ humanize(patient.gender) }} · {{ fmtDate(patient.dateOfBirth) }}
          </p>
          <div class="flex flex-wrap gap-2 mt-3">
            <span class="text-[11px] font-mono font-semibold px-2 py-1 rounded-full bg-neutral-900 text-white">
              {{ encounter.encounterNumber }}
            </span>
            <span class="text-[11px] font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
              {{ humanize(encounter.visitType || 'Visit') }}
            </span>
            <span class="text-[11px] font-semibold px-2 py-1 rounded-full"
                  :class="encounter.closedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
              {{ encounter.closedAt ? 'Completed' : 'In progress' }}
            </span>
            <span class="text-[11px] font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
              {{ humanize(encounter.currentStage) }}
            </span>
          </div>
        </div>
        <div class="text-right text-xs text-neutral-500">
          <p class="font-semibold text-neutral-700">{{ fmtDate(encounter.startedAt) }}</p>
          <p v-if="encounter.closedAt" class="mt-1 text-emerald-600 font-semibold">
            Closed {{ fmtDate(encounter.closedAt) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-neutral-900 rounded-lg p-1 overflow-x-auto mb-4">
      <button v-for="tb in tabs" :key="tb.id" type="button" @click="activeTab = tb.id"
              class="flex-1 min-w-max px-4 py-2 text-xs font-bold rounded transition"
              :class="activeTab === tb.id ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'">
        {{ tb.label }}
      </button>
    </div>

    <!-- Overview -->
    <div v-show="activeTab === 'overview'" class="theme-surface rounded-xl p-5">
      <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Visit summary</h2>
      <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Visit #</dt><dd class="font-mono mt-0.5">{{ encounter.encounterNumber }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Type</dt><dd class="mt-0.5">{{ humanize(encounter.visitType || 'Visit') }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Status</dt><dd class="mt-0.5">{{ humanize(encounter.currentStatus) }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Stage</dt><dd class="mt-0.5">{{ humanize(encounter.currentStage) }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Started</dt><dd class="mt-0.5">{{ fmtDateTime(encounter.startedAt) }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-400">Closed</dt><dd class="mt-0.5">{{ encounter.closedAt ? fmtDateTime(encounter.closedAt) : 'Still open' }}</dd></div>
      </dl>
    </div>

    <!-- Triage -->
    <div v-show="activeTab === 'triage'" class="theme-surface rounded-xl p-5">
      <template v-if="triage">
        <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Vital signs</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div v-if="triage.systolicBp && triage.diastolicBp" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.systolicBp }}/{{ triage.diastolicBp }}</p><p class="text-[10px] text-neutral-500">mmHg · BP</p>
          </div>
          <div v-if="triage.pulse" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.pulse }}</p><p class="text-[10px] text-neutral-500">bpm · Pulse</p>
          </div>
          <div v-if="triage.temperature" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.temperature }}</p><p class="text-[10px] text-neutral-500">°C · Temp</p>
          </div>
          <div v-if="triage.oxygenSaturation" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.oxygenSaturation }}%</p><p class="text-[10px] text-neutral-500">SpO₂</p>
          </div>
          <div v-if="triage.respiratoryRate" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.respiratoryRate }}</p><p class="text-[10px] text-neutral-500">/min · Resp.</p>
          </div>
          <div v-if="triage.bloodSugar" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.bloodSugar }}</p><p class="text-[10px] text-neutral-500">mmol/L · Sugar</p>
          </div>
          <div v-if="triage.weight" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ triage.weight }}</p><p class="text-[10px] text-neutral-500">kg · Weight</p>
          </div>
          <div v-if="triage.bmi" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
            <p class="text-lg font-bold">{{ Number(triage.bmi).toFixed(1) }}</p><p class="text-[10px] text-neutral-500">kg/m² · BMI</p>
          </div>
        </div>
        <div v-if="triage.chiefComplaintBrief" class="mt-4">
          <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1">Chief complaint</h3>
          <p class="text-sm text-neutral-700">{{ triage.chiefComplaintBrief }}</p>
        </div>
      </template>
      <p v-else class="text-sm text-neutral-500 text-center py-6">No triage record for this visit.</p>
    </div>

    <!-- Screening -->
    <div v-show="activeTab === 'screening'" class="theme-surface rounded-xl p-5">
      <template v-if="initialScreening">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <template v-for="[label, key] in screeningFields" :key="key">
            <div v-if="initialScreening[key]" class="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <p class="text-[10px] font-bold uppercase text-neutral-500 mb-1">{{ label }}</p>
              <p class="text-sm text-neutral-700 whitespace-pre-line">{{ initialScreening[key] }}</p>
            </div>
          </template>
        </div>
      </template>
      <p v-else class="text-sm text-neutral-500 text-center py-6">Screening assessment not yet recorded.</p>
    </div>

    <!-- Lab results -->
    <div v-show="activeTab === 'lab'" class="theme-surface rounded-xl p-5">
      <template v-if="labResults.length">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[10px] uppercase text-neutral-500 border-b border-neutral-200">
              <th class="py-2 pr-3">Test</th><th class="py-2 pr-3">Result</th>
              <th class="py-2 pr-3">Reference</th><th class="py-2">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in labResults" :key="r.id" class="border-b border-neutral-100 last:border-0">
              <td class="py-2 pr-3 font-medium">{{ r.labRequestItem?.testName ?? 'Test' }}</td>
              <td class="py-2 pr-3 font-bold">{{ r.resultValue || r.resultText || '—' }}</td>
              <td class="py-2 pr-3 text-neutral-500">{{ r.referenceRange ?? '—' }}</td>
              <td class="py-2">
                <span v-if="r.interpretation" class="text-[11px] font-semibold px-2 py-0.5 rounded-full" :class="interpChip(r.interpretation)">
                  {{ humanize(r.interpretation) }}
                </span>
                <span v-else class="text-neutral-300">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <p v-else class="text-sm text-neutral-500 text-center py-6">No lab results have been released for this visit.</p>
    </div>

    <!-- Diagnosis -->
    <div v-show="activeTab === 'diagnosis'" class="theme-surface rounded-xl p-5">
      <template v-if="diagnoses.length">
        <ul class="space-y-2">
          <li v-for="(dx, i) in diagnoses" :key="i"
              class="text-base font-semibold text-neutral-900 border-l-4 border-neutral-900 pl-3 py-1">
            {{ dx }}
          </li>
        </ul>
        <div v-if="reviewScreening?.plan" class="mt-4">
          <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1">Treatment plan</h3>
          <p class="text-sm text-neutral-700 whitespace-pre-line">{{ reviewScreening.plan }}</p>
        </div>
      </template>
      <p v-else class="text-sm text-neutral-500 text-center py-6">Final diagnosis not yet available.</p>
    </div>

    <!-- Prescriptions -->
    <div v-show="activeTab === 'pharmacy'" class="space-y-4">
      <template v-if="prescriptions.length">
        <div v-for="rx in prescriptions" :key="rx.id" class="theme-surface rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-700">Prescription — {{ rx.prescriptionNumber }}</h2>
            <span class="text-[11px] text-neutral-400">{{ fmtDate(rx.prescribedAt) }}</span>
          </div>
          <div class="p-4">
            <table v-if="(rx.pharmacyPrescriptionItems ?? []).length" class="w-full text-sm">
              <thead>
                <tr class="text-left text-[10px] uppercase text-neutral-500 border-b border-neutral-200">
                  <th class="py-2 pr-3">Medicine</th><th class="py-2 pr-3">Dose</th>
                  <th class="py-2 pr-3">Frequency</th><th class="py-2 pr-3">Duration</th><th class="py-2">Instructions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in rx.pharmacyPrescriptionItems" :key="item.id" class="border-b border-neutral-100 last:border-0">
                  <td class="py-2 pr-3 font-semibold">
                    {{ item.drugName }}
                    <span v-if="item.strength || item.formulation" class="block text-[10px] font-normal text-neutral-400">
                      {{ [item.strength, item.formulation].filter(Boolean).join(' ') }}
                    </span>
                  </td>
                  <td class="py-2 pr-3">{{ item.dose ?? '—' }}</td>
                  <td class="py-2 pr-3">{{ item.frequency }}<span v-if="item.frequencyUnit"> {{ item.frequencyUnit }}</span></td>
                  <td class="py-2 pr-3">{{ item.duration }}<span v-if="item.durationUnit"> {{ item.durationUnit }}</span></td>
                  <td class="py-2 text-neutral-500 text-xs">{{ item.instructions ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <div v-else class="theme-surface rounded-xl p-6 text-center">
        <p class="text-sm text-neutral-500">No prescriptions were issued for this visit.</p>
      </div>
    </div>
  </PortalLayout>
</template>
