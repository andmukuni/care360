<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import { computed, ref, watch } from 'vue'
import UserBadge from '~/components/staff/UserBadge.vue'
import GcsAssessmentDisplay from '~/components/encounter/GcsAssessmentDisplay.vue'
import LabRequestResultsTable from '~/components/lab/LabRequestResultsTable.vue'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import {
  abdominalCircumferenceBadge,
  bloodSugarBadge,
  bmiBadge,
  diastolicBpBadge,
  muacBadge,
  muacScoreBadge,
  painScaleBadge,
  pulseBadge,
  respiratoryRateBadge,
  oxygenSaturationBadge,
  severityFromBadge,
  systolicBpBadge,
  temperatureBadge,
  vitalValueClassForSeverity,
  type VitalBadge,
  type VitalSeverity,
} from '~/support/vital_badges'
import { isGcsAssessmentNotes } from '~/support/screening/gcs_assessment'

const props = defineProps<{
  encounter: any
}>()

type TriageVitalCard = {
  key: string
  value: string
  unit: string
  label: string
  badge: VitalBadge | null
  severity: VitalSeverity | null
}

const tab = ref('overview')
const showReopenModal = ref(false)

type ScreeningSubTabId =
  | 'overview'
  | 'complaints'
  | 'exam'
  | 'paediatric'
  | 'gynobs'
  | 'vitals'
  | 'prescription'
  | 'lab'
  | 'plan'
  | 'handover'

const screeningSubTab = ref<ScreeningSubTabId>('overview')

const screeningRecord = computed(() => props.encounter.screening ?? null)

const screeningHasTb = computed(() => {
  const screening = screeningRecord.value
  if (!screening) return false
  return !!(screening.tb?.symptoms?.length || screening.tb?.presumptive_tb_case_no)
})

const screeningSubTabs = computed(() => {
  const screening = screeningRecord.value
  if (!screening) return [] as Array<{ id: ScreeningSubTabId; label: string }>

  const tabs: Array<{ id: ScreeningSubTabId; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'complaints', label: 'Complaints & Histories' },
    { id: 'exam', label: 'Exam & Dx' },
  ]

  if (screening.paed_items?.length) {
    tabs.push({ id: 'paediatric', label: 'Paediatric History' })
  }
  if (screening.obstetrics_items?.length) {
    tabs.push({ id: 'gynobs', label: 'Gyn & OBS' })
  }

  tabs.push(
    { id: 'vitals', label: 'Vital Recheck' },
    { id: 'prescription', label: 'Prescription Requests' },
    { id: 'lab', label: 'Lab Request' },
    { id: 'plan', label: 'Plan' }
  )

  if (screening.handover_notes || screening.staff_assignments?.length) {
    tabs.push({ id: 'handover', label: 'Handover & Staff' })
  }

  return tabs
})

const screeningExamOnlySections = computed(() => {
  const screening = screeningRecord.value
  if (!screening) return []
  return screening.exam_sections.filter((field: { label: string }) => !isPlanField(field.label))
})

const screeningPlanSections = computed(() => {
  const screening = screeningRecord.value
  if (!screening) return []
  return screening.exam_sections.filter((field: { label: string }) => isPlanField(field.label))
})

watch(tab, (newTab) => {
  if (newTab === 'screening') {
    screeningSubTab.value = 'overview'
  }
})

watch(screeningSubTabs, (tabs) => {
  if (!tabs.some((item) => item.id === screeningSubTab.value)) {
    screeningSubTab.value = tabs[0]?.id ?? 'overview'
  }
})

const reopenForm = useForm({ reason: '', notes: '' })

function worstSeverity(...severities: Array<VitalSeverity | null | undefined>): VitalSeverity | null {
  const order: Record<VitalSeverity, number> = {
    normal: 0,
    low: 1,
    elevated: 2,
    abnormal: 3,
    critical: 4,
  }

  return severities.reduce<VitalSeverity | null>((worst, severity) => {
    if (!severity) return worst
    if (!worst || order[severity] > order[worst]) return severity
    return worst
  }, null)
}

function worstBadge(...badges: Array<VitalBadge | null | undefined>): VitalBadge | null {
  const order: Record<VitalSeverity, number> = {
    normal: 0,
    low: 1,
    elevated: 2,
    abnormal: 3,
    critical: 4,
  }

  return badges.reduce<VitalBadge | null>((worst, badge) => {
    if (!badge) return worst
    const severity = severityFromBadge(badge)
    if (!severity || severity === 'normal') return worst
    if (!worst) return badge
    const worstSeverityValue = severityFromBadge(worst)
    if (!worstSeverityValue) return badge
    return order[severity] > order[worstSeverityValue] ? badge : worst
  }, null)
}

function pushTriageVitalCard(
  cards: TriageVitalCard[],
  card: {
    key: string
    value: string | number | null | undefined
    unit: string
    label: string
    badge?: VitalBadge | null
    severity?: VitalSeverity | null
  }
) {
  if (card.value === null || card.value === undefined || card.value === '') return

  const badge = card.badge ?? null
  const severity = card.severity ?? severityFromBadge(badge)

  cards.push({
    key: card.key,
    value: String(card.value),
    unit: card.unit,
    label: card.label,
    badge,
    severity,
  })
}

const triageVitalCards = computed((): TriageVitalCard[] => {
  const vitals = props.encounter?.triage?.vitals
  if (!vitals) return []

  const cards: TriageVitalCard[] = []

  if (vitals.systolic_bp && vitals.diastolic_bp) {
    const bpBadge = worstBadge(
      systolicBpBadge(vitals.systolic_bp),
      diastolicBpBadge(vitals.diastolic_bp)
    )

    pushTriageVitalCard(cards, {
      key: 'bp',
      value: `${vitals.systolic_bp}/${vitals.diastolic_bp}`,
      unit: 'mmHg',
      label: 'Blood Pressure',
      badge: bpBadge,
      severity: worstSeverity(
        severityFromBadge(systolicBpBadge(vitals.systolic_bp)),
        severityFromBadge(diastolicBpBadge(vitals.diastolic_bp))
      ),
    })
  }

  pushTriageVitalCard(cards, {
    key: 'pulse',
    value: vitals.pulse,
    unit: 'bpm',
    label: 'Pulse',
    badge: pulseBadge(vitals.pulse),
  })

  pushTriageVitalCard(cards, {
    key: 'temperature',
    value: vitals.temperature,
    unit: '°C',
    label: 'Temperature',
    badge: temperatureBadge(vitals.temperature),
  })

  pushTriageVitalCard(cards, {
    key: 'oxygen_saturation',
    value: vitals.oxygen_saturation ? `${vitals.oxygen_saturation}%` : null,
    unit: 'SpO₂',
    label: 'O₂ Saturation',
    badge: oxygenSaturationBadge(vitals.oxygen_saturation),
  })

  pushTriageVitalCard(cards, {
    key: 'respiratory_rate',
    value: vitals.respiratory_rate,
    unit: 'breaths/min',
    label: 'Resp. Rate',
    badge: respiratoryRateBadge(vitals.respiratory_rate),
  })

  pushTriageVitalCard(cards, {
    key: 'blood_sugar',
    value: vitals.blood_sugar,
    unit: 'mmol/L',
    label: 'Blood Sugar',
    badge: bloodSugarBadge(vitals.blood_sugar),
  })

  pushTriageVitalCard(cards, {
    key: 'weight',
    value: vitals.weight,
    unit: 'kg',
    label: 'Weight',
  })

  pushTriageVitalCard(cards, {
    key: 'height',
    value: vitals.height,
    unit: 'cm',
    label: 'Height',
  })

  pushTriageVitalCard(cards, {
    key: 'bmi',
    value: vitals.bmi ? Number(vitals.bmi).toFixed(1) : null,
    unit: 'kg/m²',
    label: 'BMI',
    badge: bmiBadge(vitals.bmi),
  })

  if (vitals.pain_scale !== null && vitals.pain_scale !== undefined && vitals.pain_scale !== '') {
    pushTriageVitalCard(cards, {
      key: 'pain_scale',
      value: `${vitals.pain_scale}/10`,
      unit: '\u00a0',
      label: 'Pain Scale',
      badge: painScaleBadge(vitals.pain_scale),
    })
  }

  pushTriageVitalCard(cards, {
    key: 'muac',
    value: vitals.muac,
    unit: 'cm',
    label: 'MUAC',
    badge: muacBadge(vitals.muac),
  })

  pushTriageVitalCard(cards, {
    key: 'muac_score',
    value: vitals.muac_score,
    unit: '\u00a0',
    label: 'MUAC Score',
    badge: muacScoreBadge(vitals.muac_score),
  })

  pushTriageVitalCard(cards, {
    key: 'abdominal_circumference',
    value: vitals.abdominal_circumference,
    unit: 'cm',
    label: 'Abd. Circumference',
    badge: abdominalCircumferenceBadge(vitals.abdominal_circumference),
  })

  return cards
})

