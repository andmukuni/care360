<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ScreeningFormModal from '~/components/screening/ScreeningFormModal.vue'
import {
  DIAGNOSIS_LEVEL2_BY_LEVEL1,
  DIAGNOSIS_LEVEL3_BY_LEVEL2,
  NTG_LEVEL1_OPTIONS,
} from '~/support/screening/ntg_data'
import {
  parseGeneralAssessment,
  parseJsonArrayField,
  serializeEntries,
  serializeGeneralAssessment,
  SYSTEM_EXAMINATION_OPTIONS,
  type DiagnosisEntry,
  type GeneralAssessmentData,
  type SystemExaminationEntry,
} from '~/support/screening/screening_json_fields'
import type { FieldSuggestionItem } from '~/components/clinical/FieldWithSuggestions.vue'
import DictionarySearchSelect from '~/components/dictionary/DictionarySearchSelect.vue'
import TermDefinitionPopover from '~/components/dictionary/TermDefinitionPopover.vue'

const form = defineModel<Record<string, any>>({ required: true })

const props = defineProps<{
  disabled?: boolean
  diagnosisSuggestions?: FieldSuggestionItem[]
}>()

const emit = defineEmits<{
  'suggestion-applied': []
}>()

const CERTAINTY_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Rule Out'] as const
const ATTENDANCE_OPTIONS = ['First visit', 'Follow-up', 'Emergency'] as const

const GENERAL_CONDITION_OPTIONS = ['Good', 'Stable', 'Critical'] as const
const PALLOR_OPTIONS = ['Nil', 'Mild', 'Moderate', 'Severe'] as const
const GRADE_OPTIONS = ['Nil', '1+', '2+', '3+', '4+'] as const
const JAUNDICE_OPTIONS = ['Yellow', 'Not present', 'Tinge', 'Green'] as const
const CYANOSIS_OPTIONS = ['Nil', 'Mild', 'Moderate', 'Severe'] as const

const EYE_OPTIONS = [
  { value: '1', label: 'No response (1 point)' },
  { value: '2', label: 'To pain only (not applied to face) (2 points)' },
  { value: '3', label: 'To verbal stimuli, command, speech (3 points)' },
  { value: '4', label: 'Spontaneous - open with blinking at baseline (4 points)' },
] as const

const VERBAL_OPTIONS = [
  { value: '1', label: 'No response (1point)' },
  { value: '2', label: 'Incomprehensible sounds (2 points)' },
  { value: '3', label: 'Inappropriate words (3 points)' },
  { value: '4', label: 'Confused, disoriented (4 points)' },
  { value: '5', label: 'Oriented (5 points)' },
] as const

const MOTOR_OPTIONS = [
  { value: '1', label: 'No response (1 point)' },
  { value: '2', label: 'Extension response in response to pain (2 point)' },
  { value: '3', label: 'Flexion in response to pain (decorticate posturing) (3 points)' },
  { value: '4', label: 'Withdraws in response to pain (4 points)' },
  { value: '5', label: 'Purposeful movement to painful stimulus (5 points)' },
  { value: '6', label: 'Obeys commands for movement (6 points)' },
] as const

// ── General Assessment ──
const gaModalOpen = ref(false)
const gaParsed = parseGeneralAssessment(form.value.physical_examination)
const gaForm = ref<GeneralAssessmentData>({ ...gaParsed.form })
const gaInitialRaw = ref(gaParsed.initialRaw)
const gaError = ref('')

const gaHasData = computed(() => Object.values(gaForm.value).some((v) => !!v))
const gaSummaryRows = computed(() =>
  [
    { label: 'General Condition', value: gaForm.value.general_condition },
    { label: 'Pallor', value: gaForm.value.pallor },
    { label: 'Edema', value: gaForm.value.edema },
    { label: 'Clubbing', value: gaForm.value.clubbing },
    { label: 'Jaundice', value: gaForm.value.jaundice },
    { label: 'Cyanosis', value: gaForm.value.cyanosis },
  ].filter((row) => !!row.value)
)

watch(
  gaForm,
  () => {
    form.value.physical_examination = serializeGeneralAssessment(gaForm.value, gaInitialRaw.value)
  },
  { deep: true }
)

