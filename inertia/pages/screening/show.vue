<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Link, useForm, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import WardWingBadge from '~/components/encounter/WardWingBadge.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import VitalInputWithBadge from '~/components/ui/VitalInputWithBadge.vue'
import GynObsTab from '~/components/screening/GynObsTab.vue'
import ScreeningQueueActionsModal from '~/components/screening/ScreeningQueueActionsModal.vue'
import ClinicalSuggestionsBanner from '~/components/clinical/ClinicalSuggestionsBanner.vue'
import FieldWithSuggestions from '~/components/clinical/FieldWithSuggestions.vue'
import PrescriptionSuggestionsPanel from '~/components/clinical/PrescriptionSuggestionsPanel.vue'
import AddPrescriptionModal from '~/components/screening/AddPrescriptionModal.vue'
import AddLabTestModal from '~/components/screening/AddLabTestModal.vue'
import LabRequestDetailsCard from '~/components/lab/LabRequestDetailsCard.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import ComplaintsHistoriesTab from '~/components/screening/ComplaintsHistoriesTab.vue'
import ExaminationTab from '~/components/screening/ExaminationTab.vue'
import PaediatricTab from '~/components/screening/PaediatricTab.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { usePrescriptionCart, type PrescriptionCartItem } from '~/composables/usePrescriptionCart'
import { useLabCart, type LabCartItem } from '~/composables/useLabCart'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import { formatApiErrors } from '~/support/api_errors'
import { formatDiagnosisLabel } from '~/support/screening/screening_json_fields'
import { readXsrfToken } from '~/support/xsrf'
import {
  bmiBadge as computeBmiBadge,
  diastolicBpBadge,
  oxygenSaturationBadge,
  pulseBadge,
  systolicBpBadge,
  temperatureBadge,
} from '~/support/vital_badges'

type StartupMed = {
  id: number
  medication_name: string
  dosage: string | null
  route: string | null
  frequency: string | null
  notes?: string | null
  source: string
  status: string
  administered_at?: string | null
  recorded_by?: string | null
}

type Bed = {
  id: number
  bed_number: string
  status: string
  encounter_id: number | null
  patient_name?: string | null
}

type WardWithBeds = {
  id: number
  name: string
  wing: string
  beds: Bed[]
}

type Ward = {
  id: number
  name: string
  type: string | null
  location: string | null
  wing: string | null
}

type PastEncounter = {
  id: number
  encounter_number: string
  visit_type: string | null
  priority: string | null
  started_at: string | null
  triage: Record<string, any> | null
  screening: Record<string, any> | null
  startup_medications: StartupMed[]
}

type MedSearchResult = {
  id: number
  name: string
  generic_name: string | null
  strength: string | null
  form: string
  category: string | null
  default_route: string | null
  default_frequency: string | null
  units?: string[]
  unit_details?: { name: string; form: string | null; strength: string | null }[]
}

type PrescriptionItem = {
  id: number
  drug_name: string
  strength: string | null
  formulation: string | null
  dose: string | null
  item_per_dose: number | null
  frequency: string | null
  time_per: string | null
  frequency_unit: string | null
  duration: string | null
  duration_unit: string | null
  start_date: string | null
  end_date: string | null
  quantity_prescribed: number | null
  route: string | null
  is_passer_by: boolean
  instructions: string | null
}

type PharmacyRecommendationRow = {
  id: number
  status: string
  note: string | null
  recommended_by: string | null
  prescribed_by: string | null
  source: PrescriptionItem | null
  recommended: PrescriptionItem | null
}

type TabId =
  | 'complaints'
  | 'gynobs'
  | 'paediatric'
  | 'examination'
  | 'vital-recheck'
  | 'prescription'
  | 'lab'
  | 'plan'

const ROUTE_OPTIONS = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Rectal', 'Inhaled', 'Sublingual'] as const
const FREQUENCY_OPTIONS = ['Stat', 'OD', 'BD', 'TDS', 'QDS', 'PRN'] as const

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
      phone_number?: string | null
      nrc_number?: string | null
      allergies?: string | null
    } | null
  }
  triage: Record<string, any> | null
  screening: Record<string, any> | null
  handover: {
    notes: string | null
    queued_by_name: string | null
    queued_at: string | null
  }
  pastEncounters: PastEncounter[]
  isReturnedEncounter: boolean
  returnedFromPharmacy: boolean
  returnTransition: {
    from_stage: string
    notes: string | null
    queued_by_name: string | null
    queued_at: string | null
  } | null
  defaultTab: TabId
  gynObsAlerts: { type: string; code: string; label: string; detail: string }[]
  vitalRechecks: {
    id: number
    weight: number | null
    height: number | null
    bp_systolic: number | null
    bp_diastolic: number | null
    pulse: number | null
    temperature: number | null
    spo2: number | null
    notes: string | null
    recorded_by: string | null
    recorded_at: string | null
  }[]
  pendingPharmacyRecommendations: PharmacyRecommendationRow[]
  wards: Ward[]
  currentWard: { id: number; name: string; type: string | null; location: string | null } | null
  startupMedications: StartupMed[]
  prescription: { id: number; prescription_number: string; items: PrescriptionItem[] } | null
  labRequest: {
    id: number
    request_number: string
    priority_level: string | null
    request_notes: string | null
    items: {
      id: number
      test_name: string
      test_group: string | null
      specimen_type: string | null
      instructions: string | null
    }[]
  } | null
  targetWing: string | null
  wardsWithBeds: WardWithBeds[]
  currentBed: {
    id: number
    bed_number: string
    ward_name: string | null
    wing: string | null
    admitted_at: string | null
  } | null
  canManageWard: boolean
  isAtScreening: boolean
  clinicalSuggestions: {
    fields: Record<string, { id: number; text: string; source?: Record<string, unknown> }[]>
    prescriptions: { id: number; items: Record<string, unknown>[]; source?: Record<string, unknown> }[]
  }
}>()

const s = props.screening ?? {}

const { showQueueHint, dismissQueueHint } = useQueueFooterHint('screening', props.encounter.id)

const queueActionsModalOpen = ref(false)
const reviewPanelOpen = ref(false)
const admitModalOpen = ref(false)
const medsDrawerOpen = ref(false)
const selectedBedId = ref<number | null>(null)
const medFlash = ref('')
const medFlashError = ref(false)
const medSearchResults = ref<MedSearchResult[]>([])
const medDropdownOpen = ref(false)
const dosageSuggestions = ref<string[]>([])
const returnTriageNotes = ref('')
const returnTriageExpanded = ref(false)
const treatmentRoomNotes = ref('')
type CurrentBed = {
  id: number
  bed_number: string
  ward_name: string | null
  wing: string | null
  admitted_at: string | null
}

const currentBed = ref<CurrentBed | null>(props.currentBed ? { ...props.currentBed } : null)
const wardsWithBeds = ref<WardWithBeds[]>(
  props.wardsWithBeds.map((ward) => ({
    ...ward,
    beds: ward.beds.map((bed) => ({ ...bed })),
  }))
)

watch(
  () => props.currentBed,
  (value) => {
    currentBed.value = value ? { ...value } : null
  }
)

watch(
  () => props.wardsWithBeds,
  (value) => {
    wardsWithBeds.value = value.map((ward) => ({
      ...ward,
      beds: ward.beds.map((bed) => ({ ...bed })),
    }))
  },
  { deep: true }
)

const activeTab = ref<TabId>(props.defaultTab)

function existingPrescriptionItemsForSync(): PrescriptionCartItem[] {
  return (props.prescription?.items ?? []).map((item) => ({
    drug_name: item.drug_name,
    formulation: item.formulation ?? '',
    dose: item.dose ?? '',
    item_per_dose: item.item_per_dose ?? 1,
    frequency: item.frequency ?? '',
    time_per: item.time_per ?? '',
    frequency_unit: item.frequency_unit ?? '',
    duration: item.duration ?? '',
    duration_unit: item.duration_unit ?? '',
    route: item.route ?? '',
    start_date: item.start_date ?? '',
    end_date: item.end_date ?? '',
    quantity_prescribed: item.quantity_prescribed ?? '',
    is_passer_by: item.is_passer_by ? '1' : '0',
    instructions: item.instructions ?? '',
  }))
}

function allPrescriptionItemsForSync() {
  const merged = existingPrescriptionItemsForSync()
  const seen = new Set(merged.map((item) => itemSignature(item)))

  for (const item of rxCart.value) {
    const signature = itemSignature(item)
    if (!seen.has(signature)) {
      merged.push(item)
      seen.add(signature)
    }
  }

  return merged
}

function itemSignature(item: Pick<PrescriptionCartItem, 'drug_name' | 'dose' | 'formulation'>) {
  return `${item.drug_name}|${item.dose}|${item.formulation}`
}

function syncPrescriptions() {
  const items = allPrescriptionItemsForSync()
  form.prescriptions = items.length ? JSON.stringify(items) : ''
}

function existingLabItemsForSync() {
  return (props.labRequest?.items ?? []).map((item) => ({
    test_name: item.test_name,
    test_code: null,
    specimen_type: item.specimen_type ?? null,
    lab_specimen_type_id: null,
    test_group: item.test_group ?? null,
    instructions: item.instructions ?? null,
  }))
}

function allLabItemsForSync() {
  const merged = existingLabItemsForSync()
  const seen = new Set(merged.map((item) => item.test_name))

  for (const item of labCart.value) {
    if (!seen.has(item.test_name)) {
      merged.push(item)
      seen.add(item.test_name)
    }
  }

  return merged
}

