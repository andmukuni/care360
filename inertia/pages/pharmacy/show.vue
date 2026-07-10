<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import AddPrescriptionModal from '~/components/screening/AddPrescriptionModal.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'
import ClinicalSuggestionsBanner from '~/components/clinical/ClinicalSuggestionsBanner.vue'
import PrescriptionSuggestionsPanel from '~/components/clinical/PrescriptionSuggestionsPanel.vue'
import FieldWithSuggestions from '~/components/clinical/FieldWithSuggestions.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { usePrescriptionCart, type PrescriptionCartItem } from '~/composables/usePrescriptionCart'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import {
  formatRxDose,
  formatRxDuration,
  formatRxFrequency,
} from '~/support/pharmacy/prescription_formatters'

type TabId = 'prescription' | 'notes' | 'next'

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
  reviewContext: {
    final_diagnosis: string | null
    assessment_notes: string | null
    plan: string | null
    review_notes: string | null
  } | null
  initialScreening: {
    complaints: string | null
    provisional_diagnosis: string | null
  } | null
  prescription: {
    id: number
    prescription_number: string
    status: string
    notes: string | null
    prescribed_by: string | null
    items: any[]
  } | null
  dispense: {
    id: number
    dispensing_notes: string | null
    counseling_notes: string | null
    items: { id: number; drug_name: string; quantity_dispensed: number; batch_no: string | null }[]
  } | null
  dispensed_item_ids: number[]
  dispenseDraft: {
    dispensing_notes: string | null
    counseling_notes: string | null
    items: { pharmacy_prescription_item_id: number | null; quantity_dispensed: number | null }[]
  } | null
  billingPreview: {
    lines: { description: string; lineTotal: string }[]
    estimatedTotal: string
    has_existing_invoice?: boolean
  } | null
  clinicalSuggestions: {
    fields: Record<string, { id: number; text: string; source?: Record<string, unknown> }[]>
    prescriptions: { id: number; items: Record<string, unknown>[]; source?: Record<string, unknown> }[]
  }
}>()

const activeTab = ref<TabId>('prescription')
const { showQueueHint: showDispenseHint, dismissQueueHint: dismissDispenseHint } = useQueueFooterHint(
  'pharmacy',
  props.encounter.id,
  'dispense'
)
const { showQueueHint: showCloseHint, dismissQueueHint: dismissCloseHint } = useQueueFooterHint(
  'pharmacy',
  props.encounter.id,
  'close'
)

const dispensedItemIdSet = computed(() => new Set(props.dispensed_item_ids ?? []))

function isItemDispensed(itemId: number) {
  return dispensedItemIdSet.value.has(itemId)
}

const pendingPrescriptionItems = computed(() =>
  (props.prescription?.items ?? []).filter((item) => !isItemDispensed(item.id))
)

const canManagePrescription = computed(
  () => props.encounter.can_edit && !!props.prescription && !props.encounter.is_locked
)
const canEditDispenseQty = computed(
  () => canManagePrescription.value && pendingPrescriptionItems.value.length > 0
)
const canEditNotes = computed(() => canManagePrescription.value)
const hasAnyDispensed = computed(() => dispensedItemIdSet.value.size > 0)
const allItemsDispensed = computed(
  () =>
    (props.prescription?.items ?? []).length > 0 && pendingPrescriptionItems.value.length === 0
)
const isDispensed = computed(() => hasAnyDispensed.value)

const prescriptionStatusLabel = computed(() => {
  if (allItemsDispensed.value) return 'Dispensed'
  if (hasAnyDispensed.value) return 'Partially dispensed'
  return props.prescription?.status ?? ''
})

const dispenseInputs = reactive<Record<number, number>>({})
for (const it of props.prescription?.items ?? []) {
  const draftQty = props.dispenseDraft?.items?.find(
    (item) => item.pharmacy_prescription_item_id === it.id
  )?.quantity_dispensed
  dispenseInputs[it.id] = draftQty ?? it.quantity_prescribed ?? 1
}