function saveGeneralAssessment() {
  gaError.value = ''
  if (!gaForm.value.general_condition) {
    gaError.value = 'General Condition is required.'
    return false
  }
  gaInitialRaw.value = ''
  return true
}
const sysModalOpen = ref(false)
const sysParsed = parseJsonArrayField<SystemExaminationEntry>(form.value.clinical_findings)
const sysEntries = ref<SystemExaminationEntry[]>([...sysParsed.entries])
const sysInitialRaw = ref(sysParsed.initialRaw)
const sysError = ref('')
const sysForm = ref({ system: '', customSystem: '', notes: '' })

watch(
  sysEntries,
  (entries) => {
    form.value.clinical_findings = serializeEntries(entries, sysInitialRaw.value)
  },
  { deep: true }
)

function addSysEntry() {
  sysError.value = ''
  let systemName = sysForm.value.system
  if (systemName === 'Other') systemName = sysForm.value.customSystem.trim()
  if (!systemName || !sysForm.value.notes.trim()) {
    sysError.value = 'System and Notes are required.'
    return
  }
  sysEntries.value.push({ system: systemName, notes: sysForm.value.notes.trim() })
  sysInitialRaw.value = ''
  sysForm.value = { system: '', customSystem: '', notes: '' }
}

function removeSysEntry(idx: number) {
  sysEntries.value.splice(idx, 1)
}

function saveSysModal() {
  if (sysForm.value.system && sysForm.value.notes.trim()) {
    addSysEntry()
    if (sysError.value) return false
  }
  return true
}

// ── Glasgow Coma Scale ──
const gcsModalOpen = ref(false)
const gcsInitialRaw = ref(String(form.value.assessment_notes ?? ''))
const gcsForm = ref({ eye: '', verbal: '', motor: '', result: '' })
const gcsError = ref('')

function initGcsFromText(initialText: string) {
  gcsInitialRaw.value = initialText
  if (!initialText.startsWith('GCS - Eye:')) return
  const match = initialText.match(
    /GCS - Eye:\s*(.*?);\s*Verbal:\s*(.*?);\s*Motor:\s*(.*?);\s*Score:\s*(\d+)\/15;\s*Result:\s*(.*)$/i
  )
  if (!match) return
  const eye = EYE_OPTIONS.find((o) => o.label === match[1].trim())
  const verbal = VERBAL_OPTIONS.find((o) => o.label === match[2].trim())
  const motor = MOTOR_OPTIONS.find((o) => o.label === match[3].trim())
  gcsForm.value = {
    eye: eye?.value ?? '',
    verbal: verbal?.value ?? '',
    motor: motor?.value ?? '',
    result: match[5].trim(),
  }
}

initGcsFromText(String(form.value.assessment_notes ?? ''))

const selectedEyeLabel = computed(
  () => EYE_OPTIONS.find((o) => o.value === gcsForm.value.eye)?.label ?? '—'
)
const selectedVerbalLabel = computed(
  () => VERBAL_OPTIONS.find((o) => o.value === gcsForm.value.verbal)?.label ?? '—'
)
const selectedMotorLabel = computed(
  () => MOTOR_OPTIONS.find((o) => o.value === gcsForm.value.motor)?.label ?? '—'
)
const gcsTotalScore = computed(() => {
  const e = Number(gcsForm.value.eye || 0)
  const v = Number(gcsForm.value.verbal || 0)
  const m = Number(gcsForm.value.motor || 0)
  return e + v + m
})
const gcsHasData = computed(
  () =>
    !!(gcsForm.value.eye || gcsForm.value.verbal || gcsForm.value.motor || gcsForm.value.result.trim())
)

watch(
  gcsForm,
  () => {
    const f = gcsForm.value
    if (f.eye && f.verbal && f.motor && f.result.trim()) {
      form.value.assessment_notes = `GCS - Eye: ${selectedEyeLabel.value}; Verbal: ${selectedVerbalLabel.value}; Motor: ${selectedMotorLabel.value}; Score: ${gcsTotalScore.value}/15; Result: ${f.result.trim()}`
      gcsInitialRaw.value = ''
    } else {
      form.value.assessment_notes = gcsInitialRaw.value
    }
  },
  { deep: true }
)

