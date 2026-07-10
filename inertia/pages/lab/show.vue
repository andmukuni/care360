<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import ActionLink from '~/components/ui/ActionLink.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import LabRequestDetailsCard from '~/components/lab/LabRequestDetailsCard.vue'
import LabResultFormEntry from '~/components/lab/LabResultFormEntry.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import ComingSoonWardQueueOptions from '~/components/queue/ComingSoonWardQueueOptions.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import {
  initializeFormStateForTest,
  serializeLabResultFormState,
  type LabResultFormMaps,
  type LabResultFormState,
} from '~/support/lab/lab_result_forms'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import { labItemStatusBadge } from '~/support/lab/lab_result_badges'

type TabId = 'request' | 'results' | 'samples'

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
  screening: {
    complaints: string | null
    provisional_diagnosis: string | null
    plan: string | null
    treatment_plan: string | null
  } | null
  labRequest: {
    id: number
    request_number: string
    priority_level: string | null
    status: string
    request_notes: string | null
    items: {
      id: number
      test_name: string
      specimen_type: string | null
      test_group: string | null
      instructions: string | null
      status: string
      form_key: string
      form_type: string
      form_label: string | null
      result: {
        id: number
        result_value: string | null
        result_text: string | null
        reference_range: string | null
        interpretation: string | null
        remarks: string | null
      } | null
    }[]
    samples: {
      id: number
      sample_type: string
      sample_label: string | null
      collected_at: string | null
    }[]
  } | null
  labResultForms: LabResultFormMaps
  specimenCatalog: { id: number; label: string; name: string; category: string | null }[]
}>()

const activeTab = ref<TabId>('results')
const { showQueueHint, dismissQueueHint } = useQueueFooterHint('lab', props.encounter.id)
const { loading: savingResults, run: runSaveResults } = useAsyncAction()
const { loading: completing, run: runComplete } = useAsyncAction()

const canEdit = computed(() => props.encounter.can_edit && !props.encounter.is_locked)

const formStates = reactive<Record<number, LabResultFormState>>({})
for (const item of props.labRequest?.items ?? []) {
  formStates[item.id] = initializeFormStateForTest(item.test_name, props.labResultForms, item.result)
}

function serializedResultForItem(itemId: number) {
  const state = formStates[itemId]
  if (!state) return null
  return serializeLabResultFormState(state, props.labResultForms)
}