function syncLabItems() {
  const items = allLabItemsForSync()

  if (items.length) {
    form.lab_items = JSON.stringify(items)
    form.lab_requested = true
  } else {
    form.lab_items = ''
  }

  form.lab_priority_level = labPriority.value
  form.lab_request_notes = labRequestNotes.value
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
  removeFromCart: removeFromRxCart,
  clearCart: clearRxCart,
  openModal: openRxModal,
  closeModal: closeRxModal,
  closeDrugPopover: closeRxDrugPopover,
  computeQuantity: computeRxQuantity,
  setDrugActiveIdx: setRxDrugActiveIdx,
} = usePrescriptionCart(
  () => {
    syncPrescriptions()
  },
  {
    isAlreadyRequested: (signature) =>
      (props.prescription?.items ?? []).some(
        (item) => itemSignature(item) === signature
      ),
  }
)

const labPriority = ref(props.labRequest?.priority_level ?? 'normal')
const labRequestNotes = ref(props.labRequest?.request_notes ?? '')

const {
  cart: labCart,
  showModal: labModalOpen,
  draft: labDraft,
  showError: labFormError,
  errorMsg: labErrorMsg,
  testSearch: labTestSearch,
  testResults: labTestResults,
  testLoading: labTestLoading,
  testPopoverOpen: labTestPopoverOpen,
  testActiveIdx: labTestActiveIdx,
  debouncedTestSearch,
  searchTests: searchLabTests,
  onTestInput: onLabTestInput,
  selectTest: selectLabTest,
  moveTestActive: moveLabTestActive,
  pickTestActive: pickLabTestActive,
  addToCart: addToLabCart,
  removeFromCart: removeFromLabCart,
  clearCart: clearLabCart,
  openModal: openLabModal,
  closeModal: closeLabModal,
  closeTestPopover: closeLabTestPopover,
  setTestActiveIdx: setLabTestActiveIdx,
} = useLabCart(
  () => {
    syncLabItems()
    form.lab_requested = true
  },
  {
    isAlreadyRequested: (testName) =>
      props.labRequest?.items?.some((item) => item.test_name === testName) ?? false,
  }
)

function updateLabDraft(value: LabCartItem) {
  labDraft.value = value
}

const medications = ref<StartupMed[]>([...props.startupMedications])

const { loading: discharging, run: runDischarge } = useAsyncAction()
const { loading: admitting, run: runAdmit } = useAsyncAction()
const { loading: addingMed, run: runAddMed } = useAsyncAction()
const { loading: recommendingMed, run: runRecommendMed } = useAsyncAction()
const { processingId: removingMedId, runFor: runRemoveMed } = useAsyncAction<number>()
const { loading: queueingTreatment, run: runQueueTreatment } = useAsyncAction()
const { loading: queueingTriage, run: runQueueTriage } = useAsyncAction()
const { processingId: decidingUrl, runFor: runDecision } = useAsyncAction<string>()

watch(
  () => props.labRequest,
  (value) => {
    if (value?.priority_level) labPriority.value = value.priority_level
    if (value?.request_notes !== undefined && value?.request_notes !== null) {
      labRequestNotes.value = value.request_notes
    }
  },
  { deep: true }
)

const form = useForm({
  complaints: s.complaints ?? '',
  tb_symptoms: (s.tb_symptoms as string[]) ?? [],
  constitutional_symptoms: s.constitutional_symptoms ?? '',
  presumptive_tb_case_no: s.presumptive_tb_case_no ?? '',
  review_of_systems: s.review_of_systems ?? '',
  history_of_presenting_illness: s.history_of_presenting_illness ?? '',
  past_medical_history: s.past_medical_history ?? '',
  medication_history: s.medication_history ?? '',
  allergy_history: s.allergy_history ?? '',
  chronic_conditions: s.chronic_conditions ?? '',
  family_history: s.family_history ?? '',
  social_history: s.social_history ?? '',
  birth_weight: s.birth_weight ?? null,
  birth_length: s.birth_length ?? null,
  head_circumference: s.head_circumference ?? null,
  chest_circumference: s.chest_circumference ?? null,
  general_condition: s.general_condition ?? '',
  is_breast_feeding_well: s.is_breast_feeding_well ?? false,
  other_feeding_option: s.other_feeding_option ?? '',
  delivery_time: s.delivery_time ?? '',
  vaccination_outside: s.vaccination_outside ?? '',
  tetanus_at_birth: s.tetanus_at_birth ?? '',
  birth_outcome: s.birth_outcome ?? '',
  birth_notes: s.birth_notes ?? '',
  immunization_history: s.immunization_history ?? '',
  feeding_code: s.feeding_code ?? '',
  feeding_comments: s.feeding_comments ?? '',
  development_history: s.development_history ?? '',
  physical_examination: s.physical_examination ?? '',
  clinical_findings: s.clinical_findings ?? '',
  provisional_diagnosis: s.provisional_diagnosis ?? '',
  final_diagnosis: s.final_diagnosis ?? '',
  assessment_notes: s.assessment_notes ?? '',
  plan: s.plan ?? '',
  treatment_plan: s.treatment_plan ?? '',
  lab_requested: s.lab_requested ?? false,
  prescriptions: '',
  lab_items: '',
  lab_priority_level: props.labRequest?.priority_level ?? 'normal',
  lab_request_notes: props.labRequest?.request_notes ?? '',
  notes: '',
  menstrual_cycle_regularity: s.menstrual_cycle_regularity ?? null,
  cycle_length_days: s.cycle_length_days ?? null,
  duration_of_flow_days: s.duration_of_flow_days ?? null,
  last_menstrual_period: s.last_menstrual_period ?? null,
  dysmenorrhoea: s.dysmenorrhoea ?? null,
  intermenstrual_bleeding: s.intermenstrual_bleeding ?? null,
  post_coital_bleeding: s.post_coital_bleeding ?? null,
  menstrual_notes: s.menstrual_notes ?? '',
  gravida: s.gravida ?? null,
  para: s.para ?? null,
  abortus: s.abortus ?? null,
  living_children: s.living_children ?? null,
  currently_pregnant: s.currently_pregnant ?? null,
  expected_delivery_date: s.expected_delivery_date ?? null,
  previous_obstetric_complications: s.previous_obstetric_complications ?? '',
  obstetrics_notes: s.obstetrics_notes ?? '',
  using_contraception: s.using_contraception ?? null,
  contraceptive_method: s.contraceptive_method ?? null,
  contraceptive_method_other: s.contraceptive_method_other ?? '',
  contraceptive_duration_months: s.contraceptive_duration_months ?? null,
  previous_contraceptive_methods: s.previous_contraceptive_methods ?? '',
  contraceptive_notes: s.contraceptive_notes ?? '',
  cervical_screening_done: s.cervical_screening_done ?? null,
  cervical_screening_date: s.cervical_screening_date ?? null,
  cervical_screening_method: s.cervical_screening_method ?? null,
  cervical_screening_result: s.cervical_screening_result ?? null,
  cervical_screening_result_notes: s.cervical_screening_result_notes ?? '',
  cervical_treatment_done: s.cervical_treatment_done ?? null,
  cervical_treatment_type: s.cervical_treatment_type ?? '',
  cervical_cancer_notes: s.cervical_cancer_notes ?? '',
})

const recheck = useForm({
  weight: null as number | null,
  height: null as number | null,
  bp_systolic: null as number | null,
  bp_diastolic: null as number | null,
  pulse: null as number | null,
  temperature: null as number | null,
  spo2: null as number | null,
  notes: '',
})

type VitalRecheckRow = {
  id: number
  weight: number | null
  height: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  temperature: number | null
  spo2: number | null
  notes: string | null
  recorded_by: string | null
  recorded_at: string | null
}

const rechecksList = ref<VitalRecheckRow[]>([...props.vitalRechecks])
const currentRecheckId = ref<number | null>(null)

watch(
  () => props.vitalRechecks,
  (value) => {
    rechecksList.value = [...value]
  },
  { deep: true }
)

const recheckBmiDisplay = ref('')

function calculateRecheckBmi() {
  const weight = Number(recheck.weight)
  const height = Number(recheck.height)

  if (!weight || !height || height <= 0) {
    recheckBmiDisplay.value = ''
    return
  }

  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  recheckBmiDisplay.value = bmi.toFixed(1)
}

watch([() => recheck.weight, () => recheck.height], calculateRecheckBmi)

function defaultAdministeredAt() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

const medForm = ref({
  medication_id: '' as string | number,
  medication_name: '',
  dosage: '',
  route: '',
  frequency: '',
  notes: '',
  administered_at: defaultAdministeredAt(),
})

let medSearchTimer: ReturnType<typeof setTimeout> | null = null

const dimmerVisible = computed(
  () =>
    reviewPanelOpen.value ||
    admitModalOpen.value ||
    medsDrawerOpen.value ||
    queueActionsModalOpen.value ||
    rxModalOpen.value ||
    labModalOpen.value
)

const completeActionLabel = computed(() =>
  form.lab_requested ? 'Save & Submit to Lab' : 'Complete Screening'
)

const showEditableForm = computed(() => props.isAtScreening && props.encounter.can_edit)

const recheckBmiBadge = computed(() => computeBmiBadge(recheckBmiDisplay.value))

const recheckVitalBadges = computed(() => ({
  bp_systolic: systolicBpBadge(recheck.bp_systolic),
  bp_diastolic: diastolicBpBadge(recheck.bp_diastolic),
  pulse: pulseBadge(recheck.pulse),
  temperature: temperatureBadge(recheck.temperature),
  spo2: oxygenSaturationBadge(recheck.spo2),
}))

function screeningPayload() {
  syncPrescriptions()
  syncLabItems()
  return form.data()
}

const { status: autosaveStatus, indicatorText: autosaveText } = useAutosave({
    url: `/screening/${props.encounter.id}/save-draft`,
    getPayload: screeningPayload,
    enabled: showEditableForm,
    watchSource: computed(() => ({
      form: form.data(),
      rxCart: rxCart.value,
      labCart: labCart.value,
      labPriority: labPriority.value,
      labRequestNotes: labRequestNotes.value,
    })),
    onSaved(payload) {
      const prescriptions = payload.prescriptions
      if (typeof prescriptions === 'string' && prescriptions.length > 0) {
        clearRxCart()
        router.reload({ only: ['prescription'] })
      }
      const labItems = payload.lab_items
      if (typeof labItems === 'string' && labItems.length > 0 && labCart.value.length > 0) {
        clearLabCart()
        router.reload({ only: ['labRequest', 'screening'] })
      }
    },
  })

