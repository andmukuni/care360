<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import PatientHeader from '~/components/encounter/PatientHeader.vue'
import HandoverNotesCard from '~/components/encounter/HandoverNotesCard.vue'
import WardWingBadge from '~/components/encounter/WardWingBadge.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import QueueFooter from '~/components/ui/QueueFooter.vue'
import FieldWithSuggestions from '~/components/clinical/FieldWithSuggestions.vue'
import ClinicalSuggestionsBanner from '~/components/clinical/ClinicalSuggestionsBanner.vue'
import AutosaveIndicator from '~/components/ui/AutosaveIndicator.vue'
import VitalInputWithBadge from '~/components/ui/VitalInputWithBadge.vue'
import TriageQueueActionsModal from '~/components/triage/TriageQueueActionsModal.vue'
import { useAsyncAction } from '~/composables/useAsyncAction'
import { useAutosave } from '~/composables/useAutosave'
import { useQueueFooterHint } from '~/composables/useQueueFooterHint'
import { flushAutosavesBeforeAction } from '~/composables/useFlushAutosave'
import { confirmDialog } from '~/composables/useConfirm'
import { formatApiErrors } from '~/support/api_errors'
import { readXsrfToken } from '~/support/xsrf'
import {
  abdominalCircumferenceBadge,
  bloodSugarBadge,
  bmiBadge as computeBmiBadge,
  diastolicBpBadge,
  muacBadge,
  muacScoreBadge,
  oxygenSaturationBadge,
  painScaleBadge,
  pulseBadge,
  respiratoryRateBadge,
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

type PastEncounter = {
  id: number
  encounter_number: string
  visit_type: string | null
  priority: string | null
  started_at: string | null
  triage: Record<string, any> | null
  startup_medications: {
    id: number
    medication_name: string
    dosage: string | null
    route: string | null
    frequency: string | null
    administered_at: string | null
    recorded_by: string | null
    status: string
  }[]
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
  definition?: string | null
}

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
  startupMedications: StartupMed[]
  targetWing: string | null
  wardsWithBeds: WardWithBeds[]
  currentBed: {
    id: number
    bed_number: string
    ward_name: string | null
    wing: string | null
    admitted_at: string | null
  } | null
  canManageWardInTriage: boolean
  isAtTriage: boolean
  handover: {
    notes: string | null
    queued_by_name: string | null
    queued_at: string | null
  }
  draftHandoverNotes: string | null
  pastEncounters: PastEncounter[]
  clinicalSuggestions: {
    fields: Record<string, { id: number; text: string; source?: Record<string, unknown> }[]>
    prescriptions: { id: number; items: Record<string, unknown>[]; source?: Record<string, unknown> }[]
  }
}>()

const ROUTE_OPTIONS = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Rectal', 'Inhaled', 'Sublingual'] as const
const FREQUENCY_OPTIONS = ['Stat', 'OD', 'BD', 'TDS', 'QDS', 'PRN'] as const

const reviewPanelOpen = ref(false)
const admitModalOpen = ref(false)
const medsDrawerOpen = ref(false)
const selectedBedId = ref<number | null>(null)
const medFlash = ref('')
const medFlashError = ref(false)
const medSearchResults = ref<MedSearchResult[]>([])
const medDropdownOpen = ref(false)
const dosageSuggestions = ref<string[]>([])

const medications = ref<StartupMed[]>([...props.startupMedications])

watch(
  () => props.startupMedications,
  (value) => {
    medications.value = [...value]
  },
  { deep: true }
)

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

const bmiDisplay = ref(props.triage?.bmi ? String(props.triage.bmi) : '')
const bmiNoteVisible = ref(false)

const { loading: discharging, run: runDischarge } = useAsyncAction()
const { loading: admitting, run: runAdmit } = useAsyncAction()
const { loading: addingMed, run: runAddMed } = useAsyncAction()
const { processingId: removingMedId, runFor: runRemoveMed } = useAsyncAction<number>()

const vitals = useForm({
  weight: props.triage?.weight ?? null,
  height: props.triage?.height ?? null,
  temperature: props.triage?.temperature ?? null,
  pulse: props.triage?.pulse ?? null,
  respiratory_rate: props.triage?.respiratory_rate ?? null,
  systolic_bp: props.triage?.systolic_bp ?? null,
  diastolic_bp: props.triage?.diastolic_bp ?? null,
  oxygen_saturation: props.triage?.oxygen_saturation ?? null,
  blood_sugar: props.triage?.blood_sugar ?? null,
  pain_scale: props.triage?.pain_scale ?? null,
  muac: props.triage?.muac ?? null,
  muac_score: props.triage?.muac_score ?? '',
  abdominal_circumference: props.triage?.abdominal_circumference ?? null,
  chief_complaint_brief: props.triage?.chief_complaint_brief ?? '',
  startup_interventions_notes: props.triage?.startup_interventions_notes ?? '',
  notes: props.draftHandoverNotes ?? '',
})