function buildResultsPayload() {
  const results = (props.labRequest?.items ?? [])
    .map((item) => {
      const serialized = serializedResultForItem(item.id)
      if (!serialized) return null
      return { lab_request_item_id: item.id, ...serialized }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
  if (!results.length) return null
  return { results }
}

const { status: autosaveStatus, indicatorText: autosaveText, saveNow } = useAutosave({
  url: `/lab/${props.encounter.id}/results`,
  getPayload: buildResultsPayload,
  enabled: computed(() => canEdit.value && activeTab.value === 'results'),
  debounceMs: 3000,
  watchSource: computed(() => ({ ...formStates })),
})

function saveResults() {
  if (!buildResultsPayload()) return
  runSaveResults(async ({ done }) => {
    await saveNow()
    done()
  })
}

async function complete() {
  dismissQueueHint()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  const results = (props.labRequest?.items ?? [])
    .map((item) => {
      const serialized = serializedResultForItem(item.id)
      if (!serialized) return null
      return { lab_request_item_id: item.id, ...serialized }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
  runComplete(({ done }) => {
    router.post(`/lab/${props.encounter.id}/complete`, { results }, { onFinish: done })
  })
}

const sample = useForm({
  samples: [
    {
      sample_type: '',
      lab_specimen_type_id: null as number | null,
      sample_label: '',
      collection_notes: '',
    },
  ],
})

function addSample() {
  sample.post(`/lab/${props.encounter.id}/samples`, { onSuccess: () => sample.reset() })
}

function stageText(value: string | null | undefined) {
  if (!value) return '—'
  const withSpaces = value.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}


function itemStatusBadge(item: (typeof props.labRequest)['items'][number]) {
  return labItemStatusBadge(
    item.status,
    formStates[item.id]?.interp || item.result?.interpretation || null
  )
}

function resultRowClass(interpretation: string | null | undefined) {
  if (interpretation === 'critical') return 'lab-result-card--critical'
  if (interpretation === 'abnormal') return 'lab-result-card--abnormal'
  return ''
}

function itemHasResult(itemId: number) {
  return serializedResultForItem(itemId) !== null
}

const pendingResultCount = computed(
  () => (props.labRequest?.items ?? []).filter((item) => !itemHasResult(item.id)).length
)
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Lab</h1>
    </template>

    <PatientHeader :encounter="encounter" :triage="triage" />

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
    >
      This encounter is locked. Lab edits are restricted until it is reopened.
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="space-y-4 lg:col-span-3 lg:order-2">
        <HandoverNotesCard :handover="handover" />

        <div
          v-if="screening"
          class="theme-surface overflow-hidden rounded-lg shadow-sm"
        >
          <div class="theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              Screening Context
            </h3>
          </div>
          <div class="space-y-3 px-4 py-3 text-sm">
            <div v-if="screening.complaints">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Complaints</p>
              <p class="mt-0.5 text-neutral-700 dark:text-neutral-300">{{ screening.complaints }}</p>
            </div>
            <div v-if="formatDiagnosisLabel(screening.provisional_diagnosis)">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Provisional Diagnosis</p>
              <p class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                {{ formatDiagnosisLabel(screening.provisional_diagnosis) }}
              </p>
            </div>
            <div v-if="screening.treatment_plan">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Treatment Plan</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                {{ screening.treatment_plan }}
              </p>
            </div>
            <div v-if="screening.plan">
              <p class="text-[10px] font-bold uppercase text-neutral-500">Management Plan</p>
              <p class="mt-0.5 whitespace-pre-line text-neutral-700 dark:text-neutral-300">{{ screening.plan }}</p>
            </div>
            <p
              v-if="
                !screening.complaints &&
                !formatDiagnosisLabel(screening.provisional_diagnosis) &&
                !screening.treatment_plan &&
                !screening.plan
              "
              class="text-sm italic text-neutral-400"
            >
              No screening context recorded.
            </p>
          </div>
        </div>
      </div>

      <div class="lg:col-span-9 lg:order-1">
        <form
          v-if="labRequest"
          class="theme-surface rounded-lg shadow-sm"
          @submit.prevent="complete"
        >
          <div class="stage-tab-nav-sticky stage-tab-nav-sticky--card">
            <div v-if="canEdit && activeTab === 'results'" class="mx-6 mt-5 flex justify-end">
              <AutosaveIndicator :status="autosaveStatus" :text="autosaveText" />
            </div>
            <div class="tab-nav mx-6 mb-2" :class="canEdit && activeTab === 'results' ? 'mt-2' : 'mt-5'">
              <button type="button" class="tab-btn" :class="activeTab === 'request' ? 'active' : ''" @click="activeTab = 'request'">
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Request
              </button>
              <button type="button" class="tab-btn" :class="activeTab === 'results' ? 'active' : ''" @click="activeTab = 'results'">
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Results
                <span v-if="pendingResultCount > 0" class="tab-btn__count">{{ pendingResultCount }}</span>
              </button>
              <button type="button" class="tab-btn" :class="activeTab === 'samples' ? 'active' : ''" @click="activeTab = 'samples'">
                <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Samples
              </button>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'request' ? 'active' : ''">
            <LabRequestDetailsCard
              :priority="labRequest.priority_level ?? 'normal'"
              :notes="labRequest.request_notes ?? ''"
              :request-number="labRequest.request_number"
              :status="labRequest.status"
            />

            <div class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header flex items-center justify-between px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Ordered Tests</span>
                <ActionLink
                  v-if="canEdit"
                  :href="`/lab/${encounter.id}/add-tests`"
                  variant="primary"
                  class="!rounded !px-4 !py-2 text-sm"
                >
                  <template #icon>
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </template>
                  Add Test
                </ActionLink>
              </div>
              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-cyan-50 dark:bg-cyan-950/30">
                    <tr>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Test</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Group</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Specimen</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Instructions</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr
                      v-for="item in labRequest.items"
                      :key="item.id"
                      class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">{{ item.test_name }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.test_group ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.specimen_type ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions?.trim() || '—' }}</td>
                      <td class="px-3 py-2.5 text-xs">
                        <span class="badge b-gray">{{ stageText(item.status) }}</span>
                      </td>
                    </tr>
                    <tr v-if="!labRequest.items.length">
                      <td colspan="5" class="px-4 py-8 text-center text-sm text-neutral-400">No tests ordered.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'results' ? 'active' : ''">
            <div class="section-card !overflow-hidden !p-0">
              <div class="flex flex-wrap items-center justify-between gap-2 theme-card-header px-5 py-3.5">
                <div>
                  <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Record Results</span>
                  <p class="mt-0.5 text-xs text-neutral-500">
                    Each test uses its assigned result form (quantitative, panel, rapid test, or custom)
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Link
                    :href="`/lab/${encounter.id}/print`"
                    target="_blank"
                    class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </Link>
                  <ActionButton
                    v-if="canEdit"
                    type="button"
                    variant="outline"
                    class="!rounded !px-3 !py-1.5 text-xs"
                    :loading="savingResults"
                    loading-text="Saving…"
                    @click="saveResults"
                  >
                    Save results
                  </ActionButton>
                </div>
              </div>

              <div class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                <div
                  v-for="item in labRequest.items"
                  :key="item.id"
                  class="px-5 py-4"
                  :class="resultRowClass(formStates[item.id]?.interp || item.result?.interpretation)"
                >
                  <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="text-sm font-semibold text-neutral-900 dark:text-white">{{ item.test_name }}</div>
                      <div class="mt-0.5 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                        <span v-if="item.specimen_type">{{ item.specimen_type }}</span>
                        <span v-if="item.test_group">· {{ item.test_group }}</span>
                        <span v-if="item.instructions?.trim()">· {{ item.instructions }}</span>
                      </div>
                    </div>
                    <span
                      v-if="itemStatusBadge(item)"
                      class="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      :style="{
                        background: itemStatusBadge(item)!.bg,
                        color: itemStatusBadge(item)!.color,
                      }"
                    >
                      {{ itemStatusBadge(item)!.label }}
                    </span>
                  </div>

                  <LabResultFormEntry
                    v-model="formStates[item.id]"
                    :maps="labResultForms"
                    :test-name="item.test_name"
                    :form-label="item.form_label"
                    :disabled="!canEdit"
                  />
                </div>

                <div v-if="!labRequest.items.length" class="px-4 py-8 text-center text-sm text-neutral-400">
                  No tests to result.
                </div>
              </div>
            </div>
          </div>

          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'samples' ? 'active' : ''">
            <div class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Collected Samples</span>
              </div>
              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-cyan-50 dark:bg-cyan-950/30">
                    <tr>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Sample Type</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Label</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Collected At</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr v-for="sampleRow in labRequest.samples" :key="sampleRow.id">
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">{{ sampleRow.sample_type }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ sampleRow.sample_label ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ sampleRow.collected_at ?? '—' }}</td>
                    </tr>
                    <tr v-if="!labRequest.samples.length">
                      <td colspan="3" class="px-4 py-8 text-center text-sm text-neutral-400">No samples collected yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="canEdit" class="section-card">
              <div class="section-card-title">Record Sample</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label class="field-label">Specimen Type</label>
                  <select v-model="sample.samples[0].lab_specimen_type_id" class="field-input text-sm">
                    <option :value="null">Select specimen…</option>
                    <option v-for="specimen in specimenCatalog" :key="specimen.id" :value="specimen.id">
                      {{ specimen.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="field-label">Sample Label</label>
                  <input v-model="sample.samples[0].sample_label" type="text" class="field-input text-sm" placeholder="e.g. EDTA-001" />
                </div>
                <div class="md:col-span-2">
                  <label class="field-label">Collection Notes</label>
                  <input
                    v-model="sample.samples[0].collection_notes"
                    type="text"
                    class="field-input text-sm"
                    placeholder="Optional collection notes"
                  />
                </div>
              </div>
              <div class="mt-4">
                <ActionButton
                  type="button"
                  class="!rounded !px-4 !py-2 text-sm"
                  :loading="sample.processing"
                  loading-text="Recording…"
                  @click="addSample"
                >
                  Record sample
                </ActionButton>
              </div>
            </div>
          </div>

          <QueueFooter
            v-if="canEdit"
            :show-hint="showQueueHint"
            label="Complete"
            aria-label="Complete lab and queue to screening review"
            :loading="completing"
            loading-text="Submitting…"
            @click="complete"
          />
        </form>

        <div v-else class="theme-surface rounded-lg shadow-sm">
          <div class="sc-bd">
            <div class="empty-state p-8 text-center">
              <p class="text-sm text-neutral-500">No lab request found for this encounter.</p>
              <ActionLink v-if="canEdit" :href="`/lab/${encounter.id}/add-tests`" variant="primary" class="mt-4">
                Create lab request
              </ActionLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 space-y-4">
      <div class="max-w-lg space-y-2">
        <ComingSoonWardQueueOptions />
      </div>
      <Link href="/lab/queue" class="text-sm text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200">
        ← Back to queue
      </Link>
    </div>
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
.lab-result-card--critical {
  background: #fef2f2;
}
.lab-result-card--abnormal {
  background: #fffbeb;
}
:global(.dark) .lab-result-card--critical {
  background: rgba(127, 29, 29, 0.2);
}
:global(.dark) .lab-result-card--abnormal {
  background: rgba(120, 53, 15, 0.2);
}
</style>