function recheckHasValue() {
  return [
    recheck.weight,
    recheck.height,
    recheck.bp_systolic,
    recheck.bp_diastolic,
    recheck.pulse,
    recheck.temperature,
    recheck.spo2,
  ].some((value) => value !== null && value !== '') || recheck.notes.trim().length > 0
}

const { status: recheckStatus, indicatorText: recheckText } = useAutosave({
  url: `/screening/${props.encounter.id}/vital-recheck/autosave`,
  enabled: showEditableForm,
  getPayload: () => {
    if (!recheckHasValue()) return null
    const raw = recheck.data() as Record<string, unknown>
    const numericKeys = ['weight', 'height', 'bp_systolic', 'bp_diastolic', 'pulse', 'temperature', 'spo2']
    const cleaned: Record<string, unknown> = { id: currentRecheckId.value }
    for (const [key, value] of Object.entries(raw)) {
      if (numericKeys.includes(key)) {
        cleaned[key] = value === '' || value === null || value === undefined ? null : Number(value)
      } else {
        cleaned[key] = value
      }
    }
    return cleaned
  },
  watchSource: computed(() => recheck.data()),
  onSaved(_payload, response) {
    const row = response?.recheck as VitalRecheckRow | null | undefined
    if (!row) return
    currentRecheckId.value = row.id
    const idx = rechecksList.value.findIndex((r) => r.id === row.id)
    if (idx >= 0) rechecksList.value.splice(idx, 1, row)
    else rechecksList.value.unshift(row)
  },
})

const patientAge = computed(() => {
  const dob = props.encounter.patient?.date_of_birth
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--
  return years
})

const showGynObsTab = computed(() => {
  const g = String(props.encounter.patient?.gender ?? '').toLowerCase()
  return g === 'female' || g === 'f'
})

const showPaediatricTab = computed(() => patientAge.value !== null && patientAge.value <= 5)

const activeMedCount = computed(
  () => medications.value.filter((m) => m.status === 'active').length
)

const discontinuedMedCount = computed(
  () => medications.value.filter((m) => m.status === 'discontinued').length
)

const availableBedsCount = computed(() =>
  wardsWithBeds.value.reduce(
    (sum, ward) => sum + ward.beds.filter((bed) => bed.status === 'available').length,
    0
  )
)


function stageText(stage: string) {
  const withSpaces = stage.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

function priorityText(priority: string | null) {
  if (!priority) return 'Normal'
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function bloodPressure(systolic: number | null | undefined, diastolic: number | null | undefined) {
  if (systolic && diastolic) return `${systolic}/${diastolic} mmHg`
  return '—'
}

function pastVitalCards(triage: Record<string, any> | null) {
  if (!triage) return []
  return [
    { label: 'Weight', value: triage.weight ? `${triage.weight} kg` : '—' },
    { label: 'Height', value: triage.height ? `${triage.height} cm` : '—' },
    { label: 'BMI', value: triage.bmi ?? '—' },
    { label: 'Temp', value: triage.temperature ? `${triage.temperature} °C` : '—' },
    { label: 'Pulse', value: triage.pulse ? `${triage.pulse} bpm` : '—' },
    { label: 'RR', value: triage.respiratory_rate ? `${triage.respiratory_rate}/min` : '—' },
    { label: 'BP', value: bloodPressure(triage.systolic_bp, triage.diastolic_bp) },
    { label: 'O₂ Sat', value: triage.oxygen_saturation ? `${triage.oxygen_saturation}%` : '—' },
    { label: 'MUAC', value: triage.muac ? `${triage.muac} cm` : '—' },
  ]
}

function formatRxFrequency(item: {
  frequency?: string | number | null
  frequency_unit?: string | null
  time_per?: string | null
}) {
  if (item.frequency_unit) {
    return item.time_per
      ? `${item.frequency_unit} · ${item.time_per}`
      : item.frequency_unit
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

async function complete() {
  dismissQueueHint()
  syncPrescriptions()
  syncLabItems()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  form.post(`/screening/${props.encounter.id}/complete`, {
    onSuccess: () => {
      clearRxCart()
      clearLabCart()
    },
  })
}

function setPharmacyDisposition() {
  if (
    form.lab_requested &&
    (labCart.value.length > 0 || (props.labRequest?.items?.length ?? 0) > 0) &&
    !confirm('Switching to Pharmacy will not queue lab tests. Continue?')
  ) {
    return
  }
  form.lab_requested = false
}

function setLabDisposition() {
  form.lab_requested = true
  activeTab.value = 'lab'
}

function newRecheck() {
  recheck.reset()
  recheckBmiDisplay.value = ''
  currentRecheckId.value = null
}

async function queueTreatmentRoom() {
  dismissQueueHint()
  syncPrescriptions()
  syncLabItems()
  if (!(await flushAutosavesBeforeAction())) return
  runQueueTreatment(({ done }) => {
    router.post(
      `/screening/${props.encounter.id}/queue-treatment-room`,
      { notes: treatmentRoomNotes.value || null },
      { onFinish: done }
    )
  })
}

async function queueTriage() {
  dismissQueueHint()
  syncPrescriptions()
  syncLabItems()
  if (!(await flushAutosavesBeforeAction())) return
  runQueueTriage(({ done }) => {
    router.post(
      `/screening/${props.encounter.id}/queue-triage`,
      { notes: returnTriageNotes.value || null },
      {
        onFinish: () => {
          returnTriageExpanded.value = false
          returnTriageNotes.value = ''
          done()
        },
      }
    )
  })
}

function openReturnTriageForm() {
  returnTriageExpanded.value = true
}

function cancelReturnTriage() {
  returnTriageExpanded.value = false
  returnTriageNotes.value = ''
}

function decision(url: string, message: string) {
  if (!confirm(message)) return
  runDecision(url, ({ done }) => {
    router.post(url, {}, { onFinish: done })
  })
}

function toggleReviewPanel() {
  reviewPanelOpen.value = !reviewPanelOpen.value
}

function closeReviewPanel() {
  reviewPanelOpen.value = false
}

function openAdmitModal() {
  admitModalOpen.value = true
  selectedBedId.value = currentBed.value?.id ?? null
  document.body.style.overflow = 'hidden'
}

function closeAdmitModal() {
  admitModalOpen.value = false
  document.body.style.overflow = ''
  selectedBedId.value = null
}

function openMedsDrawer() {
  medsDrawerOpen.value = true
}

function closeMedsDrawer() {
  medsDrawerOpen.value = false
}

function openQueueActionsModal() {
  queueActionsModalOpen.value = true
}

function onScreeningSuggestionApplied() {
  // Autosave watchSource picks up form changes.
}

function addSuggestedPrescriptions(items: PrescriptionCartItem[]) {
  for (const item of items) {
    if (!item.drug_name.trim()) continue
    const sig = `${item.drug_name}|${item.dose}|${item.formulation}`
    if (rxCart.value.some((existing) => `${existing.drug_name}|${existing.dose}|${existing.formulation}` === sig)) {
      continue
    }
    rxCart.value.push(item)
  }
}

function applyAllScreeningClinical(updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (key in form) {
      ;(form as any)[key] = value
    }
  }
}

function closeQueueActionsModal() {
  queueActionsModalOpen.value = false
}

function closeAllOverlays() {
  closeAdmitModal()
  closeReviewPanel()
  closeMedsDrawer()
  closeQueueActionsModal()
  closeRxModal()
  closeLabModal()
}

function onEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape') closeAllOverlays()
}

function applyAdmitResult(bed: CurrentBed) {
  const patientName = props.encounter.patient?.full_name ?? null
  const encounterId = props.encounter.id
  const previousBedId = currentBed.value?.id

  wardsWithBeds.value = wardsWithBeds.value.map((ward) => ({
    ...ward,
    beds: ward.beds.map((item) => {
      if (previousBedId && item.id === previousBedId && item.id !== bed.id) {
        return {
          ...item,
          status: 'available',
          encounter_id: null,
          patient_name: null,
        }
      }
      if (item.id === bed.id) {
        return {
          ...item,
          status: 'occupied',
          encounter_id: encounterId,
          patient_name: patientName,
        }
      }
      return item
    }),
  }))

  currentBed.value = { ...bed }
}

function applyDischargeResult() {
  const previousBedId = currentBed.value?.id
  if (!previousBedId) return

  wardsWithBeds.value = wardsWithBeds.value.map((ward) => ({
    ...ward,
    beds: ward.beds.map((item) => {
      if (item.id === previousBedId) {
        return {
          ...item,
          status: 'available',
          encounter_id: null,
          patient_name: null,
        }
      }
      return item
    }),
  }))

  currentBed.value = null
}

function selectBed(bed: Bed) {
  const isMyBed = currentBed.value?.id === bed.id
  if (bed.status !== 'available' && !isMyBed) return
  selectedBedId.value = bed.id
}

function bedCardClasses(bed: Bed) {
  const isMyBed = currentBed.value?.id === bed.id
  const map: Record<string, string> = {
    available:
      'bg-emerald-50 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100 cursor-pointer dark:bg-emerald-950/30 dark:border-emerald-700',
    occupied: isMyBed
      ? 'bg-emerald-100 border-emerald-500 cursor-pointer ring-2 ring-emerald-400 dark:bg-emerald-950/40'
      : 'bg-red-50 border-red-300 cursor-not-allowed opacity-75 dark:bg-red-950/30',
    reserved: 'bg-amber-50 border-amber-300 cursor-not-allowed opacity-75',
    maintenance: 'bg-neutral-100 border-neutral-300 cursor-not-allowed opacity-60 dark:bg-neutral-800',
  }
  return map[bed.status] ?? 'bg-neutral-50 border-neutral-300 dark:bg-neutral-800'
}

function bedStatusLabel(bed: Bed) {
  const isMyBed = currentBed.value?.id === bed.id
  const map: Record<string, string> = {
    available: 'Available',
    occupied: isMyBed ? 'This patient' : 'Occupied',
    reserved: 'Reserved',
    maintenance: 'Maintenance',
  }
  return map[bed.status] ?? bed.status
}

function bedDotClass(status: string) {
  const map: Record<string, string> = {
    available: 'bg-emerald-500',
    occupied: 'bg-red-500',
    reserved: 'bg-amber-500',
    maintenance: 'bg-neutral-400',
  }
  return map[status] ?? 'bg-neutral-400'
}

function selectedBedLabel() {
  if (!selectedBedId.value) return null
  for (const ward of wardsWithBeds.value) {
    const bed = ward.beds.find((b) => b.id === selectedBedId.value)
    if (bed) return bed.bed_number
  }
  return null
}

function confirmDischarge() {
  if (!confirm('Discharge this patient and free the bed?')) return
  runDischarge(async () => {
    const res = await fetch(`/screening/${props.encounter.id}/discharge`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': readXsrfToken() },
    })
    const data = await res.json()
    if (data.ok) {
      applyDischargeResult()
    } else {
      alert(data.message || 'Discharge failed.')
    }
  })
}

function confirmAdmit() {
  if (!selectedBedId.value) return
  runAdmit(async () => {
    const res = await fetch(`/screening/${props.encounter.id}/admit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-XSRF-TOKEN': readXsrfToken(),
      },
      body: JSON.stringify({ bed_id: selectedBedId.value }),
    })
    const data = await res.json()
    if (data.ok && data.bed) {
      applyAdmitResult(data.bed)
      closeAdmitModal()
    } else {
      alert(data.message || 'Could not admit patient.')
    }
  })
}

function showMedFlash(message: string, isError = false) {
  medFlash.value = message
  medFlashError.value = isError
  window.setTimeout(() => {
    medFlash.value = ''
    medFlashError.value = false
  }, isError ? 4000 : 3000)
}

function resetMedForm() {
  medForm.value = {
    medication_id: '',
    medication_name: '',
    dosage: '',
    route: '',
    frequency: '',
    notes: '',
    administered_at: defaultAdministeredAt(),
  }
  dosageSuggestions.value = []
  medSearchResults.value = []
  medDropdownOpen.value = false
}

async function submitStartupMed(mode: 'add' | 'recommend') {
  if (!medForm.value.medication_name.trim()) return
  const payload = {
    medication_id: medForm.value.medication_id ? Number(medForm.value.medication_id) : null,
    medication_name: medForm.value.medication_name.trim(),
    dosage: medForm.value.dosage || null,
    route: medForm.value.route || null,
    frequency: medForm.value.frequency || null,
    notes: medForm.value.notes || null,
    administered_at: medForm.value.administered_at || null,
  }
  if (mode === 'recommend') {
    runRecommendMed(({ done }) => {
      router.post(`/triage/${props.encounter.id}/startup-medications/recommend`, payload, { onFinish: done })
    })
    return
  }
  runAddMed(async () => {
    try {
      const res = await fetch(`/triage/${props.encounter.id}/startup-medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        showMedFlash(`✗ ${formatApiErrors(data, 'Failed to save medication.')}`, true)
        return
      }
      if (data?.success && data.med) {
        medications.value.push({
          id: data.med.id,
          medication_name: data.med.medication_name,
          dosage: data.med.dosage,
          route: data.med.route,
          frequency: data.med.frequency,
          notes: data.med.notes,
          source: data.med.source ?? 'screening',
          status: data.med.status ?? 'active',
          administered_at: data.med.administered_at,
          recorded_by: data.med.recorded_by,
        })
        showMedFlash(`✓ ${data.med.medication_name} added`)
        resetMedForm()
      }
    } catch {
      showMedFlash('✗ Failed to save medication.', true)
    }
  })
}

