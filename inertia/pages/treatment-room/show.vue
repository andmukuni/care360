<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import TreatmentRoomQueueActionsModal from '~/components/treatment-room/TreatmentRoomQueueActionsModal.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import {
  formatRxDose,
  formatRxDuration,
  formatRxFrequency,
} from '~/support/pharmacy/prescription_formatters'

type TabId = 'treatment' | 'notes'

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
  } | null
  dispense: {
    items: {
      id: number
      drug_name: string
      quantity_dispensed: number
      batch_no: string | null
    }[]
  } | null
  billingPreview: {
    lines: { description: string; lineTotal: string }[]
    estimatedTotal: string
    has_existing_invoice?: boolean
  } | null
  closureNotes: string | null
}>()

const activeTab = ref<TabId>('treatment')
const queueActionsModalOpen = ref(false)
const { showQueueHint, dismissQueueHint } = useQueueFooterHint('treatment-room', props.encounter.id)

const closeForm = useForm({ closure_notes: props.closureNotes ?? '' })
const screeningReviewNotes = ref('')

const canEdit = computed(() => props.encounter.can_edit && !props.encounter.is_locked)
const prescribedItemCount = computed(() => props.prescription?.items.length ?? 0)
const dispensedItemCount = computed(() => props.dispense?.items.length ?? 0)

const { status: autosaveStatus, indicatorText: autosaveText } = useAutosave({
  url: `/treatment-room/${props.encounter.id}/save-draft`,
  getPayload: () => closeForm.data(),
  enabled: canEdit,
  watchSource: computed(() => closeForm.data()),
})

const { loading: queueingScreeningReview, run: runQueueScreeningReview } = useAsyncAction()

function openQueueActionsModal() {
  queueActionsModalOpen.value = true
}

function closeQueueActionsModal() {
  queueActionsModalOpen.value = false
}

async function closeEncounter() {
  dismissQueueHint()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  closeForm.post(`/treatment-room/${props.encounter.id}/close`, {
    onFinish: () => {
      if (!closeForm.hasErrors) {
        closeQueueActionsModal()
      }
    },
  })
}

async function queueScreeningReview() {
  dismissQueueHint()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  runQueueScreeningReview(({ done }) => {
    router.post(
      `/treatment-room/${props.encounter.id}/queue-screening-review`,
      { notes: screeningReviewNotes.value || null },
      {
        onFinish: done,
        onSuccess: () => closeQueueActionsModal(),
      }
    )
  })
}

