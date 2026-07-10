<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ScreeningFormModal from '~/components/screening/ScreeningFormModal.vue'
import SearchableSelect from '~/components/ui/SearchableSelect.vue'
import {
  CHRONIC_LEVEL2_BY_LEVEL1,
  CHRONIC_LEVEL3_BY_LEVEL2,
  NTG_LEVEL1_OPTIONS,
} from '~/support/screening/ntg_data'
import {
  parseJsonArrayField,
  parseJsonObjectField,
  serializeEntries,
  serializeObject,
  SYSTEM_EXAMINATION_OPTIONS,
  type AllergyEntry,
  type ChronicConditionEntry,
  type PastMedicalHistoryData,
  type SystemExaminationEntry,
} from '~/support/screening/screening_json_fields'
import {
  buildPresumptiveTbDiagnosisEntry,
  formatFinalDiagnosisFromEntry,
  hasPresumptiveTbIndicators,
  mergePresumptiveTbDiagnosis,
} from '~/support/screening/presumptive_tb'
import DictionarySearchSelect from '~/components/dictionary/DictionarySearchSelect.vue'

const form = defineModel<Record<string, any>>({ required: true })

const props = defineProps<{
  disabled?: boolean
}>()

const TB_OPTIONS = [
  { key: 'lethargy', label: 'Lethargy' },
  { key: 'cough', label: 'Cough' },
  { key: 'fever', label: 'Fever' },
  { key: 'weight_loss', label: 'Weight Loss' },
  { key: 'blood_stained_sputum', label: 'Blood-stained sputum' },
  { key: 'shortness_of_breath', label: 'Shortness of breath' },
  { key: 'chest_pain', label: 'Chest Pain' },
  { key: 'night_sweats', label: 'Night Sweats' },
  { key: 'fatigue', label: 'Fatigue' },
] as const

const CONSTITUTIONAL_OPTIONS = [
  'Fever',
  'Night Sweats',
  'Weight Loss',
  'Fatigue / Lethargy',
  'Loss of Appetite',
  'Generalised Weakness',
] as const

const ALLERGY_TYPES = ['Drug', 'Blood', 'Dust', 'Food', 'Plants', 'Other', 'Animals'] as const
const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe', 'Life-threatening'] as const
const DRUG_TYPES = [
  'Penicillin', 'Amoxicillin', 'Ampicillin', 'Cephalosporins', 'Sulphonamides', 'Tetracyclines',
  'Macrolides (Erythromycin)', 'Quinolones (Ciprofloxacin)', 'Metronidazole', 'Aspirin',
  'NSAIDs (Ibuprofen / Diclofenac)', 'Paracetamol', 'Codeine', 'Morphine', 'Tramadol',
  'ACE Inhibitors', 'Beta-blockers', 'Calcium Channel Blockers', 'Statins', 'Insulin', 'Metformin',
  'Antiretrovirals (ARVs)', 'Anti-TB drugs', 'Contrast dye (X-ray / CT)', 'Anaesthetic agents', 'Other',
] as const

const CONDITION_TYPES = ['Chronic Condition', 'Non Chronic Condition'] as const
const CERTAINTY_OPTIONS = ['Confirmed', 'Probable', 'Possible', 'Rule Out'] as const

// ── Complaints & Histories ──
const complaintsModalOpen = ref(false)
const modalComplaints = ref(String(form.value.complaints ?? ''))
const modalHistory = ref(String(form.value.history_of_presenting_illness ?? ''))

watch(
  () => [form.value.complaints, form.value.history_of_presenting_illness],
  ([complaints, history]) => {
    if (!complaintsModalOpen.value) {
      modalComplaints.value = String(complaints ?? '')
      modalHistory.value = String(history ?? '')
    }
  }
)

function saveComplaintsModal() {
  form.value.complaints = modalComplaints.value
  form.value.history_of_presenting_illness = modalHistory.value
}

// ── TB Symptoms ──
const tbModalOpen = ref(false)
const tbSymptoms = ref<Record<string, boolean>>({})
const tbConstitutional = ref(String(form.value.constitutional_symptoms ?? ''))
const tbPresumptive = ref(String(form.value.presumptive_tb_case_no ?? ''))
const tbPresumptiveWasAuto = ref(false)
const tbPresumptiveLoading = ref(false)
let tbPresumptiveRequestId = 0

const TB_SYMPTOM_LABELS = Object.fromEntries(TB_OPTIONS.map((opt) => [opt.key, opt.label])) as Record<
  string,
  string
>

function initTbSymptoms() {
  const checked = (form.value.tb_symptoms as string[]) ?? []
  const state: Record<string, boolean> = {}
  TB_OPTIONS.forEach((opt) => {
    state[opt.key] = checked.includes(opt.key)
  })
  tbSymptoms.value = state
}

initTbSymptoms()

const checkedTbSymptoms = computed(() =>
  TB_OPTIONS.filter((opt) => tbSymptoms.value[opt.key]).map((opt) => opt.key)
)

const checkedTbLabels = computed(() =>
  TB_OPTIONS.filter((opt) => tbSymptoms.value[opt.key]).map((opt) => opt.label)
)

