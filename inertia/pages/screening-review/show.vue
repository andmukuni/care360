<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import LabResultsSummaryCard from '~/components/lab/LabResultsSummaryCard.vue'
import LabRequestDetailsCard from '~/components/lab/LabRequestDetailsCard.vue'
import AddPrescriptionModal from '~/components/screening/AddPrescriptionModal.vue'
import ScreeningReviewQueueActionsModal from '~/components/screening-review/ScreeningReviewQueueActionsModal.vue'
import ClinicalSuggestionsBanner from '~/components/clinical/ClinicalSuggestionsBanner.vue'
import FieldWithSuggestions from '~/components/clinical/FieldWithSuggestions.vue'
import PrescriptionSuggestionsPanel from '~/components/clinical/PrescriptionSuggestionsPanel.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { usePrescriptionCart, type PrescriptionCartItem } from '~/composables/usePrescriptionCart'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import DictionarySearchSelect from '~/components/dictionary/DictionarySearchSelect.vue'

type TabId = 'review' | 'prescription'

const props = defineProps<{
  encounter: {
    id: number
    encounter_number: string
    stage: string
    status: string
    priority: string | null
    visit_type: string | null
    started_at: string | null
    is_locked: boolean
    can_edit: boolean
    patient: {
      id: number
      patient_id: string
      full_name: string
      gender: string | null
      date_of_birth: string | null
      phone_number: string | null
      nrc_number: string | null
      allergies: string | null
    } | null
  }
  triage: {
    systolic_bp: number | null
    diastolic_bp: number | null
    pulse: number | null
    temperature: number | null
    oxygen_saturation: number | null
    weight: number | null
    bmi: number | null
    blood_sugar: number | null
    respiratory_rate: number | null
  } | null
  handover: {
    notes: string | null
    queued_by_name: string | null
    queued_at: string | null
  }
  initialScreening: {
    complaints: string | null
    provisional_diagnosis: string | null
    plan: string | null
    treatment_plan: string | null
  } | null
  review: Record<string, any> | null
  labRequest: {
    request_number: string
    status: string
    priority_level: string | null
    request_notes: string | null
    items: {
      id: number
      test_name: string
      test_group: string | null
      specimen_type: string | null
      instructions: string | null
      status: string
      result: {
        result_value: string | null
        result_text: string | null
        reference_range: string | null
        interpretation: string | null
        remarks: string | null
      } | null
    }[]
  } | null
  rxDraft: { items: any[]; prescription_notes: string | null } | null
  clinicalSuggestions: {
    fields: Record<string, { id: number; text: string; source?: Record<string, unknown> }[]>
    prescriptions: { id: number; items: Record<string, unknown>[]; source?: Record<string, unknown> }[]
  }
}>()

const activeTab = ref<TabId>('review')
const queueActionsModalOpen = ref(false)
const treatmentRoomNotes = ref('')
const { showQueueHint, dismissQueueHint } = useQueueFooterHint('screening-review', props.encounter.id)
const { loading: queueingLab, run: runQueueLab } = useAsyncAction()
const { loading: queueingTreatment, run: runQueueTreatment } = useAsyncAction()
const { loading: queueingTriage, run: runQueueTriage } = useAsyncAction()

function draftToCartItem(item: Record<string, unknown>): PrescriptionCartItem {
  return {
    drug_name: String(item.drug_name ?? ''),
    formulation: String(item.formulation ?? ''),
    dose: String(item.dose ?? ''),
    item_per_dose: Number(item.item_per_dose ?? 1) || 1,
    frequency: item.frequency ?? '',
    time_per: String(item.time_per ?? ''),
    frequency_unit: String(item.frequency_unit ?? ''),
    duration: item.duration ?? '',
    duration_unit: String(item.duration_unit ?? ''),
    route: String(item.route ?? ''),
    start_date: String(item.start_date ?? new Date().toISOString().slice(0, 10)),
    end_date: String(item.end_date ?? ''),
    quantity_prescribed: item.quantity_prescribed ?? '',
    is_passer_by: item.is_passer_by === '1' || item.is_passer_by === true ? '1' : '0',
    instructions: String(item.instructions ?? ''),
  }
}

function itemSignature(item: Pick<PrescriptionCartItem, 'drug_name' | 'dose' | 'formulation'>) {
  return `${item.drug_name}|${item.dose}|${item.formulation}`
}