function saveGcsModal() {
  gcsError.value = ''
  if (!gcsForm.value.eye || !gcsForm.value.verbal || !gcsForm.value.motor || !gcsForm.value.result.trim()) {
    gcsError.value = 'Eye, Verbal, Motor and Result are all required.'
    return false
  }
  gcsInitialRaw.value = ''
  return true
}

// ── Diagnosis ──
const dxModalOpen = ref(false)
const dxInitialProvisional = ref(String(form.value.provisional_diagnosis ?? ''))
const dxInitialFinal = ref(String(form.value.final_diagnosis ?? ''))
const dxEntries = ref<DiagnosisEntry[]>([])
const dxError = ref('')
const dxForm = ref({
  type: 'National Treatment Guideline',
  icd11: '',
  level1: '',
  level2: '',
  level3: '',
  certainty: '',
  attendance: '',
  comments: '',
})

try {
  const parsed = JSON.parse(dxInitialProvisional.value)
  if (Array.isArray(parsed)) dxEntries.value = parsed
} catch {
  // legacy values kept in hidden fields
}

const dxLevel2Options = computed(() => DIAGNOSIS_LEVEL2_BY_LEVEL1[dxForm.value.level1] ?? [])
const dxLevel3Options = computed(() => DIAGNOSIS_LEVEL3_BY_LEVEL2[dxForm.value.level2] ?? [])

watch(
  dxEntries,
  (entries) => {
    if (entries.length > 0) {
      form.value.provisional_diagnosis = JSON.stringify(entries)
      const last = entries[entries.length - 1]
      const note = last.comments ? `; ${last.comments}` : ''
      form.value.final_diagnosis = `${last.path} (${last.certainty}, ${last.attendance})${note}`
      dxInitialProvisional.value = ''
      dxInitialFinal.value = ''
    } else {
      form.value.provisional_diagnosis = dxInitialProvisional.value
      form.value.final_diagnosis = dxInitialFinal.value
    }
  },
  { deep: true }
)

function onDxLevel1Change() {
  dxForm.value.level2 = ''
  dxForm.value.level3 = ''
}

function onDxLevel2Change() {
  dxForm.value.level3 = ''
}

function hasPendingDiagnosisDraft() {
  const f = dxForm.value
  const comments = f.comments.trim()
  if (f.type === 'National Treatment Guideline') {
    return !!(f.level1 || f.level2 || f.level3 || f.certainty || f.attendance || comments)
  }
  return !!(f.icd11.trim() || f.certainty || f.attendance || comments)
}

function removeDxEntry(idx: number) {
  dxEntries.value.splice(idx, 1)
}

const dxSelectedCode = ref('')

function onDxDictionarySelect(term: { label: string; code: string | null }) {
  dxForm.value.icd11 = term.label
  dxSelectedCode.value = term.code ?? ''
}

function commitDiagnosisEntry(): boolean {
  dxError.value = ''
  const f = dxForm.value
  if (f.type === 'National Treatment Guideline' && (!f.level1 || !f.level2 || !f.level3)) {
    dxError.value = 'NTG Levels 1, 2 and 3 are required.'
    return false
  }
  if (f.type === 'ICD 11' && !f.icd11.trim()) {
    dxError.value = 'ICD 11 is required.'
    return false
  }
  if (!f.certainty || !f.attendance) {
    dxError.value = 'Certainty and Attendance are required.'
    return false
  }
  const path =
    f.type === 'ICD 11' ? f.icd11.trim() : `${f.level1} > ${f.level2} > ${f.level3}`
  dxEntries.value.push({
    type: f.type,
    icd11: f.type === 'ICD 11' ? (dxSelectedCode.value || f.icd11) : f.icd11,
    level1: f.level1,
    level2: f.level2,
    level3: f.level3,
    path,
    certainty: f.certainty,
    attendance: f.attendance,
    comments: f.comments.trim(),
  })
  dxForm.value = {
    type: 'National Treatment Guideline',
    icd11: '',
    level1: '',
    level2: '',
    level3: '',
    certainty: '',
    attendance: '',
    comments: '',
  }
  dxSelectedCode.value = ''
  return true
}

function saveDiagnosisModal() {
  if (!hasPendingDiagnosisDraft()) return true
  return commitDiagnosisEntry()
}

const dismissedDxSuggestions = ref<Set<number>>(new Set())