const shouldAutoAssignTb = computed(() =>
  hasPresumptiveTbIndicators(checkedTbSymptoms.value, tbConstitutional.value) && !tbPresumptive.value
)

async function ensurePresumptiveTbCaseNumber() {
  if (!hasPresumptiveTbIndicators(checkedTbSymptoms.value, tbConstitutional.value)) {
    if (tbPresumptiveWasAuto.value) {
      tbPresumptive.value = ''
      tbPresumptiveWasAuto.value = false
    }
    return
  }

  if (tbPresumptive.value) {
    return
  }

  const requestId = ++tbPresumptiveRequestId
  tbPresumptiveLoading.value = true

  try {
    const res = await fetch('/screening/presumptive-tb/next-case-number', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error('Failed to reserve presumptive TB case number')
    }

    const data = (await res.json()) as { case_number?: string }
    if (requestId === tbPresumptiveRequestId && data.case_number) {
      tbPresumptive.value = data.case_number
      tbPresumptiveWasAuto.value = true
    }
  } catch {
    // Backend still assigns on save if this preview request fails.
  } finally {
    if (requestId === tbPresumptiveRequestId) {
      tbPresumptiveLoading.value = false
    }
  }
}

function applyPresumptiveTbDiagnosis() {
  if (!hasPresumptiveTbIndicators(checkedTbSymptoms.value, tbConstitutional.value)) {
    return
  }

  const entry = buildPresumptiveTbDiagnosisEntry(
    checkedTbSymptoms.value,
    TB_SYMPTOM_LABELS,
    tbConstitutional.value
  )

  form.value.provisional_diagnosis = mergePresumptiveTbDiagnosis(
    String(form.value.provisional_diagnosis ?? ''),
    entry
  )

  if (!String(form.value.final_diagnosis ?? '').trim()) {
    form.value.final_diagnosis = formatFinalDiagnosisFromEntry(entry)
  }
}

function onTbPresumptiveInput() {
  tbPresumptiveWasAuto.value = false
}

function saveTbModal() {
  form.value.tb_symptoms = checkedTbSymptoms.value
  form.value.constitutional_symptoms = tbConstitutional.value
  form.value.presumptive_tb_case_no = tbPresumptive.value
  applyPresumptiveTbDiagnosis()
}

watch(
  () => [form.value.tb_symptoms, form.value.constitutional_symptoms, form.value.presumptive_tb_case_no],
  () => {
    if (!tbModalOpen.value) {
      initTbSymptoms()
      tbConstitutional.value = String(form.value.constitutional_symptoms ?? '')
      tbPresumptive.value = String(form.value.presumptive_tb_case_no ?? '')
      tbPresumptiveWasAuto.value = false
    }
  },
  { deep: true }
)

watch([checkedTbSymptoms, tbConstitutional], () => {
  if (tbModalOpen.value) {
    ensurePresumptiveTbCaseNumber()
  }
})

watch(tbModalOpen, (open) => {
  if (open) {
    tbPresumptiveWasAuto.value = false
    ensurePresumptiveTbCaseNumber()
  }
})

// ── Review of Systems ──
const rosModalOpen = ref(false)
const rosParsed = parseJsonArrayField<SystemExaminationEntry>(form.value.review_of_systems)
const rosEntries = ref<SystemExaminationEntry[]>([...rosParsed.entries])
const rosInitialRaw = ref(rosParsed.initialRaw)
const rosError = ref('')
const rosForm = ref({ system: '', customSystem: '', notes: '' })

watch(
  rosEntries,
  (entries) => {
    form.value.review_of_systems = serializeEntries(entries, rosInitialRaw.value)
  },
  { deep: true }
)

function addRosEntry() {
  rosError.value = ''
  let systemName = rosForm.value.system
  if (systemName === 'Other') systemName = rosForm.value.customSystem.trim()
  if (!systemName || !rosForm.value.notes.trim()) {
    rosError.value = 'System and Notes are required.'
    return
  }
  rosEntries.value.push({ system: systemName, notes: rosForm.value.notes.trim() })
  rosInitialRaw.value = ''
  rosForm.value = { system: '', customSystem: '', notes: '' }
}

function removeRosEntry(idx: number) {
  rosEntries.value.splice(idx, 1)
}

function saveRosModal() {
  if (rosForm.value.system && rosForm.value.notes.trim()) {
    addRosEntry()
    if (rosError.value) return
  }
}

// ── Past Medical History ──
const pmhModalOpen = ref(false)
const pmhParsed = parseJsonObjectField<PastMedicalHistoryData>(form.value.past_medical_history)
const pmhForm = ref<PastMedicalHistoryData>({
  drug_history: String(pmhParsed.data.drug_history ?? ''),
  admission_history: String(pmhParsed.data.admission_history ?? ''),
  surgical_history: String(pmhParsed.data.surgical_history ?? ''),
})
const pmhInitialRaw = ref(pmhParsed.initialRaw)
const pmhError = ref('')