function cartItemToApi(item: PrescriptionCartItem) {
  const quantity = item.quantity_prescribed === '' ? null : Number(item.quantity_prescribed)
  return {
    drug_name: item.drug_name.trim(),
    formulation: item.formulation?.trim() || null,
    dose: item.dose?.trim() || null,
    item_per_dose: item.item_per_dose ? Number(item.item_per_dose) : null,
    frequency: item.frequency !== '' && item.frequency != null ? String(item.frequency) : null,
    frequency_unit: item.frequency_unit?.trim() || null,
    duration: item.duration !== '' && item.duration != null ? String(item.duration) : null,
    duration_unit: item.duration_unit?.trim() || null,
    quantity_prescribed: quantity != null && !Number.isNaN(quantity) ? quantity : null,
    route: item.route?.trim() || null,
    instructions: item.instructions?.trim() || null,
  }
}

function prescriptionItemsForPayload() {
  return rxCart.value
    .filter((item) => item.drug_name.trim())
    .map(cartItemToApi)
}

function formatRxFrequency(item: {
  frequency?: string | number | null
  frequency_unit?: string | null
  time_per?: string | null
}) {
  if (item.frequency_unit) {
    return item.time_per ? `${item.frequency_unit} · ${item.time_per}` : item.frequency_unit
  }
  if (item.frequency) {
    return item.time_per ? `${item.frequency} · ${item.time_per}` : String(item.frequency)
  }
  return '—'
}

function formatRxDuration(item: {
  duration?: string | number | null
  duration_unit?: string | null
}) {
  if (!item.duration) return '—'
  return item.duration_unit ? `${item.duration} ${item.duration_unit}` : String(item.duration)
}

function formatRxDose(item: {
  dose?: string | null
  item_per_dose?: number | null
  formulation?: string | null
  strength?: string | null
}) {
  const parts: string[] = []
  if (item.item_per_dose && item.formulation) {
    parts.push(`${item.item_per_dose} ${item.formulation}`)
  }
  if (item.dose) parts.push(item.dose)
  if (item.strength) parts.push(item.strength)
  return parts.length ? parts.join(' · ') : '—'
}

const form = useForm({
  final_diagnosis: props.review?.final_diagnosis ?? '',
  clinical_findings: props.review?.clinical_findings ?? '',
  physical_examination: props.review?.physical_examination ?? '',
  assessment_notes: props.review?.assessment_notes ?? '',
  plan: props.review?.plan ?? '',
  review_notes: props.review?.review_notes ?? '',
  prescription_notes: props.rxDraft?.prescription_notes ?? '',
  items: [] as any[],
})

const canEdit = computed(() => props.encounter.can_edit && !props.encounter.is_locked)

let triggerAutosave: () => void = () => {}

const {
  cart: rxCart,
  showModal: rxModalOpen,
  form: rxDraft,
  showError: rxFormError,
  errorMsg: rxErrorMsg,
  drugSearch: rxDrugSearch,
  drugResults: rxDrugResults,
  drugLoading: rxDrugLoading,
  drugPopoverOpen: rxDrugPopoverOpen,
  drugActiveIdx: rxDrugActiveIdx,
  selectedDrugUnits: rxSelectedDrugUnits,
  quantityFormulaHint: rxQuantityFormulaHint,
  debouncedDrugSearch,
  searchDrugs: searchRxDrugs,
  selectDrug: selectRxDrug,
  moveDrugActive: moveRxDrugActive,
  pickDrugActive: pickRxDrugActive,
  addToCart: addToRxCart,
  removeFromCart: removeFromRxCart,
  openModal: openRxModal,
  closeModal: closeRxModal,
  closeDrugPopover: closeRxDrugPopover,
  computeQuantity: computeRxQuantity,
  setDrugActiveIdx: setRxDrugActiveIdx,
} = usePrescriptionCart(
  () => triggerAutosave(),
  {
    isAlreadyRequested: (signature) =>
      rxCart.value.some((item) => itemSignature(item) === signature),
  }
)

if (props.rxDraft?.items?.length) {
  for (const item of props.rxDraft.items) {
    if (String(item.drug_name ?? '').trim()) {
      rxCart.value.push(draftToCartItem(item))
    }
  }
}

function reviewPayload() {
  return {
    final_diagnosis: form.final_diagnosis,
    clinical_findings: form.clinical_findings,
    physical_examination: form.physical_examination,
    assessment_notes: form.assessment_notes,
    plan: form.plan,
    review_notes: form.review_notes,
    prescription_notes: form.prescription_notes,
    items: prescriptionItemsForPayload(),
  }
}