const visibleDxSuggestions = computed(() =>
  (props.diagnosisSuggestions ?? []).filter((s) => !dismissedDxSuggestions.value.has(s.id))
)

function applyDxSuggestion(text: string) {
  const current = String(form.value.final_diagnosis ?? '').trim()
  form.value.final_diagnosis = current ? `${current}\n${text}` : text
  emit('suggestion-applied')
}

function dismissDxSuggestion(id: number) {
  dismissedDxSuggestions.value = new Set([...dismissedDxSuggestions.value, id])
}

function dxSuggestionSource(item: FieldSuggestionItem): string {
  if (item.source?.test_name) {
    return `${item.source.test_name}${item.source.result ? ` · ${item.source.result}` : ''}`
  }
  if (item.source?.trigger) return `Trigger: ${item.source.trigger}`
  return 'Clinical rule'
}
</script>

<template>
  <div class="section-card divide-y divide-neutral-200 !mb-0 !overflow-hidden !p-0 dark:divide-white/[0.04]">
    <!-- General Assessment -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        General Assessment
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="gaModalOpen = true">Open Form</button>
        <button v-if="gaHasData" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="gaModalOpen = true">Edit Record</button>
      </div>
      <div v-if="gaHasData" class="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div v-for="row in gaSummaryRows" :key="row.label" class="theme-surface rounded px-3 py-2">
          <p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">{{ row.label }}</p>
          <p class="text-sm text-neutral-800 dark:text-neutral-200">{{ row.value }}</p>
        </div>
      </div>
      <p v-else class="text-xs text-neutral-500">No general assessment record captured yet.</p>
      <ScreeningFormModal v-model:show="gaModalOpen" title="General Assessment" max-width-class="max-w-5xl" footer-align="center" :disabled="disabled" @save="() => { if (saveGeneralAssessment()) gaModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label class="field-label">General Condition <span class="text-red-500">*</span></label><select v-model="gaForm.general_condition" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in GENERAL_CONDITION_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Pallor</label><select v-model="gaForm.pallor" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in PALLOR_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Edema</label><select v-model="gaForm.edema" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in GRADE_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Clubbing</label><select v-model="gaForm.clubbing" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in GRADE_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Jaundice</label><select v-model="gaForm.jaundice" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in JAUNDICE_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Cyanosis</label><select v-model="gaForm.cyanosis" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in CYANOSIS_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
          </div>
          <p v-if="gaError" class="mt-3 text-xs text-red-600">{{ gaError }}</p>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- System Examination -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        System Examination
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="sysModalOpen = true">Open Form</button>
        <button v-if="sysEntries.length > 0" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="sysModalOpen = true">Edit Record</button>
      </div>
      <div v-if="sysEntries.length > 0" class="theme-surface overflow-hidden rounded">
        <table class="w-full text-sm"><thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">System</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Notes</th></tr></thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]"><tr v-for="(entry, idx) in sysEntries" :key="idx"><td class="px-3 py-1.5 text-xs font-medium">{{ entry.system }}</td><td class="px-3 py-1.5 text-xs">{{ entry.notes }}</td></tr></tbody>
        </table>
      </div>
      <p v-else-if="!sysInitialRaw" class="text-xs text-neutral-500">No system examination record captured yet.</p>
      <ScreeningFormModal v-model:show="sysModalOpen" title="System Examination" max-width-class="max-w-5xl" footer-align="center" :disabled="disabled" @save="() => { if (saveSysModal()) sysModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="space-y-3">
            <div><label class="field-label">System <span class="text-red-500">*</span></label><select v-model="sysForm.system" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="sys in SYSTEM_EXAMINATION_OPTIONS" :key="sys" :value="sys">{{ sys }}</option></select></div>
            <div><label class="field-label">Notes <span class="text-red-500">*</span></label><textarea v-model="sysForm.notes" rows="2" class="field-input" placeholder="Enter Notes" :disabled="disabled" /></div>
            <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="addSysEntry">Add</button>
            <p v-if="sysError" class="text-xs text-red-600">{{ sysError }}</p>
          </div>
          <div v-if="sysEntries.length > 0" class="mt-4 theme-surface overflow-hidden rounded">
            <table class="w-full text-sm"><thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">System</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Notes</th><th class="w-8 px-2 py-1.5" /></tr></thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]"><tr v-for="(entry, idx) in sysEntries" :key="idx"><td class="px-3 py-1.5 text-xs font-medium">{{ entry.system }}</td><td class="px-3 py-1.5 text-xs">{{ entry.notes }}</td><td class="px-2 py-1.5 text-center"><button type="button" class="text-neutral-400 hover:text-neutral-700" :disabled="disabled" @click="removeSysEntry(idx)">×</button></td></tr></tbody>
            </table>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Glasgow Coma Scale -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        Glasgow Coma Scale
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="gcsModalOpen = true">Open Form</button>
        <button v-if="gcsHasData" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="gcsModalOpen = true">Edit Record</button>
      </div>
      <div v-if="gcsHasData" class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Eye Score</p><p class="text-sm">{{ selectedEyeLabel }}</p></div>
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Verbal Score</p><p class="text-sm">{{ selectedVerbalLabel }}</p></div>
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Motor Score</p><p class="text-sm">{{ selectedMotorLabel }}</p></div>
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Score</p><p class="text-sm">{{ gcsTotalScore }} / 15</p></div>
        <div class="theme-surface rounded px-3 py-2 md:col-span-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Result</p><p class="text-sm">{{ gcsForm.result }}</p></div>
      </div>
      <p v-else-if="!gcsInitialRaw" class="text-xs text-neutral-500">No Glasgow Coma Scale record captured yet.</p>
      <ScreeningFormModal v-model:show="gcsModalOpen" title="Glasgow Coma Scale" max-width-class="max-w-5xl" footer-align="center" :disabled="disabled" @save="() => { if (saveGcsModal()) gcsModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label class="field-label">Eye Score <span class="text-red-500">*</span></label><select v-model="gcsForm.eye" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="opt in EYE_OPTIONS" :key="opt.label" :value="opt.value">{{ opt.label }}</option></select></div>
            <div><label class="field-label">Verbal Score <span class="text-red-500">*</span></label><select v-model="gcsForm.verbal" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="opt in VERBAL_OPTIONS" :key="opt.label" :value="opt.value">{{ opt.label }}</option></select></div>
            <div><label class="field-label">Motor Score <span class="text-red-500">*</span></label><select v-model="gcsForm.motor" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="opt in MOTOR_OPTIONS" :key="opt.label" :value="opt.value">{{ opt.label }}</option></select></div>
            <div><label class="field-label">Score <span class="text-red-500">*</span></label><input type="text" class="field-input bg-neutral-100 dark:bg-neutral-800" :value="gcsTotalScore" readonly /></div>
            <div class="md:col-span-2"><label class="field-label">Result <span class="text-red-500">*</span></label><textarea v-model="gcsForm.result" rows="2" class="field-input" placeholder="Result" :disabled="disabled" /></div>
          </div>
          <p v-if="gcsError" class="mt-3 text-xs text-red-600">{{ gcsError }}</p>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Diagnosis -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
        Diagnosis
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="dxModalOpen = true">Open Form</button>
        <button v-if="dxEntries.length > 0" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="dxModalOpen = true">Edit Record</button>
      </div>
      <div v-if="visibleDxSuggestions.length && !disabled" class="mb-3 space-y-1.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Suggested diagnosis</p>
        <div
          v-for="item in visibleDxSuggestions"
          :key="item.id"
          class="flex flex-wrap items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/30"
        >
          <div class="min-w-0 flex-1">
            <p class="text-xs text-neutral-800 dark:text-neutral-200">{{ item.text }}</p>
            <p class="mt-0.5 text-[10px] text-neutral-500">{{ dxSuggestionSource(item) }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-1">
            <button
              type="button"
              class="theme-icon-btn rounded px-2 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-100 dark:text-sky-200"
              @click="applyDxSuggestion(item.text)"
            >
              Apply
            </button>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-600"
              aria-label="Dismiss suggestion"
              @click="dismissDxSuggestion(item.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
      <div v-if="dxEntries.length > 0" class="theme-surface overflow-hidden rounded">
        <table class="w-full text-sm"><thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Type</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Path</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Certainty</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Attendance</th></tr></thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]"><tr v-for="(entry, idx) in dxEntries" :key="idx"><td class="px-3 py-1.5 text-xs font-medium">{{ entry.type }}</td><td class="px-3 py-1.5 text-xs">{{ entry.path }}</td><td class="px-3 py-1.5 text-xs">{{ entry.certainty }}</td><td class="px-3 py-1.5 text-xs">{{ entry.attendance }}</td></tr></tbody>
        </table>
      </div>
      <p v-else class="text-xs text-neutral-500">No diagnosis records captured yet.</p>
      <ScreeningFormModal v-model:show="dxModalOpen" title="Diagnosis" max-width-class="max-w-6xl" footer-align="center" :disabled="disabled" @save="() => { if (saveDiagnosisModal()) dxModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="mb-4 grid grid-cols-2 gap-3">
            <button type="button" class="py-2 text-xs" :class="dxForm.type === 'National Treatment Guideline' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="dxForm.type = 'National Treatment Guideline'">National Treatment Guideline</button>
            <button type="button" class="py-2 text-xs" :class="dxForm.type === 'ICD 11' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="dxForm.type = 'ICD 11'">ICD 11</button>
          </div>
          <div class="space-y-3">
            <template v-if="dxForm.type === 'National Treatment Guideline'">
              <div><label class="field-label">NTG Level 1 <span class="text-red-500">*</span></label><select v-model="dxForm.level1" class="field-input" :disabled="disabled" @change="onDxLevel1Change"><option value="">Search</option><option v-for="l1 in NTG_LEVEL1_OPTIONS" :key="l1" :value="l1">{{ l1 }}</option></select></div>
              <div><label class="field-label">NTG Level 2 <span class="text-red-500">*</span></label><select v-model="dxForm.level2" class="field-input" :disabled="disabled" @change="onDxLevel2Change"><option value="">Search</option><option v-for="l2 in dxLevel2Options" :key="l2" :value="l2">{{ l2 }}</option></select></div>
              <div><label class="field-label">NTG Level 3 <span class="text-red-500">*</span></label><select v-model="dxForm.level3" class="field-input" :disabled="disabled"><option value="">Search</option><option v-for="l3 in dxLevel3Options" :key="l3" :value="l3">{{ l3 }}</option></select></div>
            </template>
            <div v-else>
              <label class="field-label">ICD 11 / Medical Library <span class="text-red-500">*</span></label>
              <DictionarySearchSelect
                v-model="dxForm.icd11"
                domain="diagnosis"
                placeholder="Search ICD / NTG library…"
                :disabled="disabled"
                @select="onDxDictionarySelect"
              />
            </div>
            <div><label class="field-label">Certainty <span class="text-red-500">*</span></label><select v-model="dxForm.certainty" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="c in CERTAINTY_OPTIONS" :key="c" :value="c">{{ c }}</option></select></div>
            <div><label class="field-label">Attendance <span class="text-red-500">*</span></label><select v-model="dxForm.attendance" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="a in ATTENDANCE_OPTIONS" :key="a" :value="a">{{ a }}</option></select></div>
            <div><label class="field-label">Comments</label><textarea v-model="dxForm.comments" rows="2" class="field-input" placeholder="Enter Comments" :disabled="disabled" /></div>
            <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="commitDiagnosisEntry()">Add</button>
            <p v-if="dxError" class="text-xs text-red-600">{{ dxError }}</p>
          </div>
          <div v-if="dxEntries.length > 0" class="mt-4 theme-surface overflow-hidden rounded">
            <table class="w-full text-sm"><thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Type</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Path</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Certainty</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Attendance</th><th class="w-8 px-2 py-1.5" /></tr></thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]"><tr v-for="(entry, idx) in dxEntries" :key="idx"><td class="px-3 py-1.5 text-xs font-medium">{{ entry.type }}</td><td class="px-3 py-1.5 text-xs">{{ entry.path }} <TermDefinitionPopover :label="entry.path" :code="entry.icd11" /></td><td class="px-3 py-1.5 text-xs">{{ entry.certainty }}</td><td class="px-3 py-1.5 text-xs">{{ entry.attendance }}</td><td class="px-2 py-1.5 text-center"><button type="button" class="text-neutral-400 hover:text-neutral-700" :disabled="disabled" @click="removeDxEntry(idx)">×</button></td></tr></tbody>
            </table>
          </div>
        </div>
      </ScreeningFormModal>
    </div>
  </div>
</template>