function vitalCardClass(severity: VitalSeverity | null) {
  return severity && severity !== 'normal' ? `vital-card--${severity}` : ''
}

type VitalCellDisplay = {
  display: string
  badge: VitalBadge | null
  severity: VitalSeverity | null
}

function bmiFromWeightHeight(
  weight: number | string | null | undefined,
  height: number | string | null | undefined
): number | null {
  const w = parseFloat(String(weight ?? ''))
  const h = parseFloat(String(height ?? ''))
  if (Number.isNaN(w) || Number.isNaN(h) || h <= 0) return null
  const heightM = h / 100
  return w / (heightM * heightM)
}

function vitalCellDisplay(
  display: string,
  badge: VitalBadge | null | undefined,
  severity?: VitalSeverity | null
): VitalCellDisplay {
  const resolvedBadge = badge ?? null
  return {
    display,
    badge: resolvedBadge,
    severity: severity ?? severityFromBadge(resolvedBadge),
  }
}

function vitalRecheckWeightCell(vr: {
  weight?: number | string | null
  height?: number | string | null
}): VitalCellDisplay {
  if (!vr.weight) return vitalCellDisplay('—', null)
  const bmi = bmiFromWeightHeight(vr.weight, vr.height)
  const badge = bmi !== null ? bmiBadge(bmi) : null
  return vitalCellDisplay(`${vr.weight} kg`, badge)
}

function vitalRecheckHeightCell(vr: { height?: number | string | null }): VitalCellDisplay {
  if (!vr.height) return vitalCellDisplay('—', null)
  return vitalCellDisplay(`${vr.height} cm`, null)
}

function vitalRecheckBpCell(vr: {
  bp_systolic?: number | string | null
  bp_diastolic?: number | string | null
}): VitalCellDisplay {
  if (!vr.bp_systolic || !vr.bp_diastolic) return vitalCellDisplay('—', null)
  const sysBadge = systolicBpBadge(vr.bp_systolic)
  const diaBadge = diastolicBpBadge(vr.bp_diastolic)
  return vitalCellDisplay(
    `${vr.bp_systolic}/${vr.bp_diastolic}`,
    worstBadge(sysBadge, diaBadge),
    worstSeverity(severityFromBadge(sysBadge), severityFromBadge(diaBadge))
  )
}

function vitalRecheckPulseCell(vr: { pulse?: number | string | null }): VitalCellDisplay {
  if (vr.pulse === null || vr.pulse === undefined || vr.pulse === '') {
    return vitalCellDisplay('—', null)
  }
  return vitalCellDisplay(String(vr.pulse), pulseBadge(vr.pulse))
}

function vitalRecheckTempCell(vr: { temperature?: number | string | null }): VitalCellDisplay {
  if (!vr.temperature) return vitalCellDisplay('—', null)
  return vitalCellDisplay(`${vr.temperature}°C`, temperatureBadge(vr.temperature))
}

function vitalRecheckSpo2Cell(vr: { spo2?: number | string | null }): VitalCellDisplay {
  if (!vr.spo2) return vitalCellDisplay('—', null)
  return vitalCellDisplay(`${vr.spo2}%`, oxygenSaturationBadge(vr.spo2))
}

const vitalRecheckRows = computed(() => {
  const rechecks = props.encounter?.screening?.vital_rechecks ?? []
  return rechecks.map((vr: Record<string, unknown>) => ({
    ...vr,
    weightCell: vitalRecheckWeightCell(vr),
    heightCell: vitalRecheckHeightCell(vr),
    bpCell: vitalRecheckBpCell(vr),
    pulseCell: vitalRecheckPulseCell(vr),
    tempCell: vitalRecheckTempCell(vr),
    spo2Cell: vitalRecheckSpo2Cell(vr),
  }))
})