const autosaveWatchSource = computed(() => ({
  final_diagnosis: form.final_diagnosis,
  clinical_findings: form.clinical_findings,
  physical_examination: form.physical_examination,
  assessment_notes: form.assessment_notes,
  plan: form.plan,
  review_notes: form.review_notes,
  prescription_notes: form.prescription_notes,
  items: prescriptionItemsForPayload(),
}))

const {
  status: autosaveStatus,
  indicatorText: autosaveText,
  markDirty,
  saveNow,
} = useAutosave({
  url: `/screening-review/${props.encounter.id}/save-draft`,
  getPayload: reviewPayload,
  enabled: canEdit,
  debounceMs: 3000,
  watchSource: autosaveWatchSource,
})

triggerAutosave = markDirty

async function complete() {
  dismissQueueHint()
  form.items = prescriptionItemsForPayload()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  await saveNow()
  form.post(`/screening-review/${props.encounter.id}/complete`)
}

function openQueueActionsModal() {
  queueActionsModalOpen.value = true
}

function closeQueueActionsModal() {
  queueActionsModalOpen.value = false
}

async function queueLab() {
  dismissQueueHint()
  form.items = prescriptionItemsForPayload()
  if (!(await flushAutosavesBeforeAction())) return
  runQueueLab(({ done }) => {
    router.post(
      `/screening-review/${props.encounter.id}/queue-lab`,
      {},
      { onFinish: done }
    )
  })
}

async function queueTreatmentRoom() {
  dismissQueueHint()
  form.items = prescriptionItemsForPayload()
  if (!(await flushAutosavesBeforeAction())) return
  runQueueTreatment(({ done }) => {
    router.post(
      `/screening-review/${props.encounter.id}/queue-treatment-room`,
      { notes: treatmentRoomNotes.value || null },
      { onFinish: done }
    )
  })
}

async function queueTriage() {
  dismissQueueHint()
  form.items = prescriptionItemsForPayload()
  if (!(await flushAutosavesBeforeAction())) return
  runQueueTriage(({ done }) => {
    router.post(
      `/screening-review/${props.encounter.id}/queue-triage`,
      {},
      { onFinish: done }
    )
  })
}

function onSuggestionApplied() {
  markDirty()
}

function addSuggestedPrescriptions(items: PrescriptionCartItem[]) {
  for (const item of items) {
    if (!item.drug_name.trim()) continue
    const sig = itemSignature(item)
    if (rxCart.value.some((existing) => itemSignature(existing) === sig)) continue
    rxCart.value.push(item)
  }
  markDirty()
}