const TRIAGE_NUMERIC_KEYS = [
  'weight',
  'height',
  'temperature',
  'pulse',
  'respiratory_rate',
  'systolic_bp',
  'diastolic_bp',
  'oxygen_saturation',
  'blood_sugar',
  'pain_scale',
  'muac',
  'abdominal_circumference',
] as const

function triageAutosavePayload() {
  const raw = vitals.data() as Record<string, unknown>
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (TRIAGE_NUMERIC_KEYS.includes(key as (typeof TRIAGE_NUMERIC_KEYS)[number])) {
      cleaned[key] = value === '' || value === null || value === undefined ? null : Number(value)
      continue
    }
    if (typeof value === 'string') {
      cleaned[key] = value.trim() === '' ? null : value
      continue
    }
    cleaned[key] = value
  }

  return cleaned
}

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

const { showQueueHint, dismissQueueHint } = useQueueFooterHint('triage', props.encounter.id)

const queueActionsModalOpen = ref(false)

const dimmerVisible = computed(
  () =>
    reviewPanelOpen.value ||
    admitModalOpen.value ||
    medsDrawerOpen.value ||
    queueActionsModalOpen.value
)

const showEditableForm = computed(() => props.isAtTriage && props.encounter.can_edit)

const bmiBadge = computed(() => computeBmiBadge(bmiDisplay.value))

const vitalBadges = computed(() => ({
  temperature: temperatureBadge(vitals.temperature),
  pulse: pulseBadge(vitals.pulse),
  respiratory_rate: respiratoryRateBadge(vitals.respiratory_rate),
  oxygen_saturation: oxygenSaturationBadge(vitals.oxygen_saturation),
  systolic_bp: systolicBpBadge(vitals.systolic_bp),
  diastolic_bp: diastolicBpBadge(vitals.diastolic_bp),
  blood_sugar: bloodSugarBadge(vitals.blood_sugar),
  muac: muacBadge(vitals.muac),
  muac_score: muacScoreBadge(vitals.muac_score),
  abdominal_circumference: abdominalCircumferenceBadge(vitals.abdominal_circumference),
  pain_scale: painScaleBadge(vitals.pain_scale),
}))

const liveTriageForHeader = computed(() => {
  if (!showEditableForm.value) return null

  const bmi = bmiDisplay.value ? Number(bmiDisplay.value) : null

  return {
    weight: vitals.weight,
    height: vitals.height,
    temperature: vitals.temperature,
    pulse: vitals.pulse,
    respiratory_rate: vitals.respiratory_rate,
    systolic_bp: vitals.systolic_bp,
    diastolic_bp: vitals.diastolic_bp,
    oxygen_saturation: vitals.oxygen_saturation,
    blood_sugar: vitals.blood_sugar,
    pain_scale: vitals.pain_scale,
    muac: vitals.muac,
    muac_score: vitals.muac_score,
    abdominal_circumference: vitals.abdominal_circumference,
    bmi: Number.isFinite(bmi) ? bmi : null,
  }
})

const { status: autosaveStatus, indicatorText: autosaveText } = useAutosave({
  url: `/triage/${props.encounter.id}/save-vitals`,
  getPayload: triageAutosavePayload,
  enabled: showEditableForm,
  watchSource: computed(() => vitals.data()),
})

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

const currentVitalCards = computed(() => {
  if (!props.triage) return [] as { label: string; value: string }[]
  const t = props.triage
  return [
    { label: 'Weight', value: t.weight ? `${t.weight} kg` : '—' },
    { label: 'Height', value: t.height ? `${t.height} cm` : '—' },
    { label: 'BMI', value: t.bmi ?? '—' },
    { label: 'Temp', value: t.temperature ? `${t.temperature} °C` : '—' },
    { label: 'Pulse', value: t.pulse ? `${t.pulse} bpm` : '—' },
    { label: 'RR', value: t.respiratory_rate ? `${t.respiratory_rate}/min` : '—' },
    {
      label: 'BP',
      value: t.systolic_bp && t.diastolic_bp ? `${t.systolic_bp}/${t.diastolic_bp} mmHg` : '—',
    },
    { label: 'O₂ Sat', value: t.oxygen_saturation ? `${t.oxygen_saturation}%` : '—' },
    { label: 'Sugar', value: t.blood_sugar ? `${t.blood_sugar} mmol/L` : '—' },
    { label: 'MUAC', value: t.muac ? `${t.muac} cm` : '—' },
    { label: 'MUAC Score', value: t.muac_score ?? '—' },
    {
      label: 'Abd. Circ',
      value: t.abdominal_circumference ? `${t.abdominal_circumference} cm` : '—',
    },
  ]
})

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
    {
      label: 'BP',
      value: bloodPressure(triage.systolic_bp, triage.diastolic_bp),
    },
    { label: 'O₂ Sat', value: triage.oxygen_saturation ? `${triage.oxygen_saturation}%` : '—' },
    { label: 'Sugar', value: triage.blood_sugar ? `${triage.blood_sugar} mmol/L` : '—' },
    { label: 'MUAC', value: triage.muac ? `${triage.muac} cm` : '—' },
    { label: 'MUAC Score', value: triage.muac_score ?? '—' },
    {
      label: 'Abd. Circ',
      value: triage.abdominal_circumference ? `${triage.abdominal_circumference} cm` : '—',
    },
  ]
}