const pmhHasData = computed(
  () =>
    !!pmhForm.value.drug_history.trim() ||
    !!pmhForm.value.admission_history.trim() ||
    !!pmhForm.value.surgical_history.trim()
)

watch(
  pmhForm,
  () => {
    form.value.past_medical_history = serializeObject(
      {
        drug_history: pmhForm.value.drug_history.trim(),
        admission_history: pmhForm.value.admission_history.trim(),
        surgical_history: pmhForm.value.surgical_history.trim(),
      },
      pmhHasData.value,
      pmhInitialRaw.value
    )
  },
  { deep: true }
)

function savePmhModal() {
  pmhError.value = ''
  if (!pmhForm.value.drug_history.trim() || !pmhForm.value.admission_history.trim() || !pmhForm.value.surgical_history.trim()) {
    pmhError.value = 'Drug History, Admission History and Surgical History are required.'
    return
  }
  pmhInitialRaw.value = ''
}

// ── Chronic Conditions ──
const chronicModalOpen = ref(false)
const chronicParsed = parseJsonArrayField<ChronicConditionEntry>(form.value.chronic_conditions)
const chronicEntries = ref<ChronicConditionEntry[]>([...chronicParsed.entries])
const chronicInitialRaw = ref(chronicParsed.initialRaw)
const chronicError = ref('')
const chronicForm = ref({
  type: 'National Treatment Guideline',
  level1: '',
  level2: '',
  level3: '',
  icd11: '',
  condition: '',
  date_diagnosed: '',
  still_ongoing: false,
  date_resolved: '',
  certainty: '',
  comments: '',
})

const chronicLevel2Options = computed(() => CHRONIC_LEVEL2_BY_LEVEL1[chronicForm.value.level1] ?? [])
const chronicLevel3Options = computed(() => CHRONIC_LEVEL3_BY_LEVEL2[chronicForm.value.level2] ?? [])

watch(
  chronicEntries,
  (entries) => {
    form.value.chronic_conditions = serializeEntries(entries, chronicInitialRaw.value)
  },
  { deep: true }
)

function onChronicLevel1Change() {
  chronicForm.value.level2 = ''
  chronicForm.value.level3 = ''
}

function onChronicLevel2Change() {
  chronicForm.value.level3 = ''
}

function addChronicEntry() {
  chronicError.value = ''
  const f = chronicForm.value
  if (f.type === 'National Treatment Guideline' && (!f.level1 || !f.level2 || !f.level3)) {
    chronicError.value = 'NTG Levels 1, 2 and 3 are required.'
    return
  }
  if (f.type === 'ICD 11' && !f.icd11.trim()) {
    chronicError.value = 'ICD 11 field is required.'
    return
  }
  if (!f.condition) {
    chronicError.value = 'Condition is required.'
    return
  }
  if (!f.date_diagnosed) {
    chronicError.value = 'Date Diagnosed is required.'
    return
  }
  if (!f.certainty) {
    chronicError.value = 'Certainty is required.'
    return
  }
  const path =
    f.type === 'ICD 11' ? f.icd11.trim() : [f.level1, f.level2, f.level3].join(' > ')
  chronicEntries.value.push({
    type: f.type,
    path,
    condition: f.condition,
    date_diagnosed: f.date_diagnosed,
    still_ongoing: f.still_ongoing,
    date_resolved: f.still_ongoing ? '' : f.date_resolved,
    certainty: f.certainty,
    comments: f.comments.trim(),
  })
  chronicInitialRaw.value = ''
  chronicForm.value = {
    type: 'National Treatment Guideline',
    level1: '',
    level2: '',
    level3: '',
    icd11: '',
    condition: '',
    date_diagnosed: '',
    still_ongoing: false,
    date_resolved: '',
    certainty: '',
    comments: '',
  }
}

function removeChronicEntry(idx: number) {
  chronicEntries.value.splice(idx, 1)
}

function saveChronicModal() {
  const f = chronicForm.value
  const hasPending =
    (f.type === 'National Treatment Guideline' && (f.level1 || f.level2 || f.level3)) ||
    (f.type === 'ICD 11' && f.icd11.trim()) ||
    f.condition ||
    f.date_diagnosed ||
    f.certainty
  if (hasPending) {
    addChronicEntry()
    if (chronicError.value) return
  }
}

// ── Allergies ──
const allergyModalOpen = ref(false)
const allergyParsed = parseJsonArrayField<AllergyEntry>(form.value.allergy_history)
const allergyEntries = ref<AllergyEntry[]>([...allergyParsed.entries])
const allergyInitialRaw = ref(allergyParsed.initialRaw)
const allergyError = ref('')
const allergyForm = ref({ allergy_type: '', severity: '', drug_type: '' })

watch(
  allergyEntries,
  (entries) => {
    form.value.allergy_history = serializeEntries(entries, allergyInitialRaw.value)
  },
  { deep: true }
)