function applyAllClinicalSuggestions(updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (key in form) {
      ;(form as any)[key] = value
    }
  }
  markDirty()
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Screening Review</h1>
    </template>

    <PatientHeader :encounter="encounter" :triage="triage" />

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
    >
      This encounter is locked. Review edits are restricted until it is reopened.
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="space-y-4 lg:order-2 lg:col-span-3">
        <HandoverNotesCard :handover="handover" />

        <div
          v-if="initialScreening"
          class="theme-surface overflow-hidden rounded-lg shadow-sm"
        >
          <div class="theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              Screening Context
            </h3>
          </div>
          <div class="space-y-3 px-4 py-3 text-sm">
            <div v-if="initialScreening.complaints">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Complaints</p>
              <p class="mt-0.5 text-neutral-700 dark:text-neutral-300">{{ initialScreening.complaints }}</p>
            </div>
            <div v-if="formatDiagnosisLabel(initialScreening.provisional_diagnosis)">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Provisional Diagnosis</p>
              <p class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                {{ formatDiagnosisLabel(initialScreening.provisional_diagnosis) }}
              </p>
            </div>
            <div v-if="initialScreening.treatment_plan">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Treatment Plan</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                {{ initialScreening.treatment_plan }}
              </p>
            </div>
            <div v-if="initialScreening.plan">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Management Plan</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                {{ initialScreening.plan }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="labRequest"
          class="theme-surface overflow-hidden rounded-lg shadow-sm"
        >
          <div class="theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              Lab Request
            </h3>
          </div>
          <div class="space-y-3 px-4 py-3 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase text-neutral-500">Request</p>
              <p class="mt-0.5 font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {{ labRequest.request_number }}
              </p>
            </div>
            <div v-if="labRequest.items.length">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Tests Ordered</p>
              <ul class="mt-1 space-y-1">
                <li
                  v-for="item in labRequest.items"
                  :key="item.id"
                  class="flex items-start gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
                >
                  <span class="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-neutral-400" />
                  <span>
                    {{ item.test_name }}
                    <span v-if="item.test_group" class="text-neutral-400">({{ item.test_group }})</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="min-w-0 space-y-4 lg:order-1 lg:col-span-9">
        <LabResultsSummaryCard
          v-if="labRequest"
          :request-number="labRequest.request_number"
          :items="labRequest.items"
        />

        <form
          class="theme-surface rounded-lg shadow-sm"
          @submit.prevent="openQueueActionsModal"
        >
          <div class="stage-tab-nav-sticky stage-tab-nav-sticky--card">
            <div v-if="canEdit" class="mx-6 mt-5 flex justify-end">
              <AutosaveIndicator :status="autosaveStatus" :text="autosaveText" />
            </div>
            <div class="tab-nav mx-6 mb-2" :class="canEdit ? 'mt-2' : 'mt-5'">
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'review' ? 'active' : ''"
                @click="activeTab = 'review'"
              >
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                Clinical Review
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'prescription' ? 'active' : ''"
                @click="activeTab = 'prescription'"
              >
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                Prescription
                <span v-if="rxCart.length > 0" class="tab-btn__count">{{ rxCart.length }}</span>
              </button>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'review' ? 'active' : ''">
            <LabRequestDetailsCard
              v-if="labRequest"
              :priority="labRequest.priority_level ?? 'normal'"
              :notes="labRequest.request_notes ?? ''"
              :request-number="labRequest.request_number"
              :status="labRequest.status"
            />

            <ClinicalSuggestionsBanner
              :fields="clinicalSuggestions.fields"
              :disabled="!canEdit"
            >
              <template #apply-all="{ applyAll }">
                <ActionButton
                  type="button"
                  class="!rounded !px-3 !py-1.5 text-xs"
                  @click="applyAllClinicalSuggestions(applyAll(form))"
                >
                  Apply all clinical
                </ActionButton>
              </template>
            </ClinicalSuggestionsBanner>

            <div class="section-card">
              <div class="section-card-title">Post-lab clinical review</div>
              <div class="space-y-4">
                <div>
                  <label class="mb-1 flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    Final diagnosis
                    <span class="text-red-500">*</span>
                  </label>
                  <DictionarySearchSelect
                    v-model="form.final_diagnosis"
                    domain="diagnosis"
                    placeholder="Search medical library or type final diagnosis…"
                    :disabled="!canEdit"
                  />
                  <FieldWithSuggestions
                    v-if="(clinicalSuggestions.fields.final_diagnosis ?? []).length"
                    v-model="form.final_diagnosis"
                    label=""
                    :disabled="!canEdit"
                    :rows="2"
                    placeholder=""
                    :suggestions="clinicalSuggestions.fields.final_diagnosis ?? []"
                    :error="form.errors.final_diagnosis"
                    class="mt-2"
                    @applied="onSuggestionApplied"
                  />
                  <p v-else-if="form.errors.final_diagnosis" class="mt-1 text-xs text-red-600">
                    {{ form.errors.final_diagnosis }}
                  </p>
                </div>

                <FieldWithSuggestions
                  v-for="field in [
                    { k: 'clinical_findings', l: 'Clinical findings' },
                    { k: 'physical_examination', l: 'Physical examination' },
                    { k: 'assessment_notes', l: 'Assessment notes' },
                    { k: 'plan', l: 'Plan' },
                    { k: 'review_notes', l: 'Review notes' },
                  ]"
                  :key="field.k"
                  v-model="(form as any)[field.k]"
                  :label="field.l"
                  :disabled="!canEdit"
                  :rows="2"
                  :suggestions="clinicalSuggestions.fields[field.k] ?? []"
                  @applied="onSuggestionApplied"
                />
              </div>
            </div>

            <p v-if="!canEdit" class="text-sm text-neutral-500">
              Receive this patient to complete the review.
            </p>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'prescription' ? 'active' : ''">
            <PrescriptionSuggestionsPanel
              :suggestions="clinicalSuggestions.prescriptions"
              :disabled="!canEdit"
              @add-items="addSuggestedPrescriptions"
            />

            <div class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header flex items-center justify-between px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Prescription Requests</span>
                <ActionButton v-if="canEdit" type="button" class="!rounded !px-4 !py-2 text-sm" @click="openRxModal">
                  <template #icon>
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </template>
                  Add Prescription Request
                </ActionButton>
              </div>

              <div class="theme-card-header px-5 py-3">
                <label class="field-label">Prescription notes</label>
                <textarea
                  v-model="form.prescription_notes"
                  :disabled="!canEdit"
                  rows="2"
                  class="field-input text-sm"
                  placeholder="Optional notes for pharmacy"
                />
              </div>

              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-blue-50 dark:bg-blue-950/30">
                    <tr>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Drug</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Dose</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Frequency</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Duration</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Qty</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Route</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Dates</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Comment</th>
                      <th class="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr
                      v-for="(item, idx) in rxCart"
                      :key="`cart-${idx}`"
                      class="bg-blue-50/50 dark:bg-blue-950/20"
                    >
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">
                        {{ item.drug_name }}
                        <span
                          v-if="item.is_passer_by === '1'"
                          class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800"
                        >
                          Passer-by
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDose(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxFrequency(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDuration(item) }}</td>
                      <td class="px-3 py-2.5 text-xs font-semibold text-neutral-700">
                        {{ item.quantity_prescribed || '—' }}
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.route || '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">
                        {{ [item.start_date, item.end_date].filter(Boolean).join(' → ') || '—' }}
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions || '—' }}</td>
                      <td class="px-2 py-2.5 text-center">
                        <button
                          v-if="canEdit"
                          type="button"
                          class="text-red-500 hover:text-red-700"
                          @click="removeFromRxCart(idx)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    <tr v-if="!rxCart.length">
                      <td colspan="9" class="px-4 py-8 text-center text-sm text-neutral-400">
                        No prescription requests yet.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <QueueFooter
            v-if="canEdit"
            :show-hint="showQueueHint"
            aria-label="Queue patient — choose next destination"
            :loading="form.processing || queueingLab || queueingTreatment || queueingTriage"
            loading-text="Processing…"
            @click="openQueueActionsModal"
          />
        </form>
      </div>
    </div>

    <div class="mt-4">
      <Link
        href="/screening-review/queue"
        class="text-sm text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Back to queue
      </Link>
    </div>

    <ScreeningReviewQueueActionsModal
      v-if="canEdit"
      v-model:show="queueActionsModalOpen"
      v-model:treatment-notes="treatmentRoomNotes"
      :complete-loading="form.processing"
      :lab-loading="queueingLab"
      :treatment-loading="queueingTreatment"
      :triage-loading="queueingTriage"
      @complete="complete"
      @queue-lab="queueLab"
      @queue-treatment="queueTreatmentRoom"
      @queue-triage="queueTriage"
    />

    <AddPrescriptionModal
      v-if="canEdit"
      v-model:show="rxModalOpen"
      v-model:drug-search="rxDrugSearch"
      :form="rxDraft"
      :drug-results="rxDrugResults"
      :drug-loading="rxDrugLoading"
      :drug-popover-open="rxDrugPopoverOpen"
      :drug-active-idx="rxDrugActiveIdx"
      :selected-drug-units="rxSelectedDrugUnits"
      :show-error="rxFormError"
      :error-msg="rxErrorMsg"
      :quantity-formula-hint="rxQuantityFormulaHint"
      @update:form="(v) => Object.assign(rxDraft, v)"
      @drug-input="debouncedDrugSearch"
      @drug-focus="() => { if (!rxDrugResults.length) searchRxDrugs() }"
      @select-drug="selectRxDrug"
      @move-drug-active="moveRxDrugActive"
      @pick-drug-active="pickRxDrugActive"
      @set-drug-active-idx="setRxDrugActiveIdx"
      @close-drug-popover="closeRxDrugPopover"
      @compute-quantity="computeRxQuantity"
      @add-to-cart="addToRxCart"
      @close="closeRxModal"
    />
  </StaffLayout>
</template>

<style scoped>
.tab-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #171717;
  border-radius: 4px;
  padding: 4px;
  overflow-x: auto;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #a3a3a3;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  background: none;
  border: none;
  transition: all 0.2s;
}
.tab-btn__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.8;
}
.tab-btn:hover {
  color: #d4d4d4;
}
.tab-btn.active {
  background: #404040;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.tab-btn.active .tab-btn__icon {
  opacity: 1;
}
.tab-btn__count {
  display: inline-flex;
  min-width: 1.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #f59e0b;
  padding: 0 0.35rem;
  font-size: 10px;
  font-weight: 700;
  color: #171717;
}
.tab-panel {
  display: none;
}
.tab-panel.active {
  display: block;
}
.section-card {
  background: #fafafa;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
}
:global(.dark) .section-card {
  background: #171717;
  border-color: #404040;
}
.section-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #171717;
  margin-bottom: 12px;
}
:global(.dark) .section-card-title {
  color: #e5e5e5;
}
</style>