function splitPipe(value: string | null | undefined) {
  if (!value) return []
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function hasPipe(value: string | null | undefined) {
  return !!value && value.includes('|')
}

function hasNewline(value: string | null | undefined) {
  return !!value && value.includes('\n')
}

function isDiagnosisField(label: string) {
  return label === 'Provisional Diagnosis' || label === 'Final Diagnosis'
}

function isPlanField(label: string) {
  return label === 'Management Plan' || label === 'Treatment Plan'
}

function stageText(value: string | null | undefined) {
  if (!value) return '—'
  const withSpaces = value.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

type StartupMedicationRow = {
  id: number
  medication_name: string
  dosage: string | null
  route: string | null
  frequency: string | null
  notes: string | null
  source: string
  administered_at: string | null
  administration_status: 'administered' | 'pending'
  recorded_by: { name: string } | null
  status: string
  discontinued_reason: string | null
}

const startupMedications = computed(
  (): StartupMedicationRow[] =>
    props.encounter.startup_medications ??
    props.encounter.triage?.startup_medications ??
    []
)

function startupSourceLabel(source: string | null | undefined) {
  return source === 'screening' ? 'Screening Rec.' : 'Triage'
}

function startupSourceBadgeClass(source: string | null | undefined) {
  return source === 'screening' ? 'b-blue' : 'b-gray'
}

function administrationBadgeClass(status: string | null | undefined) {
  return status === 'administered' ? 'b-green' : 'b-amber'
}

function medicationStatusBadgeClass(status: string | null | undefined) {
  return status === 'discontinued' ? 'b-red' : 'b-green'
}

function labThemeClasses(theme: string | null | undefined) {
  if (theme === 'critical') {
    return {
      border: 'border-red-300',
      left: 'border-l-red-500',
      head: 'bg-red-950',
      text: 'text-red-100',
    }
  }
  if (theme === 'abnormal') {
    return {
      border: 'border-amber-300',
      left: 'border-l-amber-500',
      head: 'bg-amber-950',
      text: 'text-amber-100',
    }
  }
  return {
    border: 'border-green-300',
    left: 'border-l-green-500',
    head: 'bg-green-950',
    text: 'text-green-100',
  }
}

function submitReopen(encounterId: number) {
  reopenForm.post(`/encounters/${encounterId}/reopen`, {
    onSuccess: () => {
      showReopenModal.value = false
      reopenForm.reset()
    },
  })
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/encounters" class="hover:text-neutral-700 transition">Encounters</Link>
      <span class="mx-2">/</span>
      <span class="text-neutral-700 dark:text-neutral-200 font-medium">{{ encounter.encounter_number }}</span>
    </template>

    <div
      v-if="encounter.is_locked"
      class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
    >
      This encounter is locked. Clinical edits are restricted until it is reopened.
    </div>

    <div class="hero-card mb-5">
      <div class="hero-top">
        <div class="hero-avatar">{{ encounter.hero.initials }}</div>

        <div class="flex-1 min-w-0">
          <div class="hero-name">{{ encounter.hero.patient_name }}</div>
          <div class="hero-sub">
            <span>{{ encounter.hero.patient_id }}</span>
            <span>{{ encounter.hero.gender }}</span>
            <span>{{ encounter.hero.birth_label }}</span>
            <span v-if="encounter.hero.phone">{{ encounter.hero.phone }}</span>
            <span v-if="encounter.hero.nrc">NRC {{ encounter.hero.nrc }}</span>
          </div>
          <div class="hero-badges mt-2">
            <span class="badge b-black font-mono text-xs">{{ encounter.hero.badges.encounter_number }}</span>
            <span class="badge" :class="encounter.hero.badges.lock_class">{{ encounter.hero.badges.lock }}</span>
            <span class="badge b-gray">{{ encounter.hero.badges.visit_type }}</span>
            <span
              v-if="encounter.hero.badges.attendant_label"
              class="badge"
              :class="encounter.hero.badges.attendant_class"
            >
              {{ encounter.hero.badges.attendant_label }}
            </span>
            <span v-if="encounter.hero.badges.priority" class="badge b-red">
              {{ encounter.hero.badges.priority }}
            </span>
            <span class="badge b-gray">{{ encounter.hero.badges.stage }}</span>
          </div>
        </div>

        <div class="text-right text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          <div class="font-semibold text-neutral-700 dark:text-neutral-200">Started {{ encounter.hero.started_date }}</div>
          <div>{{ encounter.hero.started_time }}</div>
          <div v-if="encounter.hero.closed_at" class="mt-1 text-green-600 font-semibold">
            Closed {{ encounter.hero.closed_at }}
          </div>
          <button
            v-if="encounter.can_reopen"
            type="button"
            class="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
            @click="showReopenModal = true"
          >
            Reopen Encounter
          </button>
        </div>
      </div>

      <div class="stage-strip">
        <div v-for="(stage, index) in encounter.stageStrip" :key="stage.key" class="stage-step">
          <div
            class="stage-dot"
            :class="
              stage.status === 'done'
                ? 'sd-done'
                : stage.status === 'current'
                  ? 'sd-current'
                  : 'sd-pending'
            "
          >
            <svg
              v-if="stage.status === 'done'"
              class="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            <svg
              v-else-if="stage.status === 'current'"
              class="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <circle cx="10" cy="10" r="4" />
            </svg>
            <svg v-else class="w-3 h-3 opacity-40" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="3" />
            </svg>
            {{ stage.label }}
          </div>
          <span v-if="index < encounter.stageStrip.length - 1" class="stage-arrow">›</span>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div class="stage-tab-nav-sticky">
        <nav class="enc-tab-nav">
        <button
          v-for="tb in encounter.tabs"
          :key="tb.id"
          type="button"
          class="enc-tab-btn"
          :class="{ active: tab === tb.id }"
          @click="tab = tb.id"
        >
          <span
            class="tab-dot"
            :class="tb.status === 'done' ? 'td-done' : tb.status === 'current' ? 'td-current' : 'td-empty'"
          />
          <svg class="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tb.icon" />
          </svg>
          {{ tb.label }}
        </button>
      </nav>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'overview' }">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="sc">
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span class="sc-title">Patient</span>
            </div>
            <div v-if="encounter.overview.patient" class="sc-bd">
              <div class="kv">
                <div class="kv-item">
                  <label>Full Name</label>
                  <span class="font-semibold">{{ encounter.overview.patient.full_name }}</span>
                </div>
                <div class="kv-item">
                  <label>Patient ID</label>
                  <span class="font-mono">{{ encounter.overview.patient.patient_id }}</span>
                </div>
                <div class="kv-item">
                  <label>Gender</label>
                  <span>{{ encounter.overview.patient.gender }}</span>
                </div>
                <div class="kv-item">
                  <label>Date of Birth</label>
                  <span>{{ encounter.overview.patient.date_of_birth }}</span>
                </div>
                <div class="kv-item">
                  <label>Age</label>
                  <span>{{ encounter.overview.patient.age }}</span>
                </div>
                <div class="kv-item">
                  <label>Phone</label>
                  <span>{{ encounter.overview.patient.phone }}</span>
                </div>
                <div class="kv-item">
                  <label>NRC</label>
                  <span>{{ encounter.overview.patient.nrc }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sc">
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span class="sc-title">Encounter Details</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item">
                  <label>Encounter #</label>
                  <span class="font-mono font-semibold">{{
                    encounter.overview.encounter.encounter_number
                  }}</span>
                </div>
                <div class="kv-item">
                  <label>Visit Type</label>
                  <span>{{ encounter.overview.encounter.visit_type }}</span>
                </div>
                <div class="kv-item">
                  <label>Priority</label>
                  <span>{{ encounter.overview.encounter.priority }}</span>
                </div>
                <div class="kv-item">
                  <label>Current Stage</label>
                  <span>{{ encounter.overview.encounter.current_stage }}</span>
                </div>
                <div class="kv-item">
                  <label>Status</label>
                  <span>{{ encounter.overview.encounter.status }}</span>
                </div>
                <div class="kv-item">
                  <label>Started By</label>
                  <span><UserBadge :user="encounter.overview.encounter.started_by" size="md" /></span>
                </div>
                <div class="kv-item">
                  <label>Started At</label>
                  <span>{{ encounter.overview.encounter.started_at ?? '—' }}</span>
                </div>
                <div class="kv-item">
                  <label>Closed At</label>
                  <span>{{ encounter.overview.encounter.closed_at }}</span>
                </div>
              </div>
              <div
                v-if="encounter.overview.encounter.closure_notes"
                class="mt-3 theme-surface p-3 rounded"
              >
                <p class="text-[10px] font-bold text-neutral-500 uppercase">Closure Notes</p>
                <p class="text-sm text-neutral-700 mt-1">{{ encounter.overview.encounter.closure_notes }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
          <div v-for="item in encounter.overview.summary_items" :key="item.label" class="sc !mb-0">
            <div class="sc-bd !py-3">
              <div class="flex items-start gap-3">
                <div
                  class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs mt-0.5"
                  :class="item.ok ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'"
                >
                  <svg
                    v-if="item.ok"
                    class="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-neutral-500 uppercase">{{ item.label }}</p>
                  <p class="text-xs text-neutral-700 mt-0.5 leading-tight">{{ item.detail }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="
            encounter.overview.admission.ward ||
            encounter.overview.admission.bed_assignments.length ||
            encounter.overview.admission.discharge_summary
          "
          class="sc mt-4"
        >
          <div class="sc-hd">
            <svg
              class="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span class="sc-title">Admission & Discharge</span>
          </div>
          <div class="sc-bd space-y-4">
            <div v-if="encounter.overview.admission.ward" class="kv">
              <div class="kv-item">
                <label>Ward</label>
                <span class="font-semibold">{{ encounter.overview.admission.ward.name }}</span>
              </div>
              <div class="kv-item">
                <label>Assigned At</label>
                <span>{{ encounter.overview.admission.ward.assigned_at ?? '—' }}</span>
              </div>
              <div class="kv-item">
                <label>Assigned By</label>
                <span><UserBadge :user="encounter.overview.admission.ward.assigned_by" size="sm" /></span>
              </div>
            </div>

            <div v-if="encounter.overview.admission.bed_assignments.length">
              <p class="text-[10px] font-bold text-neutral-500 uppercase mb-2">Bed Assignments</p>
              <table class="enc-table">
                <thead>
                  <tr>
                    <th>Bed</th>
                    <th>Admitted</th>
                    <th>Admitted By</th>
                    <th>Discharged</th>
                    <th>Discharged By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="assignment in encounter.overview.admission.bed_assignments"
                    :key="assignment.id"
                  >
                    <td class="font-medium">{{ assignment.bed }}</td>
                    <td>{{ assignment.admitted_at ?? '—' }}</td>
                    <td><UserBadge :user="assignment.admitted_by" size="sm" /></td>
                    <td>{{ assignment.discharged_at }}</td>
                    <td>
                      <UserBadge v-if="assignment.discharged_by" :user="assignment.discharged_by" size="sm" />
                      <template v-else>—</template>
                    </td>
                    <td class="text-neutral-500 text-xs">{{ assignment.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="encounter.overview.admission.discharge_summary"
              class="theme-surface p-3 rounded"
            >
              <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">
                Discharge Summary{{
                  encounter.overview.admission.discharge_summary.title
                    ? ` — ${encounter.overview.admission.discharge_summary.title}`
                    : ''
                }}
              </p>
              <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                {{ encounter.overview.admission.discharge_summary.summary }}
              </p>
              <p class="text-[11px] text-neutral-400 mt-2">
                By
                <UserBadge
                  :user="encounter.overview.admission.discharge_summary.authored_by"
                  size="sm"
                />
                <template v-if="encounter.overview.admission.discharge_summary.discharged_at">
                  · {{ encounter.overview.admission.discharge_summary.discharged_at }}
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'registration' }">
        <div v-if="encounter.registration" class="sc">
          <div class="sc-hd">
            <svg
              class="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span class="sc-title">Registration Record</span>
            <span class="ml-auto badge b-green">Completed</span>
          </div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item">
                <label>Registrar</label>
                <span><UserBadge :user="encounter.registration.registrar" size="sm" /></span>
              </div>
              <div class="kv-item">
                <label>Registered At</label>
                <span>{{ encounter.registration.registered_at }}</span>
              </div>
              <div class="kv-item">
                <label>Attendant Status</label>
                <span>{{ encounter.registration.attendant_status }}</span>
              </div>
            </div>
            <div
              v-if="encounter.registration.registration_notes"
              class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded"
            >
              <p class="text-[10px] font-bold text-amber-600 uppercase mb-1">Notes</p>
              <p class="text-sm text-neutral-700">{{ encounter.registration.registration_notes }}</p>
            </div>
          </div>
        </div>
        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>No registration record for this encounter.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'triage' }">
        <template v-if="encounter.triage">
          <div class="sc">
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span class="sc-title">Vital Signs</span>
              <span class="ml-2 text-[11px] text-neutral-400">{{ encounter.triage.triage_at }}</span>
              <span class="ml-auto badge b-gray">
                Nurse: <UserBadge :user="encounter.triage.nurse" size="sm" />
              </span>
            </div>
            <div class="sc-bd sc-bd--compact">
              <div class="vitals-grid vitals-grid--profile">
                <div
                  v-for="card in triageVitalCards"
                  :key="card.key"
                  class="vital-card"
                  :class="vitalCardClass(card.severity)"
                >
                  <div class="vital-label">{{ card.label }}</div>
                  <div class="vital-val" :class="vitalValueClassForSeverity(card.severity)">
                    {{ card.value }}
                    <span v-if="card.value !== '—'" class="vital-unit-inline">{{ card.unit }}</span>
                  </div>
                  <span
                    v-if="card.badge?.abnormal"
                    class="ph-vital-status"
                    :class="card.severity ? `ph-vital-status--${card.severity}` : ''"
                  >
                    {{ card.badge.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="startupMedications.length" class="sc">
          <div class="sc-hd">
            <svg
              class="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <span class="sc-title">Startup Medications</span>
            <span class="ml-auto badge b-gray">{{ startupMedications.length }}</span>
          </div>
          <div class="sc-bd overflow-x-auto">
            <table class="enc-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dosage</th>
                  <th>Route</th>
                  <th>Frequency</th>
                  <th>Source</th>
                  <th>Administration</th>
                  <th>Recorded By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="med in startupMedications" :key="med.id">
                  <td class="drug-name">
                    {{ med.medication_name }}
                    <span v-if="med.notes" class="block text-[10px] font-normal text-neutral-400">
                      {{ med.notes }}
                    </span>
                  </td>
                  <td>{{ med.dosage ?? '—' }}</td>
                  <td>{{ med.route ?? '—' }}</td>
                  <td>{{ med.frequency ?? '—' }}</td>
                  <td>
                    <span class="badge" :class="startupSourceBadgeClass(med.source)">
                      {{ startupSourceLabel(med.source) }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      :class="administrationBadgeClass(med.administration_status)"
                    >
                      {{ med.administration_status === 'administered' ? 'Administered' : 'Pending' }}
                    </span>
                    <span
                      v-if="med.administered_at"
                      class="block text-[10px] text-neutral-400 mt-0.5"
                    >
                      {{ med.administered_at }}
                    </span>
                  </td>
                  <td><UserBadge :user="med.recorded_by" size="sm" /></td>
                  <td>
                    <template v-if="med.status === 'discontinued'">
                      <span class="badge b-red">Discontinued</span>
                      <span v-if="med.discontinued_reason" class="block text-[10px] text-neutral-400 mt-0.5">
                        {{ med.discontinued_reason }}
                      </span>
                    </template>
                    <span v-else class="badge" :class="medicationStatusBadgeClass(med.status)">
                      {{ stageText(med.status ?? 'active') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <template v-if="encounter.triage">
          <div
            v-if="
              encounter.triage.chief_complaint_brief ||
              encounter.triage.triage_notes ||
              encounter.triage.startup_interventions_notes ||
              encounter.triage.startup_medications_notes
            "
            class="sc"
          >
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span class="sc-title">Chief Complaint & Notes</span>
            </div>
            <div class="sc-bd space-y-3">
              <div v-if="encounter.triage.chief_complaint_brief">
                <p class="kv-item"><label>Chief Complaint</label></p>
                <p class="text-sm text-neutral-700 mt-1">{{ encounter.triage.chief_complaint_brief }}</p>
              </div>
              <div v-if="encounter.triage.startup_interventions_notes">
                <p class="kv-item"><label>Startup Interventions</label></p>
                <p class="text-sm text-neutral-700 mt-1">{{ encounter.triage.startup_interventions_notes }}</p>
              </div>
              <div v-if="encounter.triage.startup_medications_notes">
                <p class="kv-item"><label>Startup Medication Notes</label></p>
                <p class="text-sm text-neutral-700 mt-1">{{ encounter.triage.startup_medications_notes }}</p>
              </div>
              <div v-if="encounter.triage.triage_notes">
                <p class="kv-item"><label>Triage Notes</label></p>
                <p class="text-sm text-neutral-700 mt-1">{{ encounter.triage.triage_notes }}</p>
              </div>
            </div>
          </div>
        </template>

        <div v-else-if="!encounter.triage" class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <p>No triage record for this encounter.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'screening' }">
        <template v-if="encounter.screening">
          <div class="stage-sub-tab-nav-sticky">
            <nav class="enc-sub-tab-nav">
            <button
              v-for="subTab in screeningSubTabs"
              :key="subTab.id"
              type="button"
              class="enc-sub-tab-btn"
              :class="{ active: screeningSubTab === subTab.id }"
              @click="screeningSubTab = subTab.id"
            >
              {{ subTab.label }}
            </button>
          </nav>
          </div>

          <div v-if="screeningSubTab === 'overview'" class="sc">
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <span class="sc-title">Initial Screening</span>
              <span class="ml-2 badge b-gray">{{ encounter.screening.screening_type }}</span>
              <span class="ml-auto badge b-gray">
                <UserBadge :user="encounter.screening.clinician" size="sm" />
              </span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item">
                  <label>Clinician</label>
                  <span><UserBadge :user="encounter.screening.clinician" size="sm" /></span>
                </div>
                <div class="kv-item">
                  <label>Lab Requested</label>
                  <span>{{ encounter.screening.lab_requested ? 'Yes' : 'No' }}</span>
                </div>
                <div class="kv-item">
                  <label>Prescribed</label>
                  <span>{{ encounter.screening.prescribed ? 'Yes' : 'No' }}</span>
                </div>
                <div v-if="encounter.screening.screening_started_at" class="kv-item">
                  <label>Started At</label>
                  <span>{{ encounter.screening.screening_started_at }}</span>
                </div>
                <div v-if="encounter.screening.screening_completed_at" class="kv-item">
                  <label>Completed At</label>
                  <span>{{ encounter.screening.screening_completed_at }}</span>
                </div>
              </div>
            </div>
          </div>

          <template v-else-if="screeningSubTab === 'complaints'">
            <div class="sc">
              <div class="sc-hd">
                <span class="sc-title">Complaints & Histories</span>
              </div>
              <div class="sc-bd">
                <div
                  v-if="encounter.screening.complaint_sections.length"
                  class="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div
                    v-for="field in encounter.screening.complaint_sections"
                    :key="field.label"
                    class="theme-surface p-3 rounded"
                    :class="hasNewline(field.value) ? 'md:col-span-2' : ''"
                  >
                    <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">{{ field.label }}</p>
                    <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{{ field.value }}</p>
                  </div>
                </div>
                <p v-else class="text-sm text-neutral-500">No complaints or history recorded.</p>
              </div>
            </div>

            <div v-if="screeningHasTb" class="sc">
              <div class="sc-hd">
                <span class="sc-title">TB Screening</span>
                <span v-if="encounter.screening.tb.presumptive_tb_case_no" class="ml-auto badge b-amber">
                  Presumptive TB Case № {{ encounter.screening.tb.presumptive_tb_case_no }}
                </span>
              </div>
              <div class="sc-bd">
                <template v-if="encounter.screening.tb.symptoms.length">
                  <p class="text-[10px] font-bold text-neutral-500 uppercase mb-2">Reported Symptoms</p>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="symptom in encounter.screening.tb.symptoms" :key="symptom" class="med-chip">
                      {{ symptom }}
                    </span>
                  </div>
                </template>
                <p v-else class="text-sm text-neutral-500">No TB symptoms recorded.</p>
              </div>
            </div>
          </template>

          <div v-else-if="screeningSubTab === 'exam'">
            <div v-if="screeningExamOnlySections.length" class="sc">
              <div class="sc-hd">
                <svg
                  class="w-4 h-4 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span class="sc-title">Examination & Diagnosis</span>
              </div>
              <div class="sc-bd grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="field in screeningExamOnlySections"
                  :key="field.label"
                  class="theme-surface p-3 rounded"
                  :class="{
                    'md:col-span-2 border-l-4 border-l-neutral-800': isDiagnosisField(field.label),
                    'md:col-span-2 border-l-4 border-l-blue-500': isPlanField(field.label),
                    'md:col-span-2 !p-0 !bg-transparent !border-0': isGcsAssessmentNotes(field.value),
                  }"
                >
                  <p v-if="!isGcsAssessmentNotes(field.value)" class="text-[10px] font-bold text-neutral-500 uppercase mb-1">{{ field.label }}</p>
                  <GcsAssessmentDisplay v-if="isGcsAssessmentNotes(field.value)" :value="field.value" />
                  <div v-else-if="hasPipe(field.value)" class="flex flex-wrap gap-1">
                    <span
                      v-for="part in splitPipe(field.value)"
                      :key="part"
                      class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-neutral-700 theme-surface"
                    >
                      {{ part }}
                    </span>
                  </div>
                  <p
                    v-else
                    class="text-sm leading-relaxed"
                    :class="{
                      'font-semibold text-neutral-800': isDiagnosisField(field.label),
                      'text-neutral-700 whitespace-pre-line': !isDiagnosisField(field.label),
                    }"
                  >
                    {{ field.value }}
                  </p>
                </div>
              </div>
            </div>
            <div v-else class="sc">
              <div class="sc-bd">
                <div class="empty-state">
                  <p>No examination or diagnosis recorded.</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'paediatric'" class="sc">
            <div class="sc-hd"><span class="sc-title">Paediatric History</span></div>
            <div class="sc-bd grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="field in encounter.screening.paed_items"
                :key="field.label"
                class="theme-surface p-3 rounded"
                :class="hasNewline(field.value) ? 'md:col-span-2' : ''"
              >
                <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">{{ field.label }}</p>
                <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{{ field.value }}</p>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'gynobs'" class="sc">
            <div class="sc-hd"><span class="sc-title">Gynaecology & Obstetrics History</span></div>
            <div class="sc-bd grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="field in encounter.screening.obstetrics_items"
                :key="field.label"
                class="theme-surface p-3 rounded"
                :class="hasNewline(field.value) ? 'md:col-span-2' : ''"
              >
                <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">{{ field.label }}</p>
                <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{{ field.value }}</p>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'vitals'" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Vital Rechecks</span>
              <span v-if="encounter.screening.vital_rechecks.length" class="ml-auto badge b-gray">
                {{ encounter.screening.vital_rechecks.length }}
              </span>
            </div>
            <div v-if="encounter.screening.vital_rechecks.length" class="sc-bd">
              <table class="enc-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Weight</th>
                    <th>Height</th>
                    <th>BP</th>
                    <th>Pulse</th>
                    <th>Temp</th>
                    <th>SpO₂</th>
                    <th>Recorded By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vr in vitalRecheckRows" :key="vr.id">
                    <td>{{ vr.when }}</td>
                    <td>
                      <div class="enc-vital-cell">
                        <span :class="vitalValueClassForSeverity(vr.weightCell.severity)">
                          {{ vr.weightCell.display }}
                        </span>
                        <span
                          v-if="vr.weightCell.badge?.abnormal"
                          class="ph-vital-status"
                          :class="
                            vr.weightCell.severity ? `ph-vital-status--${vr.weightCell.severity}` : ''
                          "
                        >
                          {{ vr.weightCell.badge?.label }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="enc-vital-cell">
                        <span>{{ vr.heightCell.display }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="enc-vital-cell">
                        <span :class="vitalValueClassForSeverity(vr.bpCell.severity)">
                          {{ vr.bpCell.display }}
                        </span>
                        <span
                          v-if="vr.bpCell.badge?.abnormal"
                          class="ph-vital-status"
                          :class="vr.bpCell.severity ? `ph-vital-status--${vr.bpCell.severity}` : ''"
                        >
                          {{ vr.bpCell.badge?.label }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="enc-vital-cell">
                        <span :class="vitalValueClassForSeverity(vr.pulseCell.severity)">
                          {{ vr.pulseCell.display }}
                        </span>
                        <span
                          v-if="vr.pulseCell.badge?.abnormal"
                          class="ph-vital-status"
                          :class="
                            vr.pulseCell.severity ? `ph-vital-status--${vr.pulseCell.severity}` : ''
                          "
                        >
                          {{ vr.pulseCell.badge?.label }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="enc-vital-cell">
                        <span :class="vitalValueClassForSeverity(vr.tempCell.severity)">
                          {{ vr.tempCell.display }}
                        </span>
                        <span
                          v-if="vr.tempCell.badge?.abnormal"
                          class="ph-vital-status"
                          :class="
                            vr.tempCell.severity ? `ph-vital-status--${vr.tempCell.severity}` : ''
                          "
                        >
                          {{ vr.tempCell.badge?.label }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="enc-vital-cell">
                        <span :class="vitalValueClassForSeverity(vr.spo2Cell.severity)">
                          {{ vr.spo2Cell.display }}
                        </span>
                        <span
                          v-if="vr.spo2Cell.badge?.abnormal"
                          class="ph-vital-status"
                          :class="
                            vr.spo2Cell.severity ? `ph-vital-status--${vr.spo2Cell.severity}` : ''
                          "
                        >
                          {{ vr.spo2Cell.badge?.label }}
                        </span>
                      </div>
                    </td>
                    <td><UserBadge :user="vr.recorded_by" size="sm" /></td>
                    <td class="text-neutral-500 text-xs">{{ vr.notes ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="sc-bd">
              <div class="empty-state">
                <p>No vital rechecks recorded during screening.</p>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'prescription'" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Prescription Requests</span>
              <span v-if="encounter.screening.prescriptions?.length" class="ml-auto badge b-gray">
                {{ encounter.screening.prescriptions.length }}
              </span>
            </div>
            <div v-if="encounter.screening.prescriptions?.length" class="sc-bd space-y-4">
              <div
                v-for="rx in encounter.screening.prescriptions"
                :key="rx.id"
                class="theme-surface rounded overflow-hidden"
              >
                <div class="theme-card-header flex items-center gap-2 px-4 py-2">
                  <span class="font-mono text-xs font-bold text-neutral-800">{{ rx.prescription_number }}</span>
                  <span class="badge b-gray">{{ rx.status }}</span>
                  <span class="ml-auto text-xs text-neutral-500">
                    <UserBadge :user="rx.prescribed_by" size="sm" />
                    · {{ rx.prescribed_at }}
                  </span>
                </div>
                <table class="enc-table">
                  <thead>
                    <tr>
                      <th>Drug</th>
                      <th>Dose</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Qty</th>
                      <th>Route</th>
                      <th>Dates</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in rx.items" :key="item.id">
                      <td class="font-medium">
                        {{ item.drug_name }}
                        <span v-if="item.strength || item.formulation" class="block text-[10px] font-normal text-neutral-400">
                          {{ [item.strength, item.formulation].filter(Boolean).join(' ') }}
                        </span>
                        <span v-if="item.is_passer_by" class="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Passer-by</span>
                      </td>
                      <td>
                        <span v-if="item.item_per_dose && item.formulation">{{ item.item_per_dose }} {{ item.formulation }}</span>
                        <span v-if="item.item_per_dose && item.formulation && item.dose"> · </span>
                        {{ item.dose ?? '—' }}
                      </td>
                      <td>
                        {{ item.frequency_unit || item.frequency || '—' }}
                        <span v-if="item.time_per" class="block text-[10px] text-neutral-400">{{ item.time_per }}</span>
                      </td>
                      <td>
                        {{ item.duration ?? '—' }}
                        <span v-if="item.duration_unit" class="text-neutral-400"> {{ item.duration_unit }}</span>
                      </td>
                      <td class="font-semibold">{{ item.quantity_prescribed ?? '—' }}</td>
                      <td>{{ item.route ?? '—' }}</td>
                      <td class="text-xs text-neutral-500">
                        {{ [item.start_date, item.end_date].filter(Boolean).join(' → ') || '—' }}
                      </td>
                      <td class="text-xs text-neutral-500">{{ item.instructions ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="rx.notes" class="px-4 py-2 text-xs text-neutral-500 border-t border-neutral-100">
                  {{ rx.notes }}
                </p>
              </div>
            </div>
            <div v-else class="sc-bd">
              <div class="empty-state">
                <p>No prescription requests recorded during screening.</p>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'lab'">
            <div v-if="encounter.screening.lab_request" class="sc">
              <div class="sc-hd">
                <span class="sc-title">Lab Request</span>
                <span class="ml-2 badge b-gray">{{ encounter.screening.lab_request.request_number }}</span>
                <span class="ml-auto badge" :class="encounter.screening.lab_request.status === 'completed' ? 'b-green' : 'b-amber'">
                  {{ encounter.screening.lab_request.status }}
                </span>
              </div>
              <div class="sc-bd">
              <div class="kv mb-4">
                <div class="kv-item">
                  <label>Priority</label>
                  <span>{{ encounter.screening.lab_request.priority_level }}</span>
                </div>
                <div class="kv-item">
                  <label>Requested By</label>
                  <span><UserBadge :user="encounter.screening.lab_request.requested_by" size="sm" /></span>
                </div>
                <div v-if="encounter.screening.lab_request.requested_at" class="kv-item">
                  <label>Requested At</label>
                  <span>{{ encounter.screening.lab_request.requested_at }}</span>
                </div>
              </div>
              <p v-if="encounter.screening.lab_request.request_notes" class="mb-3 text-sm text-neutral-700 whitespace-pre-line">
                {{ encounter.screening.lab_request.request_notes }}
              </p>
              <LabRequestResultsTable
                :items="encounter.screening.lab_request.items ?? []"
                compact
              />
              </div>
            </div>
            <div v-else class="sc">
              <div class="sc-hd">
                <span class="sc-title">Lab Request</span>
              </div>
              <div class="sc-bd">
                <div class="empty-state">
                  <p>No lab request created during screening.</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="screeningSubTab === 'plan'">
            <div class="sc">
              <div class="sc-hd">
                <span class="sc-title">Disposition</span>
              </div>
              <div class="sc-bd">
                <div class="kv">
                  <div class="kv-item">
                    <label>Lab Requested</label>
                    <span>{{ encounter.screening.lab_requested ? 'Yes — queue to Lab' : 'No — queue to Pharmacy' }}</span>
                  </div>
                  <div class="kv-item">
                    <label>Prescribed</label>
                    <span>{{ encounter.screening.prescribed ? 'Yes' : 'No' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="screeningPlanSections.length" class="sc">
              <div class="sc-hd">
                <span class="sc-title">Treatment & Management Plan</span>
              </div>
              <div class="sc-bd grid grid-cols-1 gap-4">
                <div
                  v-for="field in screeningPlanSections"
                  :key="field.label"
                  class="theme-surface p-3 rounded border-l-4 border-l-blue-500"
                >
                  <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">{{ field.label }}</p>
                  <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{{ field.value }}</p>
                </div>
              </div>
            </div>
            <div v-else class="sc">
              <div class="sc-hd">
                <span class="sc-title">Treatment & Management Plan</span>
              </div>
              <div class="sc-bd">
                <div class="empty-state">
                  <p>No treatment or management plan recorded.</p>
                </div>
              </div>
            </div>

            <div v-if="encounter.screening.handover_notes" class="sc border-l-4 border-l-amber-400">
              <div class="sc-hd">
                <span class="sc-title">Handover Note</span>
              </div>
              <div class="sc-bd">
                <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  {{ encounter.screening.handover_notes }}
                </p>
              </div>
            </div>
          </div>

          <template v-else-if="screeningSubTab === 'handover'">
            <div v-if="encounter.screening.handover_notes" class="sc border-l-4 border-l-amber-400">
              <div class="sc-hd">
                <span class="sc-title">Handover Note</span>
              </div>
              <div class="sc-bd">
                <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  {{ encounter.screening.handover_notes }}
                </p>
              </div>
            </div>

            <div v-if="encounter.screening.staff_assignments.length" class="sc">
              <div class="sc-hd">
                <span class="sc-title">Screening Staff</span>
                <span class="ml-auto badge b-gray">{{ encounter.screening.staff_assignments.length }}</span>
              </div>
              <div class="sc-bd">
                <table class="enc-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Role</th>
                      <th>Participation</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="assignment in encounter.screening.staff_assignments" :key="assignment.id">
                      <td><UserBadge :user="assignment.user" size="sm" /></td>
                      <td>{{ assignment.role_name ?? '—' }}</td>
                      <td>{{ assignment.participation_type ?? '—' }}</td>
                      <td class="text-neutral-500 text-xs">{{ assignment.notes ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </template>

        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>Initial screening not yet completed.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'lab' }">
        <template v-if="encounter.lab">
          <div
            class="sc border border-l-4"
            :class="[labThemeClasses(encounter.lab.card_theme).border, labThemeClasses(encounter.lab.card_theme).left]"
          >
            <div
              class="sc-hd border-b"
              :class="[labThemeClasses(encounter.lab.card_theme).head, labThemeClasses(encounter.lab.card_theme).border]"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <span class="sc-title" :class="labThemeClasses(encounter.lab.card_theme).text">
                Lab Request — {{ encounter.lab.request_number }}
              </span>
              <span class="ml-2 badge" :class="encounter.lab.status === 'completed' ? 'b-green' : 'b-amber'">
                {{ encounter.lab.status }}
              </span>
              <span v-if="encounter.lab.critical_count > 0" class="badge b-red ml-1">
                {{ encounter.lab.critical_count }} Critical
              </span>
              <span v-if="encounter.lab.abnormal_count > 0" class="badge b-amber ml-1">
                {{ encounter.lab.abnormal_count }} Abnormal
              </span>
              <span v-if="encounter.lab.normal_count > 0" class="badge b-green ml-1">
                {{ encounter.lab.normal_count }} Normal
              </span>
            </div>

            <div class="sc-bd">
              <div class="kv mb-4">
                <div class="kv-item">
                  <label>Requested By</label>
                  <span><UserBadge :user="encounter.lab.requested_by" size="sm" /></span>
                </div>
                <div class="kv-item">
                  <label>Priority</label>
                  <span>{{ encounter.lab.priority_level }}</span>
                </div>
                <div class="kv-item">
                  <label>Requested At</label>
                  <span>{{ encounter.lab.requested_at }}</span>
                </div>
                <div class="kv-item">
                  <label>Completed At</label>
                  <span>{{ encounter.lab.completed_at ?? '—' }}</span>
                </div>
              </div>

              <div
                v-if="encounter.lab.request_notes"
                class="theme-surface p-3 rounded mb-4"
              >
                <p class="text-[10px] font-bold text-neutral-500 uppercase mb-1">Request Notes</p>
                <p class="text-sm text-neutral-700">{{ encounter.lab.request_notes }}</p>
              </div>

              <LabRequestResultsTable :items="encounter.lab.items ?? []" />

              <template v-if="encounter.lab.samples.length">
                <p class="text-[10px] font-bold text-neutral-500 uppercase mb-2">Samples</p>
                <table class="enc-table mb-5">
                  <thead>
                    <tr>
                      <th>Sample Type</th>
                      <th>Label</th>
                      <th>Collected By</th>
                      <th>Collected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="sample in encounter.lab.samples" :key="sample.id">
                      <td class="font-medium">{{ sample.sample_type }}</td>
                      <td>{{ sample.sample_label ?? '—' }}</td>
                      <td><UserBadge :user="sample.collected_by" size="sm" /></td>
                      <td>{{ sample.collected_at }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </div>
          </div>
        </template>

        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <p>No lab request for this encounter.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'review' }">
        <template v-if="encounter.review">
          <div v-if="encounter.review.final_diagnosis" class="sc border-l-4 border-l-neutral-800">
            <div class="sc-hd">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <span class="sc-title">Final Diagnosis</span>
              <span class="ml-auto badge b-green">Confirmed</span>
            </div>
            <div class="sc-bd">
              <p class="text-base font-bold text-neutral-900 leading-relaxed">{{ encounter.review.final_diagnosis }}</p>
              <div class="mt-3 flex gap-2">
                <span class="badge b-gray">Clinician: <UserBadge :user="encounter.review.clinician" size="sm" /></span>
                <span v-if="encounter.review.prescribed" class="badge b-green">Prescription Issued</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="field in encounter.review.sections" :key="field.label" class="sc !mb-0">
              <div class="sc-hd"><span class="sc-title">{{ field.label }}</span></div>
              <div class="sc-bd">
                <div v-if="hasPipe(field.value)" class="flex flex-wrap gap-1">
                  <span
                    v-for="part in splitPipe(field.value)"
                    :key="part"
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-neutral-700 bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {{ part }}
                  </span>
                </div>
                <p v-else class="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{{ field.value }}</p>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <p>Screening review not yet completed.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'pharmacy' }">
        <template v-if="encounter.pharmacy.prescriptions.length">
          <div v-for="(prescription, index) in encounter.pharmacy.prescriptions" :key="prescription.id" class="sc">
            <div class="sc-hd">
              <svg
                class="w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span class="sc-title">Prescription — {{ prescription.prescription_number }}</span>
              <span class="ml-2 badge" :class="prescription.status === 'dispensed' ? 'b-green' : 'b-blue'">
                {{ stageText(prescription.status) }}
              </span>
              <span v-if="encounter.pharmacy.prescriptions.length > 1" class="ml-1 badge b-gray">
                {{ index + 1 }} of {{ encounter.pharmacy.prescriptions.length }}
              </span>
              <span class="ml-auto badge b-gray">
                <UserBadge :user="prescription.prescribed_by" size="sm" /> · {{ prescription.prescribed_at }}
              </span>
            </div>
            <div class="sc-bd">
              <div v-if="prescription.notes" class="p-3 bg-blue-50 border border-blue-200 rounded mb-4 text-sm text-blue-800">
                <span class="font-bold">Note:</span> {{ prescription.notes }}
              </div>
              <table v-if="prescription.items.length" class="enc-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Dose</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Qty</th>
                    <th>Route</th>
                    <th>Dates</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in prescription.items" :key="item.id">
                    <td class="drug-name">
                      {{ item.drug_name }}
                      <span v-if="item.strength || item.formulation" class="block text-[10px] font-normal text-neutral-400">
                        {{ [item.strength, item.formulation].filter(Boolean).join(' ') }}
                      </span>
                    </td>
                    <td>
                      <span v-if="item.item_per_dose && item.formulation">{{ item.item_per_dose }} {{ item.formulation }}</span>
                      <span v-if="item.item_per_dose && item.formulation && item.dose"> · </span>
                      {{ item.dose }}
                    </td>
                    <td>
                      {{ item.frequency }}
                      <span v-if="item.frequency_unit" class="text-neutral-400"> {{ item.frequency_unit }}</span>
                      <span v-if="item.time_per" class="block text-[10px] text-neutral-400">{{ item.time_per }}</span>
                    </td>
                    <td>
                      {{ item.duration }}
                      <span v-if="item.duration_unit" class="text-neutral-400"> {{ item.duration_unit }}</span>
                    </td>
                    <td class="font-semibold">{{ item.quantity_prescribed }}</td>
                    <td>{{ item.route ?? '—' }}</td>
                    <td class="text-xs text-neutral-500">
                      {{ [item.start_date, item.end_date].filter(Boolean).join(' → ') || '—' }}
                    </td>
                    <td class="text-neutral-500 text-xs max-w-[160px]">
                      <span v-if="item.is_passer_by" class="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Passer-by</span>
                      {{ item.instructions ?? '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-for="(dispense, index) in encounter.pharmacy.dispenses" :key="dispense.id" class="sc">
            <div class="sc-hd">
              <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="sc-title">Dispensing Record</span>
              <span class="ml-2 badge b-green">Dispensed</span>
              <span v-if="encounter.pharmacy.dispenses.length > 1" class="ml-1 badge b-gray">
                {{ index + 1 }} of {{ encounter.pharmacy.dispenses.length }}
              </span>
              <span class="ml-auto badge b-gray">
                <UserBadge :user="dispense.dispensed_by" size="sm" /> · {{ dispense.dispensed_at }}
              </span>
            </div>
            <div class="sc-bd">
              <div v-if="dispense.dispensing_notes" class="theme-surface p-3 rounded mb-4 text-sm text-neutral-700 dark:text-neutral-300">
                <span class="font-bold">Dispensing Notes:</span> {{ dispense.dispensing_notes }}
              </div>
              <div v-if="dispense.counseling_notes" class="p-3 bg-green-50 border border-green-200 rounded mb-4 text-sm text-green-800">
                <span class="font-bold">Counseling Notes:</span> {{ dispense.counseling_notes }}
              </div>
              <table v-if="dispense.items.length" class="enc-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Qty Dispensed</th>
                    <th>Batch No</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in dispense.items" :key="item.id">
                    <td class="drug-name">{{ item.drug_name }}</td>
                    <td class="font-semibold">{{ item.quantity_dispensed }}</td>
                    <td>{{ item.batch_no ?? '—' }}</td>
                    <td class="text-neutral-500 text-xs">{{ item.instructions ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="encounter.pharmacy.recommendations.length" class="sc">
            <div class="sc-hd">
              <span class="sc-title">Pharmacist Recommendations</span>
              <span class="ml-auto badge b-gray">{{ encounter.pharmacy.recommendations.length }}</span>
            </div>
            <div class="sc-bd">
              <table class="enc-table">
                <thead>
                  <tr>
                    <th>Original Drug</th>
                    <th>Recommended Drug</th>
                    <th>Status</th>
                    <th>Note</th>
                    <th>Recommended By</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="recommendation in encounter.pharmacy.recommendations" :key="recommendation.id">
                    <td>{{ recommendation.original_drug }}</td>
                    <td class="drug-name">{{ recommendation.recommended_drug }}</td>
                    <td>
                      <span
                        class="badge"
                        :class="
                          recommendation.status === 'approved'
                            ? 'b-green'
                            : recommendation.status === 'rejected'
                              ? 'b-red'
                              : 'b-amber'
                        "
                      >
                        {{ stageText(recommendation.status) }}
                      </span>
                    </td>
                    <td class="text-neutral-500 text-xs max-w-[200px]">{{ recommendation.recommendation_note ?? '—' }}</td>
                    <td><UserBadge :user="recommendation.recommended_by" size="sm" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <svg
                class="w-10 h-10 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <p>No prescription issued for this encounter.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="enc-panel" :class="{ active: tab === 'workflow' }">
        <div class="sc">
          <div class="sc-hd">
            <svg
              class="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="sc-title">Stage Timeline</span>
            <span class="ml-auto badge b-gray">{{ encounter.workflow.stage_logs.length }} stages</span>
          </div>
          <div class="sc-bd">
            <div v-if="encounter.workflow.stage_logs.length" class="timeline">
              <div v-for="log in encounter.workflow.stage_logs" :key="log.id" class="tl-item">
                <div class="tl-dot" :class="log.completed_at ? 'tl-dot-done' : 'tl-dot-current'" />
                <Link v-if="log.stage_url" :href="log.stage_url" class="tl-stage hover:underline hover:text-neutral-900 transition-colors">
                  {{ stageText(log.stage_name) }}
                </Link>
                <div v-else class="tl-stage">{{ stageText(log.stage_name) }}</div>
                <div class="tl-meta">
                  Started {{ log.started_at ?? '—' }} by <UserBadge :user="log.started_by" size="sm" />
                  <template v-if="log.completed_at">
                    · Completed {{ log.completed_at }}
                    <template v-if="log.completed_by">
                      by <UserBadge :user="log.completed_by" size="sm" />
                    </template>
                  </template>
                  <template v-else> · <span class="text-amber-600 font-semibold">In Progress</span> </template>
                </div>
                <div v-if="log.notes" class="mt-1 text-xs text-neutral-500 italic">{{ log.notes }}</div>
              </div>
            </div>
            <p v-else class="text-sm text-neutral-400">No stage logs recorded.</p>
          </div>
        </div>

        <div class="sc">
          <div class="sc-hd">
            <svg
              class="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span class="sc-title">Queue Transitions</span>
            <span class="ml-auto badge b-gray">{{ encounter.workflow.queue_transitions.length }}</span>
          </div>
          <div v-if="encounter.workflow.queue_transitions.length" class="overflow-x-auto">
            <table class="enc-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>→ To</th>
                  <th>Status</th>
                  <th>Queued By</th>
                  <th>Queued At</th>
                  <th>Received By</th>
                  <th>Received At</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="transition in encounter.workflow.queue_transitions" :key="transition.id">
                  <td class="text-neutral-400">{{ transition.from_stage ? stageText(transition.from_stage) : '—' }}</td>
                  <td>
                    <span class="font-semibold">{{ stageText(transition.to_stage) }}</span>
                    <span
                      v-if="transition.returned_to_screening"
                      class="enc-returned-chip inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border border-blue-200 bg-blue-50 text-blue-700 ml-2"
                      title="Returned from a later stage for reassessment"
                    >
                      Returned
                    </span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      :class="
                        transition.status === 'completed'
                          ? 'b-green'
                          : transition.status === 'received'
                            ? 'b-blue'
                            : 'b-amber'
                      "
                    >
                      {{ transition.status }}
                    </span>
                  </td>
                  <td><UserBadge :user="transition.queued_by" size="sm" /></td>
                  <td>{{ transition.queued_at ?? '—' }}</td>
                  <td><UserBadge :user="transition.received_by" size="sm" /></td>
                  <td>{{ transition.received_at ?? '—' }}</td>
                  <td class="text-neutral-500 text-xs max-w-[260px]">{{ transition.transition_notes ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="sc-bd">
            <p class="text-sm text-neutral-400">No queue transitions recorded.</p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="encounter.can_reopen && showReopenModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="modal-panel w-full max-w-md rounded-lg shadow-xl">
        <div class="theme-card-header px-5 py-4">
          <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">Reopen Encounter</h3>
          <p class="text-xs text-neutral-500 mt-1">
            Unlock {{ encounter.encounter_number }} and restore the last clinical stage.
          </p>
        </div>
        <form class="px-5 py-4 space-y-3" @submit.prevent="submitReopen(encounter.id)">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">
              Reason <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="reopenForm.reason"
              rows="3"
              required
              maxlength="500"
              class="theme-field w-full px-3 py-2 text-sm rounded"
              placeholder="Why is this encounter being reopened?"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">
              Additional Notes
            </label>
            <textarea
              v-model="reopenForm.notes"
              rows="2"
              maxlength="500"
              class="theme-field w-full px-3 py-2 text-sm rounded"
              placeholder="Optional details"
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="theme-icon-btn px-4 py-2 text-xs font-semibold rounded hover:bg-neutral-50"
              @click="showReopenModal = false"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              variant="primary"
              class="!px-4 !py-2 text-xs"
              :loading="reopenForm.processing"
              loading-text="Reopening…"
              :disabled="!reopenForm.reason"
            >
              Confirm Reopen
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