const dispenseForm = useForm({
  dispensing_notes:
    props.dispense?.dispensing_notes ?? props.dispenseDraft?.dispensing_notes ?? '',
  counseling_notes:
    props.dispense?.counseling_notes ?? props.dispenseDraft?.counseling_notes ?? '',
})

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
    time_per: item.time_per?.trim() || null,
    duration: item.duration !== '' && item.duration != null ? String(item.duration) : null,
    duration_unit: item.duration_unit?.trim() || null,
    quantity_prescribed: quantity != null && !Number.isNaN(quantity) ? quantity : null,
    route: item.route?.trim() || null,
    is_passer_by: item.is_passer_by,
    instructions: item.instructions?.trim() || null,
  }
}

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
  openModal: openRxModal,
  closeModal: closeRxModal,
  closeDrugPopover: closeRxDrugPopover,
  computeQuantity: computeRxQuantity,
  setDrugActiveIdx: setRxDrugActiveIdx,
} = usePrescriptionCart(undefined, {
  isAlreadyRequested: (signature) =>
    (props.prescription?.items ?? []).some(
      (item) =>
        `${item.drug_name}|${item.dose ?? ''}|${item.formulation ?? ''}` === signature
    ) || rxCart.value.some((item) => itemSignature(item) === signature),
})

const { loading: savingMedications, run: runSaveMedications } = useAsyncAction()

function clearRxCart() {
  rxCart.value = []
}

function dismissRxCart() {
  clearRxCart()
}

function saveAddedMedications() {
  if (!rxCart.value.length) return
  runSaveMedications(({ done }) => {
    router.post(
      `/pharmacy/${props.encounter.id}/prescription-items`,
      { items: rxCart.value.map(cartItemToApi) },
      {
        onSuccess: clearRxCart,
        onFinish: done,
      }
    )
  })
}

function addSuggestedPrescriptions(items: PrescriptionCartItem[]) {
  for (const item of items) {
    const sig = itemSignature(item)
    const exists =
      (props.prescription?.items ?? []).some(
        (existing) =>
          `${existing.drug_name}|${existing.dose ?? ''}|${existing.formulation ?? ''}` === sig
      ) || rxCart.value.some((existing) => itemSignature(existing) === sig)
    if (!exists) rxCart.value.push(item)
  }
}

function dispensePayload() {
  const items = pendingPrescriptionItems.value.map((it) => ({
    pharmacy_prescription_item_id: it.id,
    drug_name: it.drug_name,
    quantity_dispensed: dispenseInputs[it.id] ?? 0,
  }))
  return {
    dispensing_notes: dispenseForm.dispensing_notes,
    counseling_notes: dispenseForm.counseling_notes,
    items,
  }
}

const { status: autosaveStatus, indicatorText: autosaveText } = useAutosave({
  url: `/pharmacy/${props.encounter.id}/save-draft`,
  getPayload: dispensePayload,
  enabled: canManagePrescription,
  watchSource: computed(() => ({
    ...dispenseForm.data(),
    dispenseInputs: { ...dispenseInputs },
  })),
})

const { loading: dispensing, run: runDispense } = useAsyncAction()
const { loading: queueingTreatment, run: runQueueTreatment } = useAsyncAction()
const { loading: queueingScreening, run: runQueueScreening } = useAsyncAction()

async function dispense() {
  dismissDispenseHint()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  const items = pendingPrescriptionItems.value.map((it) => ({
    pharmacy_prescription_item_id: it.id,
    drug_name: it.drug_name,
    quantity_dispensed: dispenseInputs[it.id] ?? 0,
  }))
  runDispense(({ done }) => {
    router.post(
      `/pharmacy/${props.encounter.id}/dispense`,
      {
        dispensing_notes: dispenseForm.dispensing_notes,
        counseling_notes: dispenseForm.counseling_notes,
        items,
      },
      { onFinish: done }
    )
  })
}

const closeForm = useForm({ closure_notes: '' })

function close() {
  dismissCloseHint()
  closeForm.post(`/pharmacy/${props.encounter.id}/close`)
}

function queueTreatmentRoom() {
  runQueueTreatment(({ done }) => {
    router.post(`/pharmacy/${props.encounter.id}/queue-treatment-room`, {}, { onFinish: done })
  })
}