function routeChipClass(route: string | null | undefined) {
  const normalized = String(route ?? '').toUpperCase()
  if (['IV', 'IV PUSH', 'IV DRIP'].includes(normalized)) return 'route-iv'
  if (normalized === 'IM') return 'route-im'
  if (normalized === 'SC') return 'route-sc'
  return ''
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link
        href="/treatment-room/queue"
        class="transition hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        Treatment Room
      </Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{
        encounter.encounter_number
      }}</span>
    </template>

    <template #header>
      <h1 class="text-lg font-semibold">Treatment Room</h1>
    </template>

    <PatientHeader :encounter="encounter" :triage="triage" />

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
    >
      This encounter is locked. Treatment Room edits are restricted until it is reopened.
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
              <p class="mt-0.5 text-neutral-700 dark:text-neutral-300">
                {{ initialScreening.complaints }}
              </p>
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
                <span class="shrink-0 font-medium text-neutral-800 dark:text-neutral-200">{{
                  line.lineTotal
                }}</span>
              </li>
            </ul>
            <div
              class="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold dark:border-neutral-600"
            >
              <span>Total</span>
              <span>{{ billingPreview.estimatedTotal }}</span>
            </div>
            <p
              v-if="billingPreview.has_existing_invoice"
              class="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              Invoice already issued.
            </p>
          </div>
        </div>
      </div>

      <div class="min-w-0 space-y-4 lg:order-1 lg:col-span-9">
        <div
          class="theme-surface rounded-lg shadow-sm"
        >
          <div class="stage-tab-nav-sticky stage-tab-nav-sticky--card">
            <div v-if="canEdit" class="mx-6 mt-5 flex justify-end">
              <AutosaveIndicator :status="autosaveStatus" :text="autosaveText" />
            </div>
            <div class="tab-nav mx-6 mb-2" :class="canEdit ? 'mt-2' : 'mt-5'">
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'treatment' ? 'active' : ''"
                @click="activeTab = 'treatment'"
              >
                <svg
                  class="tab-btn__icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                Treatment
                <span v-if="prescribedItemCount > 0" class="tab-btn__count">{{
                  prescribedItemCount
                }}</span>
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="activeTab === 'notes' ? 'active' : ''"
                @click="activeTab = 'notes'"
              >
                <svg
                  class="tab-btn__icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Closure Notes
              </button>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'treatment' ? 'active' : ''">
            <div
              class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100"
            >
              Review dispensed medications and administer treatment as indicated. Use the footer to
              choose the next action when finished.
            </div>

            <div v-if="prescription" class="section-card !mb-0 !overflow-hidden !p-0">
              <div
                class="flex flex-wrap items-center justify-between gap-2 theme-card-header px-5 py-3.5"
              >
                <div>
                  <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200"
                    >Prescription</span
                  >
                  <p class="mt-0.5 font-mono text-xs text-neutral-500">
                    {{ prescription.prescription_number }}
                    <span v-if="prescription.prescribed_by"> · {{ prescription.prescribed_by }}</span>
                  </p>
                </div>
                <span
                  class="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
                >
                  {{ prescription.status || 'Active' }}
                </span>
              </div>

              <div
                v-if="prescription.notes"
                class="theme-card-header px-5 py-3"
              >
                <p class="text-[10px] font-bold uppercase text-neutral-500">Prescription notes</p>
                <p class="mt-1 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                  {{ prescription.notes }}
                </p>
              </div>

              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-sky-50 dark:bg-sky-950/30">
                    <tr>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Drug
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Dose
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Frequency
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Duration
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Qty
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Route
                      </th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">
                        Comment
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr
                      v-for="it in prescription.items"
                      :key="it.id"
                      class="bg-sky-50/50 dark:bg-sky-950/20"
                    >
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">
                        {{ it.drug_name }}
                        <span
                          v-if="it.is_passer_by"
                          class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800"
                        >
                          Passer-by
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDose(it) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">
                        {{ formatRxFrequency(it) }}
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">
                        {{ formatRxDuration(it) }}
                      </td>
                      <td class="px-3 py-2.5 text-xs font-semibold text-neutral-700">
                        {{ it.quantity_prescribed ?? '—' }}
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">
                        <span
                          v-if="it.route"
                          class="route-chip"
                          :class="routeChipClass(it.route)"
                        >
                          {{ it.route }}
                        </span>
                        <span v-else>—</span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">
                        {{ it.instructions ?? '—' }}
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
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200"
                    >Dispensed Items</span
                  >
                  <span
                    class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    {{ dispensedItemCount }} item{{ dispensedItemCount === 1 ? '' : 's' }}
                  </span>
                </div>
              </div>
              <ul class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                <li
                  v-for="it in dispense.items"
                  :key="it.id"
                  class="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <span class="font-medium text-neutral-800 dark:text-neutral-200">{{
                    it.drug_name
                  }}</span>
                  <span class="text-xs text-neutral-500">
                    × {{ it.quantity_dispensed }}
                    <span v-if="it.batch_no"> · Batch {{ it.batch_no }}</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'notes' ? 'active' : ''">
            <div class="section-card space-y-3">
              <div class="section-card-title">Closure notes</div>
              <p class="-mt-2 text-xs text-neutral-500">
                Record treatment administration notes or any observations before closing.
              </p>
              <label class="field-label">Notes</label>
              <textarea
                v-model="closeForm.closure_notes"
                rows="5"
                class="field-input text-sm"
                :disabled="!canEdit"
                placeholder="Optional notes for the record…"
              />
              <p v-if="canEdit" class="text-xs text-neutral-500">Notes save automatically while you work.</p>
            </div>
          </div>

          <QueueFooter
            v-if="canEdit"
            :show-hint="showQueueHint"
            aria-label="Choose next action — close encounter or return to queue"
            @click="openQueueActionsModal"
          />
        </div>
      </div>
    </div>

    <TreatmentRoomQueueActionsModal
      v-if="canEdit"
      v-model:show="queueActionsModalOpen"
      v-model:closure-notes="closeForm.closure_notes"
      v-model:screening-review-notes="screeningReviewNotes"
      :close-loading="closeForm.processing"
      :screening-review-loading="queueingScreeningReview"
      @close-encounter="closeEncounter"
      @queue-screening-review="queueScreeningReview"
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
  background: #0ea5e9;
  padding: 0 0.35rem;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
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
.route-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background: #f5f5f5;
  padding: 0.1rem 0.45rem;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #404040;
}
.route-chip.route-iv {
  background: #dbeafe;
  color: #1e40af;
}
.route-chip.route-im {
  background: #ffedd5;
  color: #9a3412;
}
.route-chip.route-sc {
  background: #f3e8ff;
  color: #6b21a8;
}
:global(.dark) .route-chip {
  background: #262626;
  color: #d4d4d4;
}
:global(.dark) .route-chip.route-iv {
  background: #1e3a8a;
  color: #bfdbfe;
}
:global(.dark) .route-chip.route-im {
  background: #7c2d12;
  color: #fed7aa;
}
:global(.dark) .route-chip.route-sc {
  background: #581c87;
  color: #e9d5ff;
}
</style>