function calculateBmi() {
  const weight = Number(vitals.weight)
  const height = Number(vitals.height)

  if (!weight || !height || height <= 0) {
    bmiDisplay.value = ''
    bmiNoteVisible.value = false
    return
  }

  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  bmiDisplay.value = bmi.toFixed(1)
  bmiNoteVisible.value = true
}

function calculateMuacScore() {
  const val = Number(vitals.muac)
  if (Number.isNaN(val) || val <= 0) {
    vitals.muac_score = ''
    return
  }

  if (val < 11.5) vitals.muac_score = 'SAM (Red)'
  else if (val < 12.5) vitals.muac_score = 'MAM (Yellow)'
  else vitals.muac_score = 'Normal (Green)'
}

async function complete() {
  dismissQueueHint()
  calculateBmi()
  calculateMuacScore()
  if (!(await flushAutosavesBeforeAction({ required: false }))) return
  vitals.post(`/triage/${props.encounter.id}/complete`)
}

function openQueueFooter() {
  queueActionsModalOpen.value = true
}

function closeQueueActionsModal() {
  queueActionsModalOpen.value = false
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

function closeAllOverlays() {
  closeAdmitModal()
  closeReviewPanel()
  closeMedsDrawer()
  closeQueueActionsModal()
}

function onEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape') closeAllOverlays()
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
      'bg-emerald-50 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100 cursor-pointer',
    occupied: isMyBed
      ? 'bg-emerald-100 border-emerald-500 cursor-pointer ring-2 ring-emerald-400'
      : 'bg-red-50 border-red-300 cursor-not-allowed opacity-75',
    reserved: 'bg-amber-50 border-amber-300 cursor-not-allowed opacity-75',
    maintenance: 'bg-neutral-100 border-neutral-300 cursor-not-allowed opacity-60',
  }
  return map[bed.status] ?? 'bg-neutral-50 border-neutral-300'
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