function queueScreening() {
  runQueueScreening(({ done }) => {
    router.post(`/pharmacy/${props.encounter.id}/queue-screening`, {}, { onFinish: done })
  })
}

const showDispenseFooter = computed(() => canEditDispenseQty.value)
const showCloseFooter = computed(
  () => props.encounter.can_edit && hasAnyDispensed.value && allItemsDispensed.value
)

const dispenseFooterLabel = computed(() =>
  hasAnyDispensed.value ? 'Dispense remaining' : 'Dispense'
)

const prescribedItemCount = computed(() => props.prescription?.items.length ?? 0)
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/pharmacy/queue" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">
        Pharmacy
      </Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ encounter.encounter_number }}</span>
    </template>

    <template #header>
      <h1 class="text-lg font-semibold">Pharmacy</h1>
    </template>

    <PatientHeader :encounter="encounter" :triage="triage" />

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
    >
      This encounter is locked. Pharmacy edits are restricted until it is reopened.
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="space-y-4 lg:order-2 lg:col-span-3">
        <HandoverNotesCard :handover="handover" />

        <div
          v-if="reviewContext || initialScreening"
          class="theme-surface overflow-hidden rounded-lg shadow-sm"
        >
          <div class="theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              Clinical Context
            </h3>
          </div>
          <div class="space-y-3 px-4 py-3 text-sm">
            <div v-if="reviewContext?.final_diagnosis">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Final Diagnosis</p>
              <p class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                {{ reviewContext.final_diagnosis }}
              </p>
            </div>
            <div v-else-if="formatDiagnosisLabel(initialScreening?.provisional_diagnosis)">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Provisional Diagnosis</p>
              <p class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                {{ formatDiagnosisLabel(initialScreening?.provisional_diagnosis) }}
              </p>
            </div>
            <div v-if="initialScreening?.complaints">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Complaints</p>
              <p class="mt-0.5 text-neutral-700 dark:text-neutral-300">{{ initialScreening.complaints }}</p>
            </div>
            <div v-if="reviewContext?.plan">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Management Plan</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                {{ reviewContext.plan }}
              </p>
            </div>
            <div v-if="reviewContext?.review_notes">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Review Notes</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                {{ reviewContext.review_notes }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="billingPreview"
          class="theme-surface overflow-hidden rounded-lg shadow-sm"
        >
          <div class="theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              Billing Preview
            </h3>
          </div>
          <div class="px-4 py-3 text-sm">
            <ul class="space-y-1">
              <li
                v-for="(line, i) in billingPreview.lines"
                :key="i"
                class="flex justify-between gap-2 border-b border-neutral-100 py-1.5 text-xs"
              >
                <span class="text-neutral-600 dark:text-neutral-400">{{ line.description }}</span>
                <span class="shrink-0 font-medium text-neutral-800 dark:text-neutral-200">{{ line.lineTotal }}</span>
              </li>
            </ul>
            <div class="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold dark:border-neutral-600">
              <span>Total</span>
              <span>{{ billingPreview.estimatedTotal }}</span>
            </div>
            <p v-if="billingPreview.has_existing_invoice" class="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Invoice already issued.
            </p>
          </div>
        </div>
      </div>

      <div class="min-w-0 space-y-4 lg:order-1 lg:col-span-9">
        <div class="theme-surface rounded-lg shadow-sm">
          <div class="stage-tab-nav-sticky stage-tab-nav-sticky--card">
            <div v-if="canManagePrescription" class="mx-6 mt-5 flex justify-end">
              <AutosaveIndicator :status="autosaveStatus" :text="autosaveText" />
            </div>
            <div class="tab-nav mx-6 mb-2" :class="canManagePrescription ? 'mt-2' : 'mt-5'">
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'prescription' ? 'active' : ''"
                @click="activeTab = 'prescription'"
              >
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Prescription
                <span v-if="prescribedItemCount > 0" class="tab-btn__count">{{ prescribedItemCount }}</span>
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'notes' ? 'active' : ''"
                @click="activeTab = 'notes'"
              >
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Dispense Notes
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'next' ? 'active' : ''"
                @click="activeTab = 'next'"
              >
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Next Steps
              </button>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'prescription' ? 'active' : ''">
            <PrescriptionSuggestionsPanel
              v-if="canManagePrescription"
              :suggestions="clinicalSuggestions.prescriptions"
              :disabled="!canManagePrescription"
              @add-items="addSuggestedPrescriptions"
            />

            <div
              v-if="hasAnyDispensed && !allItemsDispensed"
              class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            >
              Some medications are already dispensed. You can add more medications below, then dispense the remaining items before closing.
            </div>

            <div
              v-else-if="allItemsDispensed"
              class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
            >
              All prescribed medications have been dispensed. Add more medications if needed, or close the encounter from <strong>Next Steps</strong>.
            </div>

            <div v-if="rxCart.length" class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-blue-900 dark:text-blue-100">
                  {{ rxCart.length }} medication{{ rxCart.length === 1 ? '' : 's' }} ready to add to the prescription.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <ActionButton
                    variant="outline"
                    class="!bg-white/80 dark:!bg-neutral-900/50"
                    :disabled="savingMedications"
                    @click="dismissRxCart"
                  >
                    Dismiss
                  </ActionButton>
                  <ActionButton
                    variant="blue"
                    :loading="savingMedications"
                    loading-text="Saving…"
                    @click="saveAddedMedications"
                  >
                    Save to prescription
                  </ActionButton>
                </div>
              </div>
            </div>

            <div v-if="prescription" class="section-card !overflow-hidden !p-0 !mb-0">
              <div class="flex flex-wrap items-center justify-between gap-2 theme-card-header px-5 py-3.5">
                <div>
                  <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Prescription</span>
                  <p class="mt-0.5 font-mono text-xs text-neutral-500">
                    {{ prescription.prescription_number }}
                    <span v-if="prescription.prescribed_by"> · {{ prescription.prescribed_by }}</span>
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <ActionButton
                    v-if="canManagePrescription"
                    type="button"
                    class="!rounded !px-3 !py-1.5 text-xs"
                    @click="openRxModal"
                  >
                    <template #icon>
                      <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </template>
                    Add medication
                  </ActionButton>
                  <Link
                    :href="`/pharmacy/${encounter.id}/print`"
                    target="_blank"
                    class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </Link>
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    :class="allItemsDispensed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : hasAnyDispensed ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'"
                  >
                    {{ prescriptionStatusLabel }}
                  </span>
                </div>
              </div>

              <div v-if="prescription.notes" class="theme-card-header px-5 py-3">
                <p class="text-[10px] font-bold uppercase text-neutral-500">Prescription notes</p>
                <p class="mt-1 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                  {{ prescription.notes }}
                </p>
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
                      <th v-if="canEditDispenseQty" class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Dispense</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr
                      v-for="it in prescription.items"
                      :key="it.id"
                      class="bg-blue-50/50 dark:bg-blue-950/20"
                      :class="isItemDispensed(it.id) ? 'opacity-80' : ''"
                    >
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">
                        {{ it.drug_name }}
                        <span
                          v-if="isItemDispensed(it.id)"
                          class="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-800"
                        >
                          Dispensed
                        </span>
                        <span
                          v-if="it.is_passer_by"
                          class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800"
                        >
                          Passer-by
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDose(it) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxFrequency(it) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDuration(it) }}</td>
                      <td class="px-3 py-2.5 text-xs font-semibold text-neutral-700">{{ it.quantity_prescribed ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ it.route ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">
                        {{ [it.start_date, it.end_date].filter(Boolean).join(' → ') || '—' }}
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ it.instructions ?? '—' }}</td>
                      <td v-if="canEditDispenseQty" class="px-3 py-2.5">
                        <input
                          v-if="!isItemDispensed(it.id)"
                          v-model.number="dispenseInputs[it.id]"
                          type="number"
                          min="0"
                          class="field-input w-20 py-1 text-xs"
                        />
                        <span v-else class="text-xs font-semibold text-emerald-700">✓</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-else class="section-card text-center">
              <p class="text-sm text-neutral-500">No prescription on this encounter.</p>
            </div>

            <div v-if="dispense" class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Dispensed Items</span>
              </div>
              <ul class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                <li
                  v-for="it in dispense.items"
                  :key="it.id"
                  class="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ it.drug_name }}</span>
                  <span class="text-xs text-neutral-500">
                    × {{ it.quantity_dispensed }}
                    <span v-if="it.batch_no"> · Batch {{ it.batch_no }}</span>
                  </span>
                </li>
              </ul>
            </div>

            <p v-if="!encounter.can_edit && !encounter.is_locked" class="text-sm text-neutral-500">
              Receive this patient from the queue to begin dispensing.
            </p>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'notes' ? 'active' : ''">
            <ClinicalSuggestionsBanner
              :fields="clinicalSuggestions.fields"
              :disabled="!canEditNotes"
            />

            <div class="section-card space-y-4">
              <div class="section-card-title">Patient counseling &amp; dispensing</div>
              <FieldWithSuggestions
                v-model="dispenseForm.counseling_notes"
                label="Counseling notes"
                :disabled="!canEditNotes"
                :rows="3"
                placeholder="Explain how to take medications, side effects, and follow-up…"
                :suggestions="clinicalSuggestions.fields.review_notes ?? clinicalSuggestions.fields.plan ?? []"
              />
              <FieldWithSuggestions
                v-model="dispenseForm.dispensing_notes"
                label="Dispensing notes"
                :disabled="!canEditNotes"
                :rows="3"
                placeholder="Batch numbers, substitutions, stock notes…"
                :suggestions="clinicalSuggestions.fields.assessment_notes ?? []"
              />
              <p v-if="canEditNotes" class="text-xs text-neutral-500">Notes save automatically while you work.</p>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'next' ? 'active' : ''">
            <div class="section-card space-y-4">
              <div class="section-card-title">Queue to another department</div>
              <p class="-mt-2 text-xs text-neutral-500">
                Send the patient elsewhere before or after dispensing, without closing the encounter.
              </p>
              <div class="grid gap-2 sm:grid-cols-2">
                <ActionButton
                  variant="outline"
                  class="w-full justify-center"
                  :loading="queueingTreatment"
                  loading-text="Queueing…"
                  :disabled="!encounter.can_edit"
                  @click="queueTreatmentRoom"
                >
                  <template #icon>
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </template>
                  Queue to Treatment Room
                </ActionButton>
                <ActionButton
                  variant="outline"
                  class="w-full justify-center"
                  :loading="queueingScreening"
                  loading-text="Queueing…"
                  :disabled="!encounter.can_edit"
                  @click="queueScreening"
                >
                  <template #icon>
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </template>
                  Return to Screening
                </ActionButton>
              </div>
              <ComingSoonWardQueueOptions />
            </div>

            <div v-if="encounter.can_edit" class="section-card space-y-3">
              <div class="section-card-title">Close encounter</div>
              <p class="-mt-2 text-xs text-neutral-500">
                After dispensing, close and lock the encounter. Billing is finalised on close.
              </p>
              <label class="field-label">Closure notes</label>
              <textarea
                v-model="closeForm.closure_notes"
                rows="3"
                class="field-input text-sm"
                placeholder="Optional notes for the record…"
              />
            </div>
          </div>

          <QueueFooter
            v-if="showDispenseFooter"
            :show-hint="showDispenseHint"
            :label="dispenseFooterLabel"
            aria-label="Dispense medications"
            :loading="dispensing"
            loading-text="Dispensing…"
            @click="dispense"
          />
          <QueueFooter
            v-else-if="showCloseFooter"
            :show-hint="showCloseHint"
            label="Close"
            aria-label="Close and lock encounter"
            :loading="closeForm.processing"
            loading-text="Closing…"
            @click="close"
          />
        </div>
      </div>
    </div>
  </StaffLayout>

  <AddPrescriptionModal
    v-if="canManagePrescription"
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
  font-weight: 700;
  color: #171717;
  margin-bottom: 12px;
}
:global(.dark) .section-card-title {
  color: #f5f5f5;
}
</style>