function addAllergyEntry() {
  allergyError.value = ''
  if (!allergyForm.value.allergy_type) {
    allergyError.value = 'Allergy Type is required.'
    return
  }
  if (!allergyForm.value.severity) {
    allergyError.value = 'Severity is required.'
    return
  }
  allergyEntries.value.push({
    allergy_type: allergyForm.value.allergy_type,
    severity: allergyForm.value.severity,
    drug_type: allergyForm.value.allergy_type === 'Drug' ? allergyForm.value.drug_type : '',
  })
  allergyInitialRaw.value = ''
  allergyForm.value = { allergy_type: '', severity: '', drug_type: '' }
}

function removeAllergyEntry(idx: number) {
  allergyEntries.value.splice(idx, 1)
}

// ── Family & Social History ──
const familyModalOpen = ref(false)
const familyTab = ref<'family' | 'social'>('family')
const familyParsed = parseJsonObjectField<{ family_history?: string; ncd_risk_factors?: boolean | null }>(
  form.value.family_history
)
const socialParsed = parseJsonObjectField<{ smokes?: boolean | null; drinks_alcohol?: boolean | null }>(
  form.value.social_history
)

const familyHistory = ref(String(familyParsed.data.family_history ?? ''))
const ncdRiskFactors = ref<boolean | null>(familyParsed.data.ncd_risk_factors ?? null)
const smokes = ref<boolean | null>(socialParsed.data.smokes ?? null)
const drinksAlcohol = ref<boolean | null>(socialParsed.data.drinks_alcohol ?? null)
const familyInitialRaw = ref(familyParsed.initialRaw)
const socialInitialRaw = ref(socialParsed.initialRaw)

watch([familyHistory, ncdRiskFactors], () => {
  if (familyHistory.value !== '' || ncdRiskFactors.value !== null) {
    form.value.family_history = JSON.stringify({
      family_history: familyHistory.value,
      ncd_risk_factors: ncdRiskFactors.value,
    })
  } else {
    form.value.family_history = familyInitialRaw.value
  }
})

watch([smokes, drinksAlcohol], () => {
  if (smokes.value !== null || drinksAlcohol.value !== null) {
    form.value.social_history = JSON.stringify({
      smokes: smokes.value,
      drinks_alcohol: drinksAlcohol.value,
    })
  } else {
    form.value.social_history = socialInitialRaw.value
  }
})

const familySocialEmpty = computed(
  () =>
    familyHistory.value === '' &&
    ncdRiskFactors.value === null &&
    smokes.value === null &&
    drinksAlcohol.value === null &&
    !familyInitialRaw.value &&
    !socialInitialRaw.value
)
</script>