async function confirmDischarge() {
  if (!(await confirmDialog('Discharge this patient and free the bed?'))) return
  runDischarge(async () => {
    const res = await fetch(`/triage/${props.encounter.id}/discharge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-XSRF-TOKEN': readXsrfToken(),
      },
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
    const res = await fetch(`/triage/${props.encounter.id}/admit`, {
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

function applyMedicationAdded(med: StartupMed) {
  const existing = medications.value.find((item) => item.id === med.id)
  if (existing) {
    Object.assign(existing, med)
    return
  }
  medications.value.push(med)
}

async function addMedication() {
  if (!medForm.value.medication_name.trim()) return

  runAddMed(async () => {
    const payload = {
      medication_id: medForm.value.medication_id ? Number(medForm.value.medication_id) : null,
      medication_name: medForm.value.medication_name.trim(),
      dosage: medForm.value.dosage || null,
      route: medForm.value.route || null,
      frequency: medForm.value.frequency || null,
      notes: medForm.value.notes || null,
      administered_at: medForm.value.administered_at || null,
    }

    try {
      const res = await fetch(`/triage/${props.encounter.id}/startup-medications`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
        body: JSON.stringify(payload),
      })

      if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
        showMedFlash('✗ Unexpected redirect while saving medication.', true)
        return
      }

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        showMedFlash(`✗ ${formatApiErrors(data, 'Failed to add medication.')}`, true)
        return
      }

      if (data?.success && data.med) {
        applyMedicationAdded({
          id: data.med.id,
          medication_name: data.med.medication_name,
          dosage: data.med.dosage,
          route: data.med.route,
          frequency: data.med.frequency,
          notes: data.med.notes,
          source: data.med.source ?? 'triage',
          status: data.med.status ?? 'active',
          administered_at: data.med.administered_at,
          recorded_by: data.med.recorded_by,
        })
        showMedFlash(`✓ ${data.med.medication_name} added`)
        resetMedForm()
        return
      }

      showMedFlash('✗ Failed to add medication.', true)
    } catch {
      showMedFlash('✗ Failed to add medication.', true)
    }
  })
}

async function removeMedication(id: number) {
  if (!(await confirmDialog('Remove this medication?'))) return
  runRemoveMed(id, async () => {
    try {
      const res = await fetch(`/triage/startup-medications/${id}`, {
        method: 'DELETE',
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
      })
      const data = await res.json()
      if (data.success) {
        medications.value = medications.value.filter((m) => m.id !== id)
      } else {
        alert('Failed to remove medication.')
      }
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
  if (!target.closest('[data-med-search]')) {
    medDropdownOpen.value = false
  }
}

watch([() => vitals.weight, () => vitals.height], calculateBmi)
watch(() => vitals.muac, calculateMuacScore)

onMounted(() => {
  calculateBmi()
  calculateMuacScore()
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
      <Link href="/triage/queue" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">
        Triage
      </Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ encounter.encounter_number }}</span>
    </template>

    <template #navbar-extras>
      <div class="triage-review-clip w-full" :class="reviewPanelOpen ? 'is-open' : ''">
        <div class="triage-review-panel pointer-events-auto w-full">
          <div class="triage-review-tabbar flex justify-center">
            <button
              type="button"
              class="triage-review-tab -mt-[1px] inline-flex items-center gap-2 rounded-b-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-neutral-800"
              @click.stop="toggleReviewPanel"
            >
                <svg
                  class="h-4 w-4 transition-transform"
                  :class="reviewPanelOpen ? 'rotate-180' : ''"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
                Passed Review
              </button>
            </div>

            <div class="triage-review-body theme-surface w-full border-b border-neutral-200">
              <div class="mx-auto max-h-[50vh] w-full max-w-6xl overflow-y-auto">
                <div class="space-y-6 p-6">
                  <div class="flex items-center justify-between gap-4">
                    <h2 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">
                      Passed Review — Previous Encounters
                    </h2>
                  <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    @click="closeReviewPanel"
                  >
                    <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div v-if="!pastEncounters.length" class="py-8 text-center">
                  <svg class="mx-auto mb-2 h-10 w-10 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p class="text-sm text-neutral-400">No previous encounters for this patient</p>
                </div>

                <div
                  v-for="past in pastEncounters"
                  :key="past.id"
                  class="overflow-hidden rounded-lg border border-neutral-200"
                >
                  <div class="flex items-center justify-between bg-neutral-50 px-4 py-3 dark:bg-neutral-800">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                        {{ past.encounter_number }}
                      </span>
                      <span class="text-xs text-neutral-500">
                        {{ past.visit_type ?? 'OPD' }} · {{ priorityText(past.priority) }}
                      </span>
                    </div>
                    <span class="text-xs text-neutral-400">{{ past.started_at }}</span>
                  </div>

                  <div class="space-y-4 p-4">
                    <template v-if="past.triage">
                      <div>
                        <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          Vital Signs
                        </h4>
                        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                          <div
                            v-for="card in pastVitalCards(past.triage)"
                            :key="card.label"
                            class="rounded bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800"
                          >
                            <div class="text-sm font-bold text-neutral-900 dark:text-white">{{ card.value }}</div>
                            <div class="text-[10px] text-neutral-500">{{ card.label }}</div>
                          </div>
                        </div>
                      </div>

                      <div v-if="past.triage.chief_complaint_brief || past.triage.startup_interventions_notes">
                        <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          Clinical Notes
                        </h4>
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div
                            v-if="past.triage.chief_complaint_brief"
                            class="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-800"
                          >
                            <p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Chief Complaint</p>
                            <p class="text-sm text-neutral-600 dark:text-neutral-400">
                              {{ past.triage.chief_complaint_brief }}
                            </p>
                          </div>
                          <div
                            v-if="past.triage.startup_interventions_notes"
                            class="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-800"
                          >
                            <p class="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                              Startup Interventions
                            </p>
                            <p class="text-sm text-neutral-600 dark:text-neutral-400">
                              {{ past.triage.startup_interventions_notes }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </template>
                    <p v-else class="text-xs italic text-neutral-400">No triage data recorded</p>

                    <div v-if="past.startup_medications.length">
                      <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Startup Medications ({{ past.startup_medications.length }})
                      </h4>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="bg-neutral-50 text-left dark:bg-neutral-800">
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Medication</th>
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Dosage</th>
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Route</th>
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Frequency</th>
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">Given At</th>
                              <th class="px-2 py-1.5 font-semibold uppercase text-neutral-500">By</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                            <tr v-for="med in past.startup_medications" :key="med.id">
                              <td class="px-2 py-1.5 font-medium text-neutral-900 dark:text-white">
                                {{ med.medication_name }}
                              </td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.dosage ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.route ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.frequency ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.administered_at ?? '—' }}</td>
                              <td class="px-2 py-1.5 text-neutral-600">{{ med.recorded_by ?? '—' }}</td>
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

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      This encounter is locked. Clinical edits are restricted until it is reopened.
    </div>

    <PatientHeader :encounter="encounter" :triage="triage" :live-triage="liveTriageForHeader" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Left: Vitals -->
      <div class="space-y-6 lg:col-span-2">
        <!-- Editable form -->
        <div
          v-if="showEditableForm"
          class="theme-surface rounded-2xl shadow-sm"
        >
          <div class="flex items-center gap-3 theme-card-header px-6 py-4">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700">
              <svg class="h-4 w-4 text-neutral-600 dark:text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-neutral-900 dark:text-white">Record Vitals &amp; Notes</h2>
            <AutosaveIndicator class="ml-auto" :status="autosaveStatus" :text="autosaveText" />
          </div>

          <form @submit.prevent="complete">
            <div class="space-y-6 p-6">
            <div>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Vital Signs</h3>
              <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <label class="field-label">Weight <span class="unit">kg</span></label>
                  <input
                    v-model="vitals.weight"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="300"
                    class="field-input"
                    placeholder="e.g. 65.5"
                    @input="calculateBmi"
                  />
                </div>
                <div>
                  <label class="field-label">Height <span class="unit">cm</span></label>
                  <input
                    v-model="vitals.height"
                    type="number"
                    step="0.1"
                    min="20"
                    max="250"
                    class="field-input"
                    placeholder="e.g. 165"
                    @input="calculateBmi"
                  />
                </div>
                <div>
                  <label class="field-label">BMI <span class="unit">kg/m²</span></label>
                  <VitalInputWithBadge
                    v-model="bmiDisplay"
                    :badge="bmiBadge"
                    input-type="text"
                    readonly
                    placeholder="Auto-calculated"
                    input-class="cursor-default bg-neutral-50 font-bold dark:bg-neutral-900"
                  />
                  <p v-if="bmiNoteVisible" class="mt-0.5 text-[10px] text-neutral-400">
                    Calculated from weight &amp; height
                  </p>
                </div>
                <div>
                  <label class="field-label">Temperature <span class="unit">°C</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.temperature"
                    :badge="vitalBadges.temperature"
                    step="0.1"
                    :min="25"
                    :max="45"
                    placeholder="e.g. 36.8"
                  />
                </div>
                <div>
                  <label class="field-label">Pulse <span class="unit">bpm</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.pulse"
                    :badge="vitalBadges.pulse"
                    :min="20"
                    :max="300"
                    placeholder="e.g. 72"
                  />
                </div>
                <div>
                  <label class="field-label">Resp. Rate <span class="unit">breaths/min</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.respiratory_rate"
                    :badge="vitalBadges.respiratory_rate"
                    :min="4"
                    :max="80"
                    placeholder="e.g. 18"
                  />
                </div>
                <div>
                  <label class="field-label">Oxygen Saturation <span class="unit">%</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.oxygen_saturation"
                    :badge="vitalBadges.oxygen_saturation"
                    step="0.1"
                    :min="0"
                    :max="100"
                    placeholder="e.g. 98"
                  />
                </div>
                <div>
                  <label class="field-label">Systolic BP <span class="unit">mmHg</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.systolic_bp"
                    :badge="vitalBadges.systolic_bp"
                    :min="40"
                    :max="300"
                    placeholder="e.g. 120"
                  />
                </div>
                <div>
                  <label class="field-label">Diastolic BP <span class="unit">mmHg</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.diastolic_bp"
                    :badge="vitalBadges.diastolic_bp"
                    :min="20"
                    :max="200"
                    placeholder="e.g. 80"
                  />
                </div>
                <div>
                  <label class="field-label">Blood Sugar <span class="unit">mmol/L</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.blood_sugar"
                    :badge="vitalBadges.blood_sugar"
                    step="0.1"
                    :min="0.5"
                    :max="50"
                    placeholder="e.g. 5.5"
                  />
                </div>
                <div>
                  <label class="field-label">MUAC <span class="unit">cm</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.muac"
                    :badge="vitalBadges.muac"
                    step="0.1"
                    :min="5"
                    :max="40"
                    placeholder="e.g. 12.5"
                  />
                </div>
                <div>
                  <label class="field-label">MUAC Score</label>
                  <VitalInputWithBadge
                    v-model="vitals.muac_score"
                    :badge="vitalBadges.muac_score"
                    input-type="text"
                    readonly
                    placeholder="Auto-calculated"
                    input-class="font-semibold"
                  />
                </div>
                <div>
                  <label class="field-label">Abd. Circumference <span class="unit">cm</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.abdominal_circumference"
                    :badge="vitalBadges.abdominal_circumference"
                    step="0.1"
                    :min="20"
                    :max="200"
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label class="field-label">Pain Scale <span class="unit">0–10</span></label>
                  <VitalInputWithBadge
                    v-model="vitals.pain_scale"
                    :badge="vitalBadges.pain_scale"
                    :min="0"
                    :max="10"
                    placeholder="e.g. 4"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Clinical Notes</h3>
              <ClinicalSuggestionsBanner
                class="mb-4"
                :fields="clinicalSuggestions.fields"
              />
              <div class="space-y-4">
                <FieldWithSuggestions
                  v-model="vitals.chief_complaint_brief"
                  label="Chief Complaint (brief)"
                  :rows="2"
                  placeholder="Patient's main presenting complaint…"
                  :suggestions="clinicalSuggestions.fields.chief_complaint_brief ?? clinicalSuggestions.fields.clinical_findings ?? []"
                />
                <FieldWithSuggestions
                  v-model="vitals.startup_interventions_notes"
                  label="Startup Interventions"
                  :rows="2"
                  placeholder="Any immediate interventions performed…"
                  :suggestions="clinicalSuggestions.fields.clinical_findings ?? []"
                />
                <div>
                  <label class="field-label">
                    Handover Note to Screening
                    <span class="text-xs font-normal text-neutral-400">(optional)</span>
                  </label>
                  <textarea
                    v-model="vitals.notes"
                    rows="2"
                    class="field-input"
                    placeholder="Anything the screening clinician should know…"
                  />
                </div>
              </div>
            </div>
            </div>

            <QueueFooter
              :show-hint="showQueueHint"
              aria-label="Queue patient — save vitals and send to screening"
              @click="openQueueFooter"
            />
          </form>
        </div>

        <!-- Read-only completed view -->
        <div
          v-else
          class="theme-surface rounded-2xl shadow-sm"
        >
          <div class="flex items-center justify-between theme-card-header px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700">
                <svg class="h-4 w-4 text-neutral-600 dark:text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="text-base font-semibold text-neutral-900 dark:text-white">Triage Vitals (Completed)</h2>
            </div>
            <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold uppercase text-neutral-600">
              Now at {{ stageText(encounter.stage) }}
            </span>
          </div>

          <div class="p-6">
            <p class="mb-4 text-sm text-neutral-500">
              <template v-if="isAtTriage && !encounter.can_edit">
                Receive this patient to edit vitals.
              </template>
              <template v-else>
                This encounter has moved past triage. Vitals are shown as read-only.
              </template>
            </p>

            <template v-if="triage">
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Vital Signs</h3>
              <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                <div v-for="card in currentVitalCards" :key="`ro-${card.label}`" class="vital-card">
                  <div class="vital-value text-lg">{{ card.value }}</div>
                  <div class="vital-label">{{ card.label }}</div>
                </div>
              </div>

              <template v-if="triage.chief_complaint_brief">
                <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">Chief Complaint</h3>
                <p class="mb-4 text-sm text-neutral-700 dark:text-neutral-300">{{ triage.chief_complaint_brief }}</p>
              </template>

              <template v-if="triage.startup_interventions_notes">
                <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">Startup Interventions</h3>
                <p class="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
                  {{ triage.startup_interventions_notes }}
                </p>
              </template>

              <template v-if="medications.length">
                <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  Startup Medications (Recorded)
                </h3>
                <div class="mb-4 overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-neutral-50 text-left dark:bg-neutral-700">
                        <th class="px-4 py-2 text-xs font-semibold uppercase text-neutral-600">Medication</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase text-neutral-600">Dosage</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase text-neutral-600">Route</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase text-neutral-600">Frequency</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase text-neutral-600">Given At</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
                      <tr v-for="med in medications" :key="med.id">
                        <td class="px-4 py-2 font-medium text-neutral-900 dark:text-white">{{ med.medication_name }}</td>
                        <td class="px-4 py-2 text-neutral-600">{{ med.dosage ?? '—' }}</td>
                        <td class="px-4 py-2 text-neutral-600">{{ med.route ?? '—' }}</td>
                        <td class="px-4 py-2 text-neutral-600">{{ med.frequency ?? '—' }}</td>
                        <td class="px-4 py-2 text-neutral-600">{{ med.administered_at ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </template>
            <p v-else class="text-sm text-neutral-400">No vitals were recorded during triage.</p>

            <div class="mt-4 border-t border-neutral-100 pt-4">
              <Link href="/triage/queue" class="btn-secondary">← Back to Queue</Link>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-6">
        <HandoverNotesCard :handover="handover" />

        <!-- Ward Admission -->
        <div
          v-if="isAtTriage"
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
                <p class="mt-1 text-xs text-neutral-500">Bed assignment during triage</p>
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
              <div v-if="canManageWardInTriage && !encounter.is_locked" class="flex flex-col gap-2 sm:flex-row">
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
              <div v-if="canManageWardInTriage && !encounter.is_locked" class="mt-4">
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

            <p v-if="!canManageWardInTriage" class="mt-2 text-xs text-neutral-400">
              You have view-only ward access in triage.
            </p>
          </div>
        </div>

        <!-- Startup Medications -->
        <div
          v-if="isAtTriage"
          class="theme-surface rounded-lg shadow-sm"
        >
          <div class="flex items-center justify-between theme-card-header px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700">
                <svg class="h-4 w-4 text-neutral-600 dark:text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 class="text-base font-semibold text-neutral-900 dark:text-white">Startup Medications</h2>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
              @click.stop="openMedsDrawer"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              View List
              <span
                v-if="activeMedCount > 0"
                class="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-neutral-900"
              >
                {{ activeMedCount }}
              </span>
            </button>
          </div>

          <div v-if="encounter.can_edit" class="px-6 py-4">
            <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-600">Add Medication</h4>
            <form class="space-y-3" @submit.prevent>
              <div class="relative" data-med-search>
                <label class="field-label">Medication Name <span class="text-red-500">*</span></label>
                <input
                  v-model="medForm.medication_name"
                  type="text"
                  class="field-input"
                  placeholder="Start typing to search..."
                  required
                  autocomplete="off"
                  @input="onMedSearchInput"
                />
                <div
                  v-if="medDropdownOpen"
                  class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto theme-surface rounded-lg shadow-lg"
                >
                  <button
                    v-for="result in medSearchResults"
                    :key="result.id"
                    type="button"
                    class="block w-full border-b border-neutral-50 px-4 py-2 text-left last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    @click="selectMedication(result)"
                  >
                    <p class="text-sm font-medium text-neutral-900 dark:text-white">
                      {{ result.name }} {{ result.strength }}
                    </p>
                    <p class="text-xs text-neutral-500">
                      {{ result.generic_name ?? '' }} · {{ result.form }} · {{ result.category }}
                    </p>
                    <p v-if="result.definition" class="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
                      {{ result.definition }}
                    </p>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label">Dosage</label>
                  <input v-model="medForm.dosage" type="text" list="dosage-units" class="field-input" placeholder="e.g. 500mg" />
                  <datalist id="dosage-units">
                    <option v-for="unit in dosageSuggestions" :key="unit" :value="unit" />
                  </datalist>
                </div>
                <div>
                  <label class="field-label">Route</label>
                  <select v-model="medForm.route" class="field-input">
                    <option value="">--Select--</option>
                    <option v-for="route in ROUTE_OPTIONS" :key="route" :value="route">{{ route }}</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label">Frequency</label>
                  <select v-model="medForm.frequency" class="field-input">
                    <option value="">--Select--</option>
                    <option v-for="freq in FREQUENCY_OPTIONS" :key="freq" :value="freq">
                      {{ freq === 'OD' ? 'OD (once daily)' : freq === 'BD' ? 'BD (twice daily)' : freq === 'TDS' ? 'TDS (3x daily)' : freq === 'QDS' ? 'QDS (4x daily)' : freq === 'PRN' ? 'PRN (as needed)' : freq }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="field-label">Administered At</label>
                  <input v-model="medForm.administered_at" type="datetime-local" class="field-input" />
                </div>
              </div>

              <div>
                <label class="field-label">Notes</label>
                <input v-model="medForm.notes" type="text" class="field-input" placeholder="Optional notes…" />
              </div>

              <ActionButton
                type="button"
                class="w-full !text-xs"
                :loading="addingMed"
                loading-text="Adding…"
                :disabled="!medForm.medication_name.trim()"
                @click="addMedication"
              >
                + Add Medication
              </ActionButton>
            </form>

            <div
              v-if="medFlash"
              class="mt-3 rounded px-3 py-2 text-xs font-medium"
              :class="medFlashError ? 'border border-red-300 bg-red-50 text-red-800' : 'border border-neutral-300 bg-neutral-100 text-neutral-800'"
            >
              {{ medFlash }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlays -->
    <template v-if="!encounter.is_locked">
      <div
        class="triage-dimmer fixed inset-x-0 bottom-0 top-16 z-[997] bg-black/25 dark:bg-black/45"
        :class="dimmerVisible ? 'is-visible' : ''"
        @click="closeAllOverlays"
      />

      <!-- Admit modal -->
      <div
        v-if="isAtTriage && canManageWardInTriage && admitModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/55" @click="closeAdmitModal" />

        <div class="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div class="flex flex-shrink-0 items-start justify-between border-b border-neutral-100 px-6 py-5">
            <div>
              <h2 class="text-base font-black text-neutral-900">Admit to Ward</h2>
              <p class="mt-0.5 text-xs text-neutral-500">
                Patient: <strong>{{ encounter.patient?.full_name }}</strong>
                · {{ encounter.patient?.gender ? encounter.patient.gender.charAt(0).toUpperCase() + encounter.patient.gender.slice(1) : '—' }}
                <template v-if="patientAge !== null"> · {{ patientAge }} yrs</template>
              </p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100"
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
              class="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500"
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
                <div class="text-sm font-semibold text-neutral-700">{{ ward.name }}</div>
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
                  <div class="text-sm font-black text-neutral-900">{{ bed.bed_number }}</div>
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

          <div class="flex flex-shrink-0 items-center justify-between border-t border-neutral-100 bg-neutral-50 px-6 py-4">
            <div class="text-sm text-neutral-500">
              <template v-if="selectedBedLabel()">
                <strong class="text-neutral-900">{{ selectedBedLabel() }}</strong> selected
              </template>
              <template v-else>Click an available bed to select it</template>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-white"
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

      <!-- Medications drawer -->
      <div
        class="triage-meds-drawer fixed top-0 right-0 z-[999] flex h-full w-[28rem] flex-col bg-white shadow-2xl dark:bg-neutral-900"
        :class="medsDrawerOpen ? 'is-open' : ''"
      >
        <button
          type="button"
          class="absolute left-0 top-1/2 flex h-16 w-6 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-md bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600"
          @click="medsDrawerOpen ? closeMedsDrawer() : openMedsDrawer()"
        >
          <svg
            class="h-4 w-4 transition-transform"
            :class="medsDrawerOpen ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div class="flex flex-shrink-0 items-center justify-between theme-card-header px-5 py-4">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wide text-neutral-900 dark:text-white">
              Startup Medications
            </h2>
            <p class="mt-0.5 text-[11px] text-neutral-500">
              {{ activeMedCount }} active
              <template v-if="discontinuedMedCount">
                · <span class="text-red-400">{{ discontinuedMedCount }} discontinued</span>
              </template>
            </p>
          </div>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="closeMedsDrawer"
          >
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div v-if="!medications.length" class="px-5 py-8 text-center">
            <svg class="mx-auto mb-2 h-8 w-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p class="text-xs text-neutral-400">No medications added yet</p>
          </div>

          <div v-else class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <div
              v-for="med in [...medications].sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))"
              :key="med.id"
              class="px-5 py-3"
              :class="med.status === 'discontinued' ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''"
            >
              <div class="mb-1 flex items-center gap-1.5">
                <span
                  v-if="med.source === 'screening'"
                  class="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700"
                >
                  Screening Rec.
                </span>
                <span
                  v-else
                  class="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-600"
                >
                  Triage
                </span>
                <span
                  v-if="med.status === 'discontinued'"
                  class="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600"
                >
                  Discontinued
                </span>
              </div>

              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0" :class="med.status === 'discontinued' ? 'opacity-60' : ''">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white"
                    :class="med.status === 'discontinued' ? 'line-through text-neutral-500' : ''"
                  >
                    {{ med.medication_name }}
                  </p>
                  <p class="mt-0.5 text-xs text-neutral-500">
                    {{ [med.dosage, med.route, med.frequency].filter(Boolean).join(' · ') }}
                  </p>
                  <p v-if="med.administered_at || med.recorded_by" class="mt-0.5 text-[11px] text-neutral-400">
                    {{ [med.administered_at, med.recorded_by].filter(Boolean).join(' · ') }}
                  </p>
                  <p v-if="med.notes" class="mt-0.5 text-[11px] italic text-neutral-400">{{ med.notes }}</p>
                </div>

                <button
                  v-if="med.status !== 'discontinued' && encounter.can_edit"
                  type="button"
                  class="mt-0.5 flex-shrink-0 rounded p-1 transition hover:bg-red-50"
                  title="Remove"
                  :disabled="removingMedId === med.id"
                  @click="removeMedication(med.id)"
                >
                  <svg class="h-3.5 w-3.5 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div v-else class="w-5 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <TriageQueueActionsModal
      v-model:show="queueActionsModalOpen"
      :complete-loading="vitals.processing"
      @complete="complete"
    />
  </StaffLayout>
</template>

<style scoped>
</style>