function removeMedication(id: number) {
  if (!confirm('Remove this medication?')) return
  runRemoveMed(id, async () => {
    try {
      const res = await fetch(`/triage/startup-medications/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': readXsrfToken() },
      })
      const data = await res.json()
      if (data.success) medications.value = medications.value.filter((m) => m.id !== id)
      else alert('Failed to remove medication.')
    } catch {
      alert('Failed to remove medication.')
    }
  })
}

function onMedSearchInput() {
  medForm.value.medication_id = ''
  const q = medForm.value.medication_name.trim()
  if (medSearchTimer) clearTimeout(medSearchTimer)
  if (q.length < 2) {
    medSearchResults.value = []
    medDropdownOpen.value = false
    return
  }
  medSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/medications/search?q=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json' },
      })
      const results = (await res.json()) as MedSearchResult[]
      medSearchResults.value = results
      medDropdownOpen.value = results.length > 0
    } catch {
      medSearchResults.value = []
      medDropdownOpen.value = false
    }
  }, 250)
}

function selectMedication(result: MedSearchResult) {
  medForm.value.medication_id = result.id
  medForm.value.medication_name = `${result.name}${result.strength ? ` ${result.strength}` : ''} (${result.form})`
  if (result.strength) medForm.value.dosage = result.strength
  if (result.default_route) medForm.value.route = result.default_route
  if (result.default_frequency) medForm.value.frequency = result.default_frequency
  dosageSuggestions.value = result.strength ? [result.strength] : []
  medDropdownOpen.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-med-search]')) medDropdownOpen.value = false
}

onMounted(() => {
  const tab = new URLSearchParams(window.location.search).get('tab')
  if (tab === 'lab') activeTab.value = 'lab'
  document.addEventListener('keydown', onEscapeKey)
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onEscapeKey)
  document.removeEventListener('click', onDocumentClick)
  document.body.style.overflow = ''
})
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/screening/queue" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">Screening</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ encounter.encounter_number }}</span>
    </template>

    <template #navbar-extras>
      <div class="triage-review-clip w-full" :class="reviewPanelOpen ? 'is-open' : ''">
        <div class="triage-review-panel pointer-events-auto w-full">
          <div class="triage-review-tabbar flex justify-center">
            <button type="button" class="triage-review-tab -mt-[1px] inline-flex items-center gap-2 rounded-b-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-neutral-800" @click.stop="toggleReviewPanel">
              <svg class="h-4 w-4 transition-transform" :class="reviewPanelOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              Passed Screening Review
            </button>
          </div>
          <div class="triage-review-body theme-surface w-full border-b border-neutral-200">
            <div class="mx-auto max-h-[50vh] w-full max-w-6xl overflow-y-auto">
              <div class="space-y-6 p-6">
                <div class="flex items-center justify-between gap-4">
                  <h2 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">Passed Screening Review — Previous Encounters</h2>
                  <button type="button" class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800" @click="closeReviewPanel">
                    <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div v-if="!pastEncounters.length" class="py-8 text-center"><p class="text-sm text-neutral-400">No previous encounters for this patient</p></div>
                <div v-for="past in pastEncounters" :key="past.id" class="overflow-hidden rounded-lg border border-neutral-200">
                  <div class="flex items-center justify-between bg-neutral-50 px-4 py-3 dark:bg-neutral-800">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-sm font-bold text-neutral-900 dark:text-white">{{ past.encounter_number }}</span>
                      <span class="text-xs text-neutral-500">{{ past.visit_type ?? 'OPD' }} · {{ priorityText(past.priority) }}</span>
                    </div>
                    <span class="text-xs text-neutral-400">{{ past.started_at }}</span>
                  </div>
                  <div class="space-y-4 p-4">
                    <template v-if="past.triage">
                      <div>
                        <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Vital Signs</h4>
                        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                          <div v-for="card in pastVitalCards(past.triage)" :key="card.label" class="rounded bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800">
                            <div class="text-sm font-bold text-neutral-900 dark:text-white">{{ card.value }}</div>
                            <div class="text-[10px] text-neutral-500">{{ card.label }}</div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <div v-if="past.screening">
                      <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Screening Summary</h4>
                      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div v-if="past.screening.complaints" class="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
                          <p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Complaints</p>
                          <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ past.screening.complaints }}</p>
                        </div>
                        <div v-if="formatDiagnosisLabel(past.screening.provisional_diagnosis)" class="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
                          <p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Provisional Dx</p>
                          <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ formatDiagnosisLabel(past.screening.provisional_diagnosis) }}</p>
                        </div>
                      </div>
                    </div>
                    <div v-if="past.startup_medications.length">
                      <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Startup Medications ({{ past.startup_medications.length }})</h4>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead><tr class="bg-neutral-50 text-left dark:bg-neutral-800"><th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Medication</th><th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Dosage</th><th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Route</th><th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Frequency</th></tr></thead>
                          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                            <tr v-for="med in past.startup_medications" :key="med.id">
                              <td class="px-2 py-1.5 font-medium text-neutral-900 dark:text-white">{{ med.medication_name }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.dosage ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.route ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.frequency ?? '—' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="encounter.is_locked" class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">This encounter is locked. Clinical edits are restricted until it is reopened.</div>

    <div v-if="isReturnedEncounter && returnTransition" class="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <div class="font-semibold">Return Encounter</div>
      <div class="mt-1">This encounter was returned to Screening from <span class="font-semibold">{{ stageText(returnTransition.from_stage) }}</span>.</div>
      <div v-if="returnTransition.notes" class="mt-1">Reason: {{ returnTransition.notes }}</div>
      <div v-if="returnTransition.queued_by_name || returnTransition.queued_at" class="mt-1 text-amber-700 dark:text-amber-300">
        <span v-if="returnTransition.queued_by_name">Returned by {{ returnTransition.queued_by_name }}</span>
        <span v-if="returnTransition.queued_by_name && returnTransition.queued_at"> · </span>
        <span v-if="returnTransition.queued_at">{{ returnTransition.queued_at }}</span>
      </div>
    </div>

    <div
      v-if="isAtScreening && encounter.can_edit && !encounter.is_locked"
      class="return-triage-callout mb-4 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm dark:border-amber-800/60 dark:bg-neutral-900"
    >
      <div class="flex flex-wrap items-start gap-4 p-4 sm:items-center">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </span>

        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-neutral-900 dark:text-white">Vitals need updating?</div>
          <p class="mt-0.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            Send the patient back to <span class="font-medium text-neutral-800 dark:text-neutral-200">Triage</span> for a vitals recheck before continuing screening.
          </p>
        </div>

        <button
          v-if="!returnTriageExpanded"
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
          @click="openReturnTriageForm"
        >
          Return to Triage
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div
        v-if="returnTriageExpanded"
        class="border-t border-amber-100 bg-amber-50/40 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20"
      >
        <label class="field-label text-[11px] uppercase tracking-wide text-amber-900 dark:text-amber-200">
          Handover note <span class="font-normal normal-case text-neutral-500">(optional)</span>
        </label>
        <textarea
          v-model="returnTriageNotes"
          rows="2"
          maxlength="500"
          class="field-input mt-1.5 text-sm"
          placeholder="e.g. BP re-check needed, weight was estimated, SpO₂ not recorded…"
        />
        <p class="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          The patient will leave screening and re-enter the triage queue. Any unsaved screening changes should be saved first.
        </p>
        <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
            @click="cancelReturnTriage"
          >
            Cancel
          </button>
          <ActionButton
            variant="outline"
            class="!border-amber-400 !bg-amber-100 !px-3.5 !py-2 text-xs !text-amber-900 hover:!bg-amber-200 dark:!border-amber-700 dark:!bg-amber-950/40 dark:!text-amber-100"
            :loading="queueingTriage"
            loading-text="Returning…"
            @click="queueTriage"
          >
            Confirm return to Triage
          </ActionButton>
        </div>
      </div>
    </div>

    <PatientHeader :encounter="encounter" :triage="triage" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="space-y-4 lg:col-span-3 lg:order-2">
        <HandoverNotesCard :handover="handover" />

        <!-- Ward Admission -->
        <div
          v-if="isAtScreening"
          class="theme-surface overflow-hidden rounded-2xl shadow-sm"
        >
          <div class="theme-card-header flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700">
                <svg class="h-5 w-5 text-neutral-600 dark:text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-semibold leading-none text-neutral-900 dark:text-white">Ward Admission</h2>
                <p class="mt-1 text-xs text-neutral-500">Bed assignment during screening</p>
              </div>
            </div>
            <WardWingBadge :wing="targetWing" />
          </div>

          <div class="p-5">
            <div v-if="currentBed" class="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
              <div class="flex items-start gap-2">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
                <div>
                  <p class="text-sm font-bold text-neutral-900 dark:text-white">Patient Admitted</p>
                  <p class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                    {{ currentBed.ward_name ?? '—' }} · {{ currentBed.bed_number }}
                    · <span class="font-medium">{{ currentBed.admitted_at }}</span>
                  </p>
                </div>
              </div>
              <div v-if="canManageWard && showEditableForm" class="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  class="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-white dark:text-neutral-100 dark:hover:bg-neutral-700"
                  @click="openAdmitModal"
                >
                  Change Bed
                </button>
                <ActionButton
                  variant="danger"
                  class="!px-3 !py-2 text-xs"
                  :loading="discharging"
                  loading-text="Discharging…"
                  @click="confirmDischarge"
                >
                  Discharge
                </ActionButton>
              </div>
            </div>

            <div
              v-else-if="targetWing"
              class="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-4 dark:from-neutral-800 dark:to-neutral-800"
            >
              <p class="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-200">
                Assign this patient to an available bed in the
                <span class="font-semibold text-neutral-900 dark:text-white">{{ targetWing }} Wing</span>.
              </p>
              <p class="mt-1.5 text-xs text-neutral-500">Use the bed map to select an available bed.</p>
              <div v-if="canManageWard && showEditableForm" class="mt-4">
                <button
                  type="button"
                  class="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 sm:w-auto"
                  @click="openAdmitModal"
                >
                  <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  Admit to Ward
                </button>
              </div>
            </div>

            <div v-else class="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p class="text-sm text-amber-800">
                Patient gender is not set; update the patient profile to enable ward admission.
              </p>
            </div>

            <p v-if="!canManageWard" class="mt-2 text-xs text-neutral-400">
              You have view-only ward access in screening.
            </p>
          </div>
        </div>

        <div class="theme-surface rounded-lg shadow-sm">
          <div class="flex items-center justify-between theme-card-header px-4 py-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">Startup Medications</h3>
            <button type="button" class="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-neutral-800" @click.stop="openMedsDrawer">
              View List
              <span v-if="activeMedCount > 0" class="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-neutral-900">{{ activeMedCount }}</span>
            </button>
          </div>
          <div v-if="showEditableForm">
            <form @submit.prevent="submitStartupMed('add')">
              <div class="space-y-2 px-4 py-3">
                <div class="relative" data-med-search>
                  <label class="field-label">Medication Name <span class="text-red-500">*</span></label>
                  <input v-model="medForm.medication_name" type="text" class="field-input text-xs" placeholder="Start typing to search…" required autocomplete="off" @input="onMedSearchInput" />
                  <div v-if="medDropdownOpen" class="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto theme-surface rounded-lg shadow-lg">
                    <button v-for="result in medSearchResults" :key="result.id" type="button" class="block w-full border-b border-neutral-50 px-4 py-2 text-left last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-700" @click="selectMedication(result)">
                      <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ result.name }} {{ result.strength }}</p>
                      <p class="text-xs text-neutral-500">{{ result.generic_name ?? '' }} · {{ result.form }}</p>
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div><label class="field-label">Dosage</label><input v-model="medForm.dosage" type="text" class="field-input text-xs" /></div>
                  <div><label class="field-label">Route</label><select v-model="medForm.route" class="field-input text-xs"><option value="">--Select--</option><option v-for="route in ROUTE_OPTIONS" :key="route" :value="route">{{ route }}</option></select></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div><label class="field-label">Frequency</label><select v-model="medForm.frequency" class="field-input text-xs"><option value="">--Select--</option><option v-for="freq in FREQUENCY_OPTIONS" :key="freq" :value="freq">{{ freq }}</option></select></div>
                  <div><label class="field-label">Given At</label><input v-model="medForm.administered_at" type="datetime-local" class="field-input text-xs" /></div>
                </div>
              </div>

              <div class="border-t border-neutral-200 px-4 py-3">
                <div class="grid grid-cols-2 gap-2">
                  <ActionButton type="submit" class="w-full !rounded !px-3 !py-2.5 text-sm" :loading="addingMed" loading-text="Adding…">
                    <template #icon>
                      <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </template>
                    Add
                  </ActionButton>
                  <ActionButton type="button" variant="blue" class="w-full !rounded !px-3 !py-2.5 text-sm" :loading="recommendingMed" loading-text="Saving…" @click="submitStartupMed('recommend')">
                    <template #icon>
                      <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </template>
                    Recommend
                  </ActionButton>
                </div>
                <div v-if="medFlash" class="mt-2.5 rounded px-3 py-2 text-xs font-medium" :class="medFlashError ? 'border border-red-300 bg-red-50 text-red-800' : 'border border-neutral-300 bg-neutral-100 text-neutral-800'">{{ medFlash }}</div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="lg:col-span-9 lg:order-1">
        <form class="theme-surface rounded-lg shadow-sm" @submit.prevent="complete">
          <div class="stage-tab-nav-sticky stage-tab-nav-sticky--card">
            <div
              v-if="showEditableForm && activeTab !== 'vital-recheck'"
              class="mx-6 mt-5 flex justify-end"
            >
              <AutosaveIndicator :status="autosaveStatus" :text="autosaveText" />
            </div>
            <div class="tab-nav mx-6 mb-2" :class="showEditableForm && activeTab !== 'vital-recheck' ? 'mt-2' : 'mt-5'">
            <button type="button" class="tab-btn" :class="activeTab === 'complaints' ? 'active' : ''" @click="activeTab = 'complaints'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Complaints & Histories
            </button>
            <button v-if="showGynObsTab" type="button" class="tab-btn" :class="activeTab === 'gynobs' ? 'active' : ''" @click="activeTab = 'gynobs'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Gyn & OBS
            </button>
            <button v-if="showPaediatricTab" type="button" class="tab-btn" :class="activeTab === 'paediatric' ? 'active' : ''" @click="activeTab = 'paediatric'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Paediatric History
            </button>
            <button type="button" class="tab-btn" :class="activeTab === 'examination' ? 'active' : ''" @click="activeTab = 'examination'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Exam & Dx
            </button>
            <button type="button" class="tab-btn" :class="activeTab === 'vital-recheck' ? 'active' : ''" @click="activeTab = 'vital-recheck'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Vital Recheck
            </button>
            <button type="button" class="tab-btn" :class="activeTab === 'prescription' ? 'active' : ''" @click="activeTab = 'prescription'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Prescription Requests
            </button>
            <button type="button" class="tab-btn" :class="activeTab === 'lab' ? 'active' : ''" @click="activeTab = 'lab'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Lab Request
            </button>
            <button type="button" class="tab-btn" :class="activeTab === 'plan' ? 'active' : ''" @click="activeTab = 'plan'">
              <svg class="tab-btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Plan
            </button>
          </div>
          </div>

          <!-- complaints tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'complaints' ? 'active' : ''">
            <ComplaintsHistoriesTab v-model="form" :disabled="!showEditableForm" />
          </div>

          <!-- gynobs tab -->
          <div v-if="showGynObsTab" class="tab-panel p-6" :class="activeTab === 'gynobs' ? 'active' : ''">
            <GynObsTab v-model="form" :disabled="!showEditableForm" :alerts="gynObsAlerts" />
          </div>

          <!-- paediatric tab -->
          <div v-if="showPaediatricTab" class="tab-panel space-y-4 p-6" :class="activeTab === 'paediatric' ? 'active' : ''">
            <PaediatricTab v-model="form" :disabled="!showEditableForm" />
          </div>

          <!-- examination tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'examination' ? 'active' : ''">
            <ExaminationTab
              v-model="form"
              :disabled="!showEditableForm"
              :diagnosis-suggestions="clinicalSuggestions.fields.provisional_diagnosis ?? []"
              @suggestion-applied="onScreeningSuggestionApplied"
            />
          </div>

          <!-- vital-recheck tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'vital-recheck' ? 'active' : ''">
            <div v-if="triage" class="section-card bg-neutral-50">
              <div class="section-card-title">Triage baseline (read-only)</div>
              <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><span class="text-xs text-neutral-500">Weight</span><p class="font-semibold">{{ triage.weight ? `${triage.weight} kg` : '—' }}</p></div>
                <div><span class="text-xs text-neutral-500">BP</span><p class="font-semibold">{{ triage.systolic_bp && triage.diastolic_bp ? `${triage.systolic_bp}/${triage.diastolic_bp}` : '—' }}</p></div>
                <div><span class="text-xs text-neutral-500">Pulse</span><p class="font-semibold">{{ triage.pulse ?? '—' }}</p></div>
                <div><span class="text-xs text-neutral-500">Temp</span><p class="font-semibold">{{ triage.temperature ? `${triage.temperature}°C` : '—' }}</p></div>
              </div>
            </div>
            <div v-if="showEditableForm" class="section-card">
              <div class="flex items-center justify-between gap-3">
                <div class="section-card-title !mb-0">Record vital recheck</div>
                <AutosaveIndicator :status="recheckStatus" :text="recheckText" />
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <label class="field-label">Weight <span class="unit">kg</span></label>
                  <input
                    v-model="recheck.weight"
                    type="number"
                    step="0.1"
                    min="0"
                    max="500"
                    class="field-input"
                    placeholder="e.g. 65.5"
                    @input="calculateRecheckBmi"
                  />
                </div>
                <div>
                  <label class="field-label">Height <span class="unit">cm</span></label>
                  <input
                    v-model="recheck.height"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    class="field-input"
                    placeholder="e.g. 165"
                    @input="calculateRecheckBmi"
                  />
                </div>
                <div>
                  <label class="field-label">BMI <span class="unit">kg/m²</span></label>
                  <VitalInputWithBadge
                    v-model="recheckBmiDisplay"
                    :badge="recheckBmiBadge"
                    input-type="text"
                    readonly
                    placeholder="Auto-calculated"
                    input-class="cursor-default bg-neutral-50 font-bold dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label class="field-label">Systolic BP <span class="unit">mmHg</span></label>
                  <VitalInputWithBadge
                    v-model="recheck.bp_systolic"
                    :badge="recheckVitalBadges.bp_systolic"
                    :min="40"
                    :max="300"
                    placeholder="e.g. 120"
                  />
                </div>
                <div>
                  <label class="field-label">Diastolic BP <span class="unit">mmHg</span></label>
                  <VitalInputWithBadge
                    v-model="recheck.bp_diastolic"
                    :badge="recheckVitalBadges.bp_diastolic"
                    :min="20"
                    :max="200"
                    placeholder="e.g. 80"
                  />
                </div>
                <div>
                  <label class="field-label">Pulse <span class="unit">bpm</span></label>
                  <VitalInputWithBadge
                    v-model="recheck.pulse"
                    :badge="recheckVitalBadges.pulse"
                    :min="20"
                    :max="250"
                    placeholder="e.g. 72"
                  />
                </div>
                <div>
                  <label class="field-label">Temperature <span class="unit">°C</span></label>
                  <VitalInputWithBadge
                    v-model="recheck.temperature"
                    :badge="recheckVitalBadges.temperature"
                    step="0.1"
                    :min="30"
                    :max="45"
                    placeholder="e.g. 36.8"
                  />
                </div>
                <div>
                  <label class="field-label">SpO₂ <span class="unit">%</span></label>
                  <VitalInputWithBadge
                    v-model="recheck.spo2"
                    :badge="recheckVitalBadges.spo2"
                    step="0.1"
                    :min="0"
                    :max="100"
                    placeholder="e.g. 98"
                  />
                </div>
              </div>
              <div class="mt-4"><label class="field-label">Notes</label><textarea v-model="recheck.notes" rows="2" class="field-input" placeholder="Optional notes…" /></div>
              <div class="mt-3 flex items-center gap-3">
                <ActionButton type="button" variant="outline" class="!text-xs" @click="newRecheck">
                  + New recheck
                </ActionButton>
                <p class="text-xs text-neutral-500">Changes save automatically.</p>
              </div>
            </div>
            <div v-if="rechecksList.length" class="section-card">
              <div class="section-card-title">Previous rechecks</div>
              <div v-for="rc in rechecksList" :key="rc.id" class="border-b border-neutral-100 py-2 text-sm last:border-0">
                <span class="font-semibold">{{ rc.recorded_at }}</span> · {{ rc.recorded_by ?? 'Clinician' }}
                — W: {{ rc.weight ?? '—' }} kg, BP: {{ rc.bp_systolic ?? '—' }}/{{ rc.bp_diastolic ?? '—' }}, Pulse: {{ rc.pulse ?? '—' }}, Temp: {{ rc.temperature ?? '—' }}°C, SpO₂: {{ rc.spo2 ?? '—' }}%
                <span v-if="rc.notes" class="mt-0.5 block text-xs text-neutral-500">{{ rc.notes }}</span>
              </div>
            </div>
          </div>

          <!-- prescription tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'prescription' ? 'active' : ''">
            <PrescriptionSuggestionsPanel
              :suggestions="clinicalSuggestions.prescriptions"
              :disabled="!showEditableForm"
              @add-items="addSuggestedPrescriptions"
            />

            <div class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header flex items-center justify-between px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Prescription Requests</span>
                <div class="flex items-center gap-2">
                  <template v-if="pendingPharmacyRecommendations.length && showEditableForm">
                    <ActionButton variant="green" class="!px-3 !py-1.5 text-xs" :loading="decidingUrl === `/screening/${encounter.id}/recommendations/approve-all`" loading-text="Approving…" @click="decision(`/screening/${encounter.id}/recommendations/approve-all`, 'Approve all pending pharmacy recommendations?')">Approve all</ActionButton>
                    <ActionButton variant="outline" class="!px-3 !py-1.5 text-xs" :loading="decidingUrl === `/screening/${encounter.id}/recommendations/decline-all`" loading-text="Declining…" @click="decision(`/screening/${encounter.id}/recommendations/decline-all`, 'Decline all pending pharmacy recommendations?')">Decline all</ActionButton>
                  </template>
                  <ActionButton v-if="showEditableForm" type="button" class="!px-4 !py-2 text-sm" @click="openRxModal">
                    <template #icon>
                      <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </template>
                    Add Prescription Request
                  </ActionButton>
                </div>
              </div>
              <div v-if="returnedFromPharmacy" class="border-b border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                <div class="font-semibold">Returned from Pharmacy for medication recommendation approval.</div>
                <div v-if="returnTransition?.notes" class="mt-1">Reason: {{ returnTransition.notes }}</div>
                <div v-if="returnTransition?.queued_by_name || returnTransition?.queued_at" class="mt-1 text-blue-700 dark:text-blue-300">
                  <span v-if="returnTransition?.queued_by_name">Returned by {{ returnTransition.queued_by_name }}</span>
                  <span v-if="returnTransition?.queued_by_name && returnTransition?.queued_at"> · </span>
                  <span v-if="returnTransition?.queued_at">{{ returnTransition.queued_at }}</span>
                </div>
              </div>
              <div v-if="pendingPharmacyRecommendations.length" class="theme-card-header px-5 py-3">
                <h3 class="text-sm font-bold text-blue-900 dark:text-blue-200">Pharmacy Recommended Medications <span class="font-normal text-blue-500">(Pending Screening Approval)</span></h3>
                <p class="mt-0.5 text-xs text-blue-600 dark:text-blue-400">Original in <span class="font-semibold text-red-700">red</span>, recommended in <span class="font-semibold text-green-700">green</span>.</p>
              </div>
              <div v-if="pendingPharmacyRecommendations.length" class="overflow-x-auto border-b border-neutral-100">
                <table class="screening-reco-table w-full text-sm">
                  <thead class="bg-neutral-50 dark:bg-neutral-800"><tr><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Drug</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Dose</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Frequency</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Route</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Duration</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">By</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Note</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-700">Action</th></tr></thead>
                  <tbody>
                    <template v-for="row in pendingPharmacyRecommendations" :key="row.id">
                      <tr class="sreco-source-row">
                        <td class="px-3 py-2 text-xs"><span class="sreco-drug-source">{{ row.source?.drug_name ?? '—' }}</span><span class="sreco-badge sreco-badge--original">Original</span></td>
                        <td class="px-3 py-2 text-xs text-red-800">{{ row.source?.dose ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-red-800">{{ row.source?.frequency ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-red-800">{{ row.source?.route ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-red-800">{{ row.source?.duration ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs font-medium text-red-800">{{ row.prescribed_by ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-red-400">—</td>
                        <td class="px-3 py-2 text-xs text-red-400">—</td>
                      </tr>
                      <tr class="sreco-subrow">
                        <td class="px-3 py-2 text-xs"><span class="sreco-drug-recommended">{{ row.recommended?.drug_name ?? '—' }}</span><span class="sreco-badge">Recommended</span></td>
                        <td class="px-3 py-2 text-xs text-green-800">{{ row.recommended?.dose ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-green-800">{{ row.recommended?.frequency ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-green-800">{{ row.recommended?.route ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-green-800">{{ row.recommended?.duration ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs font-medium text-green-700">{{ row.recommended_by ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs text-green-700">{{ row.note ?? '—' }}</td>
                        <td class="px-3 py-2 text-xs">
                          <div v-if="showEditableForm" class="flex items-center gap-2">
                            <ActionButton variant="green" class="!px-2.5 !py-1 text-[10px]" :loading="decidingUrl === `/screening/${encounter.id}/recommendations/${row.id}/approve`" loading-text="…" @click="decision(`/screening/${encounter.id}/recommendations/${row.id}/approve`, `Approve recommendation: ${row.recommended?.drug_name ?? ''}?`)">Approve</ActionButton>
                            <ActionButton variant="outline" class="!px-2.5 !py-1 text-[10px]" :loading="decidingUrl === `/screening/${encounter.id}/recommendations/${row.id}/decline`" loading-text="…" @click="decision(`/screening/${encounter.id}/recommendations/${row.id}/decline`, `Decline recommendation: ${row.recommended?.drug_name ?? ''}?`)">Decline</ActionButton>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-blue-50 dark:bg-blue-950/30"><tr><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Drug</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Dose</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Frequency</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Duration</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Qty</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Route</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Dates</th><th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Comment</th><th class="w-8 px-2 py-2.5"></th></tr></thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr v-for="item in prescription?.items ?? []" :key="item.id" class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">
                        {{ item.drug_name }}
                        <span v-if="item.is_passer_by" class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800">Passer-by</span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDose(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxFrequency(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDuration(item) }}</td>
                      <td class="px-3 py-2.5 text-xs font-semibold text-neutral-700">{{ item.quantity_prescribed ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.route ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ [item.start_date, item.end_date].filter(Boolean).join(' → ') || '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions ?? '—' }}</td>
                      <td class="px-2 py-2.5 text-center text-xs text-neutral-300">—</td>
                    </tr>
                    <tr v-for="(item, idx) in rxCart" :key="`cart-${idx}`" class="bg-blue-50/50 dark:bg-blue-950/20">
                      <td class="px-3 py-2.5 text-xs font-medium italic text-neutral-900 dark:text-white">
                        {{ item.drug_name }}
                        <span v-if="item.is_passer_by === '1'" class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800">Passer-by</span>
                      </td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDose(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxFrequency(item) }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ formatRxDuration(item) }}</td>
                      <td class="px-3 py-2.5 text-xs font-semibold text-neutral-700">{{ item.quantity_prescribed || '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.route }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ [item.start_date, item.end_date].filter(Boolean).join(' → ') || '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions }}</td>
                      <td class="px-2 py-2.5 text-center"><button v-if="showEditableForm" type="button" class="text-red-500 hover:text-red-700" @click="removeFromRxCart(idx)">✕</button></td>
                    </tr>
                    <tr v-if="!prescription?.items?.length && !rxCart.length"><td colspan="9" class="px-4 py-8 text-center text-sm text-neutral-400">No prescription requests yet.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- lab tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'lab' ? 'active' : ''">
            <LabRequestDetailsCard
              v-model:priority="labPriority"
              v-model:notes="labRequestNotes"
              :editable="showEditableForm"
              :request-number="labRequest?.request_number"
            />

            <div class="section-card !overflow-hidden !p-0">
              <div class="theme-card-header flex items-center justify-between px-5 py-3.5">
                <span class="text-sm font-bold text-neutral-800 dark:text-neutral-200">Ordered Tests</span>
                <ActionButton v-if="showEditableForm" type="button" class="!rounded !px-4 !py-2 text-sm" @click="openLabModal">
                  <template #icon>
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </template>
                  Add Test
                </ActionButton>
              </div>
              <div class="overflow-x-auto">
                <table class="screening-rx-table w-full text-sm">
                  <thead class="bg-cyan-50 dark:bg-cyan-950/30">
                    <tr>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Test</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Group</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Specimen</th>
                      <th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-600">Instructions</th>
                      <th class="w-8 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                    <tr v-for="item in labRequest?.items ?? []" :key="item.id" class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td class="px-3 py-2.5 text-xs font-medium text-neutral-900 dark:text-white">{{ item.test_name }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.test_group ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.specimen_type ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions ?? '—' }}</td>
                      <td class="px-2 py-2.5 text-center text-xs text-neutral-300">—</td>
                    </tr>
                    <tr v-for="(item, idx) in labCart" :key="`lab-cart-${idx}`" class="bg-cyan-50/50 dark:bg-cyan-950/20">
                      <td class="px-3 py-2.5 text-xs font-medium italic text-neutral-900 dark:text-white">{{ item.test_name }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.test_group ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-600">{{ item.specimen_type ?? '—' }}</td>
                      <td class="px-3 py-2.5 text-xs text-neutral-500">{{ item.instructions ?? '—' }}</td>
                      <td class="px-2 py-2.5 text-center">
                        <button v-if="showEditableForm" type="button" class="text-red-500 hover:text-red-700" @click="removeFromLabCart(idx)">✕</button>
                      </td>
                    </tr>
                    <tr v-if="!labRequest?.items?.length && !labCart.length">
                      <td colspan="5" class="px-4 py-8 text-center text-sm text-neutral-400">No lab requests yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- plan tab -->
          <div class="tab-panel space-y-4 p-6" :class="activeTab === 'plan' ? 'active' : ''">
            <ClinicalSuggestionsBanner
              :fields="clinicalSuggestions.fields"
              :disabled="!showEditableForm"
            >
              <template #apply-all="{ applyAll }">
                <ActionButton
                  type="button"
                  class="!rounded !px-3 !py-1.5 text-xs"
                  @click="applyAllScreeningClinical(applyAll(form))"
                >
                  Apply all clinical
                </ActionButton>
              </template>
            </ClinicalSuggestionsBanner>

            <div class="section-card">
              <div class="section-card-title">Treatment Plan</div>
              <FieldWithSuggestions
                v-model="form.treatment_plan"
                :disabled="!showEditableForm"
                :rows="3"
                placeholder="Proposed treatment approach, interventions…"
                :suggestions="clinicalSuggestions.fields.treatment_plan ?? []"
                @applied="onScreeningSuggestionApplied"
              />
            </div>
            <div class="section-card">
              <div class="section-card-title">Management Plan</div>
              <FieldWithSuggestions
                v-model="form.plan"
                :disabled="!showEditableForm"
                :rows="3"
                placeholder="Follow-up, referral, counselling…"
                :suggestions="clinicalSuggestions.fields.plan ?? []"
                @applied="onScreeningSuggestionApplied"
              />
            </div>
            <!-- Disposition -->
            <div class="section-card">
              <div class="section-card-title">Disposition — Where next?</div>
              <p class="-mt-2 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
                Pick the primary destination, then press <strong>Queue</strong> below to confirm.
              </p>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  class="disposition-tile"
                  :class="!form.lab_requested ? 'disposition-tile--active' : ''"
                  :disabled="!showEditableForm"
                  @click="setPharmacyDisposition"
                >
                  <span class="disposition-tile__icon bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="disposition-tile__title">Pharmacy</span>
                    <span class="disposition-tile__desc">Dispense prescribed medication</span>
                  </span>
                  <span class="disposition-tile__radio" :class="!form.lab_requested ? 'disposition-tile__radio--on' : ''" />
                </button>

                <button
                  type="button"
                  class="disposition-tile"
                  :class="form.lab_requested ? 'disposition-tile--active' : ''"
                  :disabled="!showEditableForm"
                  @click="setLabDisposition"
                >
                  <span class="disposition-tile__icon bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 3v6.5L4.5 17a2 2 0 001.7 3h11.6a2 2 0 001.7-3L15 9.5V3M8 3h8M8.5 13h7" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="disposition-tile__title">Lab first</span>
                    <span class="disposition-tile__desc">Order investigations before pharmacy</span>
                  </span>
                  <span class="disposition-tile__radio" :class="form.lab_requested ? 'disposition-tile__radio--on' : ''" />
                </button>
              </div>

              <div class="mt-4">
                <label class="field-label">Handover Note <span class="text-xs font-normal text-neutral-400">(optional)</span></label>
                <textarea v-model="form.notes" :disabled="!showEditableForm" rows="2" class="field-input" placeholder="Anything the next department should know…" />
              </div>

              <div class="mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <svg class="h-4 w-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span>Press <strong>Queue</strong> below to send this patient to <strong>{{ form.lab_requested ? 'Lab' : 'Pharmacy' }}</strong>.</span>
              </div>
            </div>

          </div>

          <!-- footer -->
          <QueueFooter
            v-if="showEditableForm"
            :show-hint="showQueueHint"
            aria-label="Queue patient — choose next destination"
            @click="openQueueActionsModal"
          />
          <div v-else class="border-t border-neutral-200 px-6 py-4">
            <p class="text-sm text-neutral-500">This encounter is read-only at screening.</p>
            <Link href="/screening/queue" class="btn-secondary mt-3 inline-flex">Back to Queue</Link>
          </div>

          <input type="hidden" :value="form.prescriptions" />
          <input type="hidden" :value="form.lab_items" />
        </form>
      </div>
    </div>

    <ScreeningQueueActionsModal
      v-model:show="queueActionsModalOpen"
      v-model:treatment-notes="treatmentRoomNotes"
      :lab-requested="!!form.lab_requested"
      :complete-label="completeActionLabel"
      :complete-loading="form.processing"
      :treatment-loading="queueingTreatment"
      :triage-loading="queueingTriage"
      @complete="complete"
      @queue-treatment="queueTreatmentRoom"
      @queue-triage="queueTriage"
    />

    <template v-if="!encounter.is_locked">
      <div class="triage-dimmer fixed inset-x-0 bottom-0 top-16 z-[997] bg-black/25 dark:bg-black/45" :class="dimmerVisible ? 'is-visible' : ''" @click="closeAllOverlays" />
      <AddPrescriptionModal
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
      <AddLabTestModal
        v-model:show="labModalOpen"
        v-model:test-search="labTestSearch"
        :draft="labDraft"
        :test-results="labTestResults"
        :test-loading="labTestLoading"
        :test-popover-open="labTestPopoverOpen"
        :test-active-idx="labTestActiveIdx"
        :show-error="labFormError"
        :error-msg="labErrorMsg"
        @update:draft="updateLabDraft"
        @test-input="onLabTestInput"
        @test-focus="() => { if (!labTestResults.length) searchLabTests() }"
        @select-test="selectLabTest"
        @move-test-active="moveLabTestActive"
        @pick-test-active="pickLabTestActive"
        @set-test-active-idx="setLabTestActiveIdx"
        @close-test-popover="closeLabTestPopover"
        @add-to-cart="addToLabCart"
        @close="closeLabModal"
      />
      <div
        v-if="canManageWard && showEditableForm && admitModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/55" @click="closeAdmitModal" />

        <div class="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
          <div class="flex flex-shrink-0 items-start justify-between border-b border-neutral-100 px-6 py-5">
            <div>
              <h2 class="text-base font-black text-neutral-900 dark:text-white">Admit to Ward</h2>
              <p class="mt-0.5 text-xs text-neutral-500">
                Patient: <strong>{{ encounter.patient?.full_name }}</strong>
                · {{ encounter.patient?.gender ? encounter.patient.gender.charAt(0).toUpperCase() + encounter.patient.gender.slice(1) : '—' }}
                <template v-if="patientAge !== null"> · {{ patientAge }} yrs</template>
              </p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              @click="closeAdmitModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex flex-shrink-0 items-center gap-3 px-6 pt-4">
            <span
              v-if="targetWing"
              class="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
            >
              {{ targetWing }} Wing
              <span class="rounded-full bg-white/30 px-1.5 py-0.5 text-[10px] font-black text-white">
                {{ availableBedsCount }} free
              </span>
            </span>
            <span v-if="targetWing" class="text-xs text-neutral-500">Routed by patient gender.</span>
            <span
              v-else
              class="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800"
            >
              Patient gender not set
            </span>
          </div>

          <div class="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <div
              v-if="!wardsWithBeds.length"
              class="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-600"
            >
              <template v-if="targetWing">
                No <span class="font-semibold">{{ targetWing }}</span> wards configured yet.
              </template>
              <template v-else>
                Cannot determine the target ward without the patient's gender.
              </template>
            </div>

            <div v-for="ward in wardsWithBeds" :key="ward.id" class="mb-5">
              <div class="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div class="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{{ ward.name }}</div>
                <div class="flex gap-4 text-xs font-semibold">
                  <span class="text-emerald-600">
                    ● {{ ward.beds.filter((b) => b.status === 'available').length }} Available
                  </span>
                  <span class="text-red-500">
                    ● {{ ward.beds.filter((b) => b.status === 'occupied').length }} Occupied
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div
                  v-for="bed in ward.beds"
                  :key="bed.id"
                  class="flex select-none flex-col gap-1.5 rounded-xl border-2 p-3 transition"
                  :class="[
                    bedCardClasses(bed),
                    selectedBedId === bed.id ? 'admit-bed-selected' : '',
                  ]"
                  @click="selectBed(bed)"
                >
                  <div class="flex items-center justify-between">
                    <span class="h-2 w-2 rounded-full" :class="bedDotClass(bed.status)" />
                    <span
                      class="text-[9px] font-bold uppercase tracking-wide"
                      :class="bed.status === 'available' || currentBed?.id === bed.id ? 'text-emerald-700' : 'text-neutral-500'"
                    >
                      {{ bedStatusLabel(bed) }}
                    </span>
                  </div>
                  <div class="text-sm font-black text-neutral-900 dark:text-white">{{ bed.bed_number }}</div>
                  <div
                    v-if="bed.status === 'occupied'"
                    class="truncate text-[9px] font-medium leading-tight text-neutral-500"
                  >
                    {{ bed.patient_name ?? 'Patient' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center justify-between theme-card-header border-t px-6 py-4">
            <div class="text-sm text-neutral-500">
              <template v-if="selectedBedLabel()">
                <strong class="text-neutral-900 dark:text-white">{{ selectedBedLabel() }}</strong> selected
              </template>
              <template v-else>Click an available bed to select it</template>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-white dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
                @click="closeAdmitModal"
              >
                Cancel
              </button>
              <ActionButton
                :loading="admitting"
                loading-text="Admitting…"
                :disabled="!selectedBedId"
                :class="!selectedBedId ? 'opacity-40' : ''"
                @click="confirmAdmit"
              >
                Confirm Admission
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
      <div class="triage-meds-drawer fixed top-0 right-0 z-[999] flex h-full w-[28rem] flex-col bg-white shadow-2xl dark:bg-neutral-900" :class="medsDrawerOpen ? 'is-open' : ''">
        <button type="button" class="absolute left-0 top-1/2 flex h-16 w-6 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-md bg-neutral-900 text-white" @click="medsDrawerOpen ? closeMedsDrawer() : openMedsDrawer()">‹</button>
        <div class="border-b px-5 py-4"><h2 class="text-sm font-bold uppercase">Startup Medications</h2></div>
        <div class="flex-1 overflow-y-auto divide-y dark:divide-white/[0.04]">
          <div v-for="med in medications" :key="med.id" class="px-5 py-3">
            <p class="text-sm font-semibold">{{ med.medication_name }}</p>
            <p class="text-xs text-neutral-500">{{ [med.dosage, med.route, med.frequency].filter(Boolean).join(' · ') }}</p>
            <button v-if="med.status !== 'discontinued' && showEditableForm" type="button" class="mt-1 text-xs text-red-500" @click="removeMedication(med.id)">Remove</button>
          </div>
        </div>
      </div>
    </template>
  </StaffLayout>
</template>

<style scoped>
.tab-nav { display: flex; align-items: center; gap: 4px; background: #171717; border-radius: 4px; padding: 4px; overflow-x: auto; }
.tab-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1; padding: 8px 14px; font-size: 12px; font-weight: 600; color: #a3a3a3; border-radius: 4px; cursor: pointer; white-space: nowrap; background: none; border: none; transition: all 0.2s; }
.tab-btn__icon { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.8; }
.tab-btn:hover { color: #d4d4d4; }
.tab-btn.active { background: #404040; color: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
.tab-btn.active .tab-btn__icon { opacity: 1; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.section-card { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4px; padding: 16px; margin-bottom: 16px; }
:global(.dark) .section-card { background: #171717; border-color: #404040; }
.section-card-title { font-size: 13px; font-weight: 600; color: #171717; margin-bottom: 12px; }
:global(.dark) .section-card-title { color: #e5e5e5; }

.disposition-tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #ffffff;
  text-align: left;
  transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
  cursor: pointer;
}
.disposition-tile:hover:not(:disabled) { border-color: #d4d4d4; background: #fafafa; }
.disposition-tile:disabled { opacity: .6; cursor: not-allowed; }
.disposition-tile--active { border-color: #171717; box-shadow: 0 0 0 1px #171717 inset; background: #fafafa; }
:global(.dark) .disposition-tile { background: #0a0a0a; border-color: #404040; }
:global(.dark) .disposition-tile:hover:not(:disabled) { background: #171717; }
:global(.dark) .disposition-tile--active { border-color: #f5f5f5; box-shadow: 0 0 0 1px #f5f5f5 inset; background: #171717; }

.disposition-tile__icon {
  display: inline-flex;
  height: 40px;
  width: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}
.disposition-tile__title { display: block; font-size: 14px; font-weight: 700; color: #171717; }
:global(.dark) .disposition-tile__title { color: #f5f5f5; }
.disposition-tile__desc { display: block; font-size: 12px; color: #737373; margin-top: 2px; }

.disposition-tile__radio {
  margin-top: 4px;
  height: 18px;
  width: 18px;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 2px solid #d4d4d4;
  position: relative;
  transition: border-color .15s ease;
}
.disposition-tile__radio--on { border-color: #171717; }
.disposition-tile__radio--on::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 9999px;
  background: #171717;
}
:global(.dark) .disposition-tile__radio--on { border-color: #f5f5f5; }
:global(.dark) .disposition-tile__radio--on::after { background: #f5f5f5; }

.disposition-alt {
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #ffffff;
  padding: 14px;
}
:global(.dark) .disposition-alt { background: #0a0a0a; border-color: #404040; }
.checkbox-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 10px; border: 1px solid #e5e5e5; border-radius: 4px; background: #fff; }
.checkbox-label:has(input:checked) { border-color: #171717; background: #f5f5f5; }
:global(.dark) .checkbox-label { background: #262626; border-color: #525252; }
.sreco-source-row td { background: #fff1f2; border-bottom: 1px solid #fecdd3; }
:global(.dark) .sreco-source-row td { background: rgba(127, 29, 29, 0.25); border-bottom-color: #7f1d1d; }
.sreco-source-row .sreco-drug-source { color: #9f1239; font-weight: 600; }
:global(.dark) .sreco-source-row .sreco-drug-source { color: #fda4af; }
.sreco-subrow td { background: #f0fdf4; border-bottom: 2px solid #bbf7d0; }
:global(.dark) .sreco-subrow td { background: rgba(6, 78, 59, 0.25); border-bottom-color: #166534; }
.sreco-badge { display: inline-flex; padding: 1px 7px; font-size: 10px; font-weight: 700; text-transform: uppercase; border-radius: 3px; border: 1px solid #16a34a; background: #dcfce7; color: #166534; margin-left: 6px; }
.sreco-badge--original { border-color: #dc2626; background: #fee2e2; color: #991b1b; }
.sreco-drug-recommended { font-weight: 700; color: #14532d; }
.triage-meds-drawer { transform: translateX(100%); transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1); }
.triage-meds-drawer.is-open { transform: translateX(0); }
.return-triage-callout {
  border-left: 4px solid #f59e0b;
}
:global(.dark) .return-triage-callout {
  border-left-color: #d97706;
}
</style>