<template>
  <div class="section-card divide-y divide-neutral-200 !mb-0 !overflow-hidden !p-0 dark:divide-white/[0.04]">
    <!-- Complaints & Histories -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        Complaints & Histories
      </div>
      <div class="mb-3 flex justify-end">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="complaintsModalOpen = true">Open Form</button>
      </div>
      <div class="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
        <template v-if="form.complaints || form.history_of_presenting_illness">
          <div v-if="form.complaints" class="space-y-2">
            <p class="mb-0.5 font-semibold text-neutral-700 dark:text-neutral-300">Presenting Complaint</p>
            <p class="whitespace-pre-line">{{ form.complaints }}</p>
          </div>
          <div v-if="form.history_of_presenting_illness">
            <p class="mb-0.5 font-semibold text-neutral-700 dark:text-neutral-300">History of Presenting Complaint</p>
            <p class="whitespace-pre-line">{{ form.history_of_presenting_illness }}</p>
          </div>
        </template>
        <p v-else class="text-neutral-500">No complaints or history recorded yet.</p>
      </div>
      <ScreeningFormModal v-model:show="complaintsModalOpen" title="Complaints & Histories" :disabled="disabled" @save="() => { saveComplaintsModal(); complaintsModalOpen = false }">
        <div class="p-6">
          <div class="space-y-4 theme-surface rounded p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-blue-700">Present History</p>
            <div>
              <label class="field-label">Presenting Complaint <span class="text-red-500">*</span></label>
              <textarea v-model="modalComplaints" rows="4" class="field-input" placeholder="Enter Presenting Complaint" :disabled="disabled" />
            </div>
            <div>
              <label class="field-label">History of Presenting Complaint <span class="text-red-500">*</span></label>
              <textarea v-model="modalHistory" rows="4" class="field-input" placeholder="Enter History of Presenting Complaint" :disabled="disabled" />
            </div>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- TB Constitutional Symptoms -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        TB Constitutional Symptoms
      </div>
      <div class="mb-3 flex justify-end">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="tbModalOpen = true">Open Form</button>
      </div>
      <div class="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <p v-if="checkedTbLabels.length"><span class="font-semibold text-neutral-700 dark:text-neutral-300">TB Symptoms:</span> {{ checkedTbLabels.join(', ') }}</p>
        <p v-if="form.constitutional_symptoms"><span class="font-semibold text-neutral-700 dark:text-neutral-300">Constitutional Symptoms:</span> {{ form.constitutional_symptoms }}</p>
        <p v-if="form.presumptive_tb_case_no"><span class="font-semibold text-neutral-700 dark:text-neutral-300">Presumptive TB Case No:</span> {{ form.presumptive_tb_case_no }}</p>
        <p v-if="!checkedTbLabels.length && !form.constitutional_symptoms && !form.presumptive_tb_case_no" class="text-neutral-500">No TB symptoms recorded yet.</p>
      </div>
      <ScreeningFormModal v-model:show="tbModalOpen" title="TB Constitutional Symptoms" :disabled="disabled" @save="() => { saveTbModal(); tbModalOpen = false }">
        <div class="space-y-4 p-6">
          <div class="theme-surface rounded p-4">
            <p class="mb-3 text-xs font-bold uppercase tracking-wide text-blue-700">TB Symptoms</p>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="opt in TB_OPTIONS" :key="opt.key" class="flex cursor-pointer items-center gap-2 rounded border border-neutral-100 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800">
                <input v-model="tbSymptoms[opt.key]" type="checkbox" class="h-4 w-4 rounded border-neutral-300" :disabled="disabled" />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </div>
          <div class="theme-surface rounded p-4">
            <p class="mb-3 text-xs font-bold uppercase tracking-wide text-blue-700">Constitutional Symptoms</p>
            <select v-model="tbConstitutional" class="field-input" :disabled="disabled">
              <option value="">Constitutional Symptoms</option>
              <option v-for="opt in CONSTITUTIONAL_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <div class="theme-surface rounded p-4">
            <label class="field-label mb-1">Presumptive TB Case No</label>
            <input
              v-model="tbPresumptive"
              type="text"
              class="field-input bg-neutral-50 dark:bg-neutral-800"
              placeholder="Auto-generated when TB symptoms are recorded"
              :disabled="disabled || tbPresumptiveLoading"
              @input="onTbPresumptiveInput"
            />
            <p v-if="tbPresumptiveLoading" class="mt-1 text-[10px] text-neutral-500">Assigning case number…</p>
            <p v-else-if="tbPresumptive && tbPresumptiveWasAuto" class="mt-1 text-[10px] text-neutral-500">
              Auto-generated from recorded TB symptoms.
            </p>
            <p v-else-if="shouldAutoAssignTb" class="mt-1 text-[10px] text-neutral-500">
              Case number will be assigned when symptoms are saved.
            </p>
            <p v-if="shouldAutoAssignTb || (tbPresumptive && tbPresumptiveWasAuto)" class="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
              A presumptive TB diagnosis (NTG: Infections &gt; Tuberculosis) will be added to Provisional Diagnosis.
            </p>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Review of Systems -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        Review of Systems
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="rosModalOpen = true">Open Form</button>
        <button v-if="rosEntries.length > 0" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="rosModalOpen = true">Edit Record</button>
      </div>
      <div v-if="rosEntries.length > 0" class="theme-surface overflow-hidden rounded">
        <table class="w-full text-sm">
          <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">System</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Notes</th></tr></thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr v-for="(entry, idx) in rosEntries" :key="idx"><td class="px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">{{ entry.system }}</td><td class="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300">{{ entry.notes }}</td></tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!rosInitialRaw" class="text-xs text-neutral-500">No review of systems record captured yet.</p>
      <ScreeningFormModal v-model:show="rosModalOpen" title="Review of Systems" max-width-class="max-w-5xl" footer-align="center" :disabled="disabled" @save="() => { saveRosModal(); if (!rosError) rosModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="space-y-3">
            <div>
              <label class="field-label">System <span class="text-red-500">*</span></label>
              <select v-model="rosForm.system" class="field-input" :disabled="disabled">
                <option value="">--Select--</option>
                <option v-for="sys in SYSTEM_EXAMINATION_OPTIONS" :key="sys" :value="sys">{{ sys }}</option>
              </select>
            </div>
            <div v-if="rosForm.system === 'Other'">
              <label class="field-label">Custom system name <span class="text-red-500">*</span></label>
              <input v-model="rosForm.customSystem" type="text" class="field-input" placeholder="Enter system name" :disabled="disabled" />
            </div>
            <div>
              <label class="field-label">Notes <span class="text-red-500">*</span></label>
              <textarea v-model="rosForm.notes" rows="2" class="field-input" placeholder="Enter Notes" :disabled="disabled" />
            </div>
            <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="addRosEntry">Add</button>
            <p v-if="rosError" class="text-xs text-red-600">{{ rosError }}</p>
          </div>
          <div v-if="rosEntries.length > 0" class="mt-4 theme-surface overflow-hidden rounded">
            <table class="w-full text-sm">
              <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">System</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Notes</th><th class="w-8 px-2 py-1.5" /></tr></thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                <tr v-for="(entry, idx) in rosEntries" :key="idx">
                  <td class="px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">{{ entry.system }}</td>
                  <td class="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300">{{ entry.notes }}</td>
                  <td class="px-2 py-1.5 text-center"><button type="button" class="text-neutral-400 hover:text-neutral-700" :disabled="disabled" @click="removeRosEntry(idx)">×</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Past Medical History -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        Past Medical History
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="pmhModalOpen = true">Open Form</button>
        <button v-if="pmhHasData" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="pmhModalOpen = true">Edit Record</button>
      </div>
      <div v-if="pmhHasData" class="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Drug History</p><p class="text-sm text-neutral-800 dark:text-neutral-200">{{ pmhForm.drug_history || '—' }}</p></div>
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Admission History</p><p class="text-sm text-neutral-800 dark:text-neutral-200">{{ pmhForm.admission_history || '—' }}</p></div>
        <div class="theme-surface rounded px-3 py-2"><p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Surgical History</p><p class="text-sm text-neutral-800 dark:text-neutral-200">{{ pmhForm.surgical_history || '—' }}</p></div>
      </div>
      <p v-else-if="!pmhInitialRaw" class="text-xs text-neutral-500">No past medical history record captured yet.</p>
      <ScreeningFormModal v-model:show="pmhModalOpen" title="Past Medical History" max-width-class="max-w-5xl" footer-align="center" :disabled="disabled" @save="() => { savePmhModal(); if (!pmhError) pmhModalOpen = false }">
        <div class="mx-6 mt-4 theme-surface rounded p-6">
          <div class="space-y-3">
            <div><label class="field-label">Drug History <span class="text-red-500">*</span></label><textarea v-model="pmhForm.drug_history" rows="2" class="field-input" placeholder="Enter Drug History" :disabled="disabled" /></div>
            <div><label class="field-label">Admission History <span class="text-red-500">*</span></label><textarea v-model="pmhForm.admission_history" rows="2" class="field-input" placeholder="Enter Admission History" :disabled="disabled" /></div>
            <div><label class="field-label">Surgical History <span class="text-red-500">*</span></label><textarea v-model="pmhForm.surgical_history" rows="2" class="field-input" placeholder="Enter Surgical History" :disabled="disabled" /></div>
            <p v-if="pmhError" class="text-xs text-red-600">{{ pmhError }}</p>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Chronic / Non-Chronic Conditions -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        Chronic / Non-Chronic Conditions
      </div>
      <div class="mb-3 flex justify-end gap-2">
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="chronicModalOpen = true">Open Form</button>
        <button v-if="chronicEntries.length > 0" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="disabled" @click="chronicModalOpen = true">Edit Record</button>
      </div>
      <div v-if="chronicEntries.length > 0" class="theme-surface overflow-hidden rounded">
        <table class="w-full text-sm">
          <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Condition</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Classification</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Date Diagnosed</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Status</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Certainty</th></tr></thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr v-for="(entry, idx) in chronicEntries" :key="idx">
              <td class="px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">{{ entry.condition }}</td>
              <td class="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300">{{ entry.path }}</td>
              <td class="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300">{{ entry.date_diagnosed }}</td>
              <td class="px-3 py-1.5 text-xs"><span v-if="entry.still_ongoing" class="inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">Ongoing</span><span v-else class="text-neutral-700 dark:text-neutral-300">{{ entry.date_resolved || '—' }}</span></td>
              <td class="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300">{{ entry.certainty }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!chronicInitialRaw" class="text-xs text-neutral-500">No chronic / non-chronic conditions recorded yet.</p>
      <p v-else-if="chronicInitialRaw" class="whitespace-pre-line text-xs text-neutral-600 dark:text-neutral-400">{{ chronicInitialRaw }}</p>
      <ScreeningFormModal v-model:show="chronicModalOpen" title="Chronic / Non-Chronic Conditions" :disabled="disabled" @save="() => { saveChronicModal(); if (!chronicError) chronicModalOpen = false }">
        <div class="p-6">
          <div class="theme-surface rounded p-4">
            <div class="mb-4 grid grid-cols-2 gap-3">
              <button type="button" class="py-2 text-xs" :class="chronicForm.type === 'National Treatment Guideline' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="chronicForm.type = 'National Treatment Guideline'">National Treatment Guideline</button>
              <button type="button" class="py-2 text-xs" :class="chronicForm.type === 'ICD 11' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="chronicForm.type = 'ICD 11'">ICD 11</button>
            </div>
            <div class="space-y-3">
              <template v-if="chronicForm.type === 'National Treatment Guideline'">
                <div><label class="field-label">NTG Level 1 <span class="text-red-500">*</span></label><SearchableSelect v-model="chronicForm.level1" :options="NTG_LEVEL1_OPTIONS" :disabled="disabled" @change="onChronicLevel1Change" /></div>
                <div><label class="field-label">NTG Level 2 <span class="text-red-500">*</span></label><SearchableSelect v-model="chronicForm.level2" :options="chronicLevel2Options" :disabled="disabled || !chronicForm.level1" @change="onChronicLevel2Change" /></div>
                <div><label class="field-label">NTG Level 3 <span class="text-red-500">*</span></label><SearchableSelect v-model="chronicForm.level3" :options="chronicLevel3Options" :disabled="disabled || !chronicForm.level2" /></div>
              </template>
              <div v-else>
                <label class="field-label">ICD 11 / Medical Library <span class="text-red-500">*</span></label>
                <DictionarySearchSelect
                  v-model="chronicForm.icd11"
                  domain="diagnosis"
                  placeholder="Search ICD / NTG library…"
                  :disabled="disabled"
                  @select="(term) => { chronicForm.icd11 = term.label }"
                />
              </div>
              <div><label class="field-label">Condition <span class="text-red-500">*</span></label><SearchableSelect v-model="chronicForm.condition" :options="CONDITION_TYPES" placeholder="--Select--" :disabled="disabled" /></div>
              <div class="grid grid-cols-2 items-end gap-3">
                <div><label class="field-label">Date Diagnosed <span class="text-red-500">*</span></label><input v-model="chronicForm.date_diagnosed" type="date" class="field-input" :disabled="disabled" /></div>
                <label class="flex items-center gap-2 pb-2 text-sm text-neutral-700 dark:text-neutral-300"><input v-model="chronicForm.still_ongoing" type="checkbox" class="h-4 w-4 accent-neutral-900" :disabled="disabled" /> Still Ongoing</label>
              </div>
              <div v-if="!chronicForm.still_ongoing"><label class="field-label">Date Resolved</label><input v-model="chronicForm.date_resolved" type="date" class="field-input" :disabled="disabled" /></div>
              <div><label class="field-label">Certainty <span class="text-red-500">*</span></label><SearchableSelect v-model="chronicForm.certainty" :options="CERTAINTY_OPTIONS" placeholder="--Select--" :disabled="disabled" /></div>
              <div><label class="field-label">Comments</label><textarea v-model="chronicForm.comments" rows="2" class="field-input" placeholder="Enter Comments" :disabled="disabled" /></div>
              <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="addChronicEntry">&#10010; Add</button>
              <p v-if="chronicError" class="text-xs text-red-600">{{ chronicError }}</p>
            </div>
            <div v-if="chronicEntries.length > 0" class="mt-4 theme-surface overflow-hidden rounded">
              <table class="w-full text-sm">
                <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Condition</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Classification</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Date Diagnosed</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Status</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Certainty</th><th class="w-8 px-2 py-1.5" /></tr></thead>
                <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                  <tr v-for="(entry, idx) in chronicEntries" :key="idx">
                    <td class="px-3 py-1.5 text-xs font-medium">{{ entry.condition }}</td>
                    <td class="px-3 py-1.5 text-xs">{{ entry.path }}</td>
                    <td class="px-3 py-1.5 text-xs">{{ entry.date_diagnosed }}</td>
                    <td class="px-3 py-1.5 text-xs"><span v-if="entry.still_ongoing" class="inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold">Ongoing</span><span v-else>{{ entry.date_resolved || '—' }}</span></td>
                    <td class="px-3 py-1.5 text-xs">{{ entry.certainty }}</td>
                    <td class="px-2 py-1.5 text-center"><button type="button" class="text-neutral-400 hover:text-neutral-700" :disabled="disabled" @click="removeChronicEntry(idx)">×</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Medication History (inline only) -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        Medication History
      </div>
      <textarea v-model="form.medication_history" rows="2" class="field-input" placeholder="Current medications, dosages, duration..." :disabled="disabled" />
    </div>

    <!-- Allergies -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        Allergies
      </div>
      <div class="mb-3 flex justify-end"><button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="allergyModalOpen = true">Open Form</button></div>
      <div v-if="allergyEntries.length > 0" class="theme-surface overflow-hidden rounded">
        <table class="w-full text-sm">
          <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Allergy Type</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Severity</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Drug Type</th><th /></tr></thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr v-for="(entry, idx) in allergyEntries" :key="idx">
              <td class="px-3 py-1.5 text-xs font-medium">{{ entry.allergy_type }}</td>
              <td class="px-3 py-1.5 text-xs">{{ entry.severity }}</td>
              <td class="px-3 py-1.5 text-xs">{{ entry.drug_type || '—' }}</td>
              <td class="px-3 py-1.5 text-right"><button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50" :disabled="disabled" @click="removeAllergyEntry(idx)">×</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!allergyInitialRaw" class="text-xs text-neutral-500">No allergies recorded yet.</p>
      <p v-else class="whitespace-pre-line text-xs text-neutral-600">{{ allergyInitialRaw }}</p>
      <ScreeningFormModal v-model:show="allergyModalOpen" title="Allergies" :disabled="disabled" @save="allergyModalOpen = false">
        <div class="space-y-4 p-6">
          <div class="space-y-3 theme-surface rounded p-4">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="field-label">Allergy Type <span class="text-red-500">*</span></label><select v-model="allergyForm.allergy_type" class="field-input" :disabled="disabled" @change="allergyForm.drug_type = ''"><option value="">--Select--</option><option v-for="t in ALLERGY_TYPES" :key="t" :value="t">{{ t }}</option></select></div>
              <div><label class="field-label">Severity <span class="text-red-500">*</span></label><select v-model="allergyForm.severity" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="s in SEVERITY_OPTIONS" :key="s" :value="s">{{ s }}</option></select></div>
            </div>
            <div><label class="field-label">Drug Type</label><select v-model="allergyForm.drug_type" class="field-input" :class="allergyForm.allergy_type !== 'Drug' ? 'cursor-not-allowed bg-neutral-100 opacity-50' : ''" :disabled="disabled || allergyForm.allergy_type !== 'Drug'"><option value="">--Select--</option><option v-for="d in DRUG_TYPES" :key="d" :value="d">{{ d }}</option></select></div>
            <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="addAllergyEntry">Add</button>
            <p v-if="allergyError" class="text-xs text-red-600">{{ allergyError }}</p>
          </div>
          <div v-if="allergyEntries.length > 0" class="theme-surface overflow-hidden rounded">
            <table class="w-full text-sm">
              <thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Allergy Type</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Severity</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Drug Type</th><th /></tr></thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                <tr v-for="(entry, idx) in allergyEntries" :key="idx">
                  <td class="px-3 py-1.5 text-xs font-medium">{{ entry.allergy_type }}</td>
                  <td class="px-3 py-1.5 text-xs">{{ entry.severity }}</td>
                  <td class="px-3 py-1.5 text-xs">{{ entry.drug_type || '—' }}</td>
                  <td class="px-3 py-1.5 text-right"><button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600" :disabled="disabled" @click="removeAllergyEntry(idx)">×</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Family & Social History -->
    <div class="px-5 py-4">
      <div class="section-card-title flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        Family & Social History
      </div>
      <div class="mb-3 flex justify-end"><button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="disabled" @click="familyModalOpen = true">Open Form</button></div>
      <div class="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
        <div v-if="familyHistory || ncdRiskFactors !== null">
          <p class="mb-0.5 font-semibold text-neutral-700 dark:text-neutral-300">Family Medical History</p>
          <p v-if="familyHistory" class="whitespace-pre-line">{{ familyHistory }}</p>
          <p v-if="ncdRiskFactors !== null">NCD Risk Factors: <span class="font-medium">{{ ncdRiskFactors ? 'Yes' : 'No' }}</span></p>
        </div>
        <div v-if="smokes !== null || drinksAlcohol !== null">
          <p class="mb-0.5 font-semibold text-neutral-700 dark:text-neutral-300">Smoking & Alcohol</p>
          <p v-if="smokes !== null">Smokes: <span class="font-medium">{{ smokes ? 'Yes' : 'No' }}</span></p>
          <p v-if="drinksAlcohol !== null">Drinks Alcohol: <span class="font-medium">{{ drinksAlcohol ? 'Yes' : 'No' }}</span></p>
        </div>
        <p v-if="familySocialEmpty" class="text-neutral-500">No family or social history recorded yet.</p>
        <div v-else-if="!familyHistory && ncdRiskFactors === null && smokes === null && drinksAlcohol === null">
          <p v-if="familyInitialRaw" class="whitespace-pre-line">{{ familyInitialRaw }}</p>
          <p v-if="socialInitialRaw" class="whitespace-pre-line">{{ socialInitialRaw }}</p>
        </div>
      </div>
      <ScreeningFormModal v-model:show="familyModalOpen" title="Family & Social History" :disabled="disabled" @save="familyModalOpen = false">
        <div class="p-6">
          <div class="mb-4 grid grid-cols-2 gap-3">
            <button type="button" class="py-2 text-xs" :class="familyTab === 'family' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="familyTab = 'family'">Family Medical History</button>
            <button type="button" class="py-2 text-xs" :class="familyTab === 'social' ? 'btn-primary' : 'btn-secondary'" :disabled="disabled" @click="familyTab = 'social'">Smoking & Alcohol History</button>
          </div>
          <div v-if="familyTab === 'family'" class="space-y-4 theme-surface rounded p-4">
            <div><label class="field-label">Family Medical History <span class="text-red-500">*</span></label><textarea v-model="familyHistory" rows="4" class="field-input" placeholder="Enter Family Medical History" :disabled="disabled" /></div>
            <div>
              <p class="field-label mb-2">Does the patient have any NCD risk factors?</p>
              <div class="flex items-center gap-6">
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="ncdRiskFactors === true" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="ncdRiskFactors = true" /> Yes</label>
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="ncdRiskFactors === false" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="ncdRiskFactors = false" /> No</label>
              </div>
            </div>
          </div>
          <div v-else class="space-y-4 theme-surface rounded p-4">
            <div class="rounded border border-neutral-100 p-3">
              <p class="field-label mb-2">Does the patient smoke?</p>
              <div class="flex items-center gap-6">
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="smokes === true" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="smokes = true" /> Yes</label>
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="smokes === false" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="smokes = false" /> No</label>
              </div>
            </div>
            <div class="rounded border border-neutral-100 p-3">
              <p class="field-label mb-2">Does the patient drink alcohol?</p>
              <div class="flex items-center gap-6">
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="drinksAlcohol === true" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="drinksAlcohol = true" /> Yes</label>
                <label class="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" :checked="drinksAlcohol === false" class="h-4 w-4 accent-blue-600" :disabled="disabled" @change="drinksAlcohol = false" /> No</label>
              </div>
            </div>
          </div>
        </div>
      </ScreeningFormModal>
    </div>
  </div>
</template>
