<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PatientMembershipMiniCard from '~/components/billing/PatientMembershipMiniCard.vue'
import PatientMembershipBillingCard from '~/components/billing/PatientMembershipBillingCard.vue'
import EncounterBadge from '~/components/encounter/EncounterBadge.vue'
import {
  bloodSugarBadge,
  bmiBadge,
  chipClassForSeverity,
  diastolicBpBadge,
  oxygenSaturationBadge,
  pulseBadge,
  respiratoryRateBadge,
  severityFromBadge,
  systolicBpBadge,
  temperatureBadge,
  type TriageVitalsInput,
  type VitalSeverity,
  vitalValueClassForSeverity,
  worstVitalSeverity,
  accentColorForSeverity,
} from '~/support/vital_badges'

type TriageRecord = TriageVitalsInput & {
  weight?: number | string | null
}

const props = defineProps<{
  encounter: {
    encounter_number: string
    stage: string
    priority?: string | null
    visit_type?: string | null
    started_at?: string | null
    is_locked?: boolean
    patient: {
      patient_id: string
      barcode?: string | null
      full_name: string
      gender: string | null
      date_of_birth?: string | null
      phone_number?: string | null
      nrc_number?: string | null
      allergies?: string | null
      membership_plan?: string | null
      membership_plan_tier?: number | null
      fund_balance?: string | null
    } | null
  }
  triage?: TriageRecord | null
  liveTriage?: TriageRecord | null
}>()

const open = ref(true)

onMounted(() => {
  open.value = localStorage.getItem('phOpen') !== 'false'
})

function toggleOpen(value: boolean) {
  open.value = value
  localStorage.setItem('phOpen', String(value))
}

const patient = computed(() => props.encounter.patient)

const patientInitial = computed(() => {
  const name = patient.value?.full_name?.trim()
  return name ? name.charAt(0).toUpperCase() : 'P'
})

const stageAccent = computed(() => {
  const stage = String(props.encounter.stage ?? '').toLowerCase()
  const map: Record<string, string> = {
    registration: '#0284c7',
    triage: '#d97706',
    screening: '#7c3aed',
    lab: '#0891b2',
    screening_review: '#e11d48',
    pharmacy: '#059669',
    treatment_room: '#4f46e5',
  }
  return map[stage] ?? '#171717'
})

const mergedTriage = computed(() => {
  const base = { ...(props.triage ?? {}) }
  const live = props.liveTriage ?? {}

  for (const [key, value] of Object.entries(live)) {
    if (value !== null && value !== '' && value !== undefined) {
      ;(base as Record<string, unknown>)[key] = value
    }
  }

  return Object.keys(base).length ? base : null
})

const vitalSeverity = computed(() =>
  mergedTriage.value ? worstVitalSeverity(mergedTriage.value) : null
)

const wrapAccent = computed(() => {
  const vitalAccent = accentColorForSeverity(vitalSeverity.value)
  if (vitalAccent) return vitalAccent
  return stageAccent.value
})

const wrapStatusClass = computed(() => {
  if (!vitalSeverity.value || vitalSeverity.value === 'normal') return ''
  return `ph-wrap--${vitalSeverity.value}`
})

const age = computed(() => {
  if (!patient.value?.date_of_birth) return null
  const dob = new Date(patient.value.date_of_birth)
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--
  return years
})

const genderLabel = computed(() => {
  const g = String(patient.value?.gender ?? '').toLowerCase()
  if (!g) return null
  if (g === 'f' || g === 'female') return 'Female'
  if (g === 'm' || g === 'male') return 'Male'
  return patient.value?.gender ? patient.value.gender.charAt(0).toUpperCase() + patient.value.gender.slice(1) : null
})

const hasAllergy = computed(() => {
  const a = patient.value?.allergies?.trim()
  return Boolean(a && a.toLowerCase() !== 'none')
})

type VitalRow = {
  key: string
  val: string
  severity: VitalSeverity | null
  status: string | null
}

const SEVERITY_STATUS_LABEL: Record<VitalSeverity, string> = {
  normal: 'Normal',
  low: 'Low',
  elevated: 'Elevated',
  abnormal: 'Abnormal',
  critical: 'Critical',
}

function statusLabel(severity: VitalSeverity | null): string | null {
  if (!severity) return null
  return SEVERITY_STATUS_LABEL[severity]
}

function pushVital(
  rows: VitalRow[],
  key: string,
  val: string | null | undefined,
  severity: VitalSeverity | null
) {
  if (!val) return
  rows.push({ key, val, severity, status: statusLabel(severity) })
}

const vitals = computed(() => {
  const t = mergedTriage.value
  if (!t) return [] as VitalRow[]

  const rows: VitalRow[] = []

  if (t.systolic_bp && t.diastolic_bp) {
    const ranked = [severityFromBadge(systolicBpBadge(t.systolic_bp)), severityFromBadge(diastolicBpBadge(t.diastolic_bp))].filter(
      Boolean
    ) as VitalSeverity[]
    const order = { normal: 0, low: 1, elevated: 2, abnormal: 3, critical: 4 }
    const worst = ranked.reduce<VitalSeverity | null>(
      (acc, item) => (!acc || order[item] > order[acc] ? item : acc),
      null
    )
    pushVital(rows, 'BP', `${t.systolic_bp}/${t.diastolic_bp}`, worst)
  }

  pushVital(rows, 'Pulse', t.pulse ? `${t.pulse}` : null, severityFromBadge(pulseBadge(t.pulse)))
  pushVital(
    rows,
    'Temp',
    t.temperature ? `${t.temperature}°C` : null,
    severityFromBadge(temperatureBadge(t.temperature))
  )
  pushVital(
    rows,
    'SpO₂',
    t.oxygen_saturation ? `${t.oxygen_saturation}%` : null,
    severityFromBadge(oxygenSaturationBadge(t.oxygen_saturation))
  )
  pushVital(rows, 'Weight', t.weight ? `${t.weight} kg` : null, null)
  pushVital(
    rows,
    'BMI',
    t.bmi ? String(t.bmi) : null,
    severityFromBadge(bmiBadge(t.bmi))
  )
  pushVital(
    rows,
    'BGL',
    t.blood_sugar ? `${t.blood_sugar}` : null,
    severityFromBadge(bloodSugarBadge(t.blood_sugar))
  )
  pushVital(
    rows,
    'RR',
    t.respiratory_rate ? `${t.respiratory_rate}` : null,
    severityFromBadge(respiratoryRateBadge(t.respiratory_rate))
  )

  return rows
})

const compactVitals = computed(() => vitals.value.slice(0, 4))

const demoLine = computed(() => {
  const parts: string[] = []
  if (genderLabel.value) parts.push(genderLabel.value)
  if (age.value !== null) parts.push(`${age.value} yrs`)
  return parts.join(' · ')
})

const billingDemoLine = computed(() => {
  const parts: string[] = []
  if (genderLabel.value) parts.push(genderLabel.value)
  if (age.value !== null) parts.push(`${age.value} yrs`)
  const dob = formatDob(patient.value?.date_of_birth ?? null)
  if (dob) parts.push(dob)
  return parts.join(' · ')
})

function formatDob(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div
    v-if="patient"
    class="ph-wrap"
    :class="wrapStatusClass"
    :style="{
      '--ph-accent': wrapAccent,
    }"
  >
    <button
      v-show="open"
      type="button"
      class="ph-expanded"
      aria-expanded="true"
      aria-label="Collapse patient panel"
      @click="toggleOpen(false)"
    >
      <div class="ph-body">
        <div class="ph-identity">
          <PatientMembershipBillingCard
            compact
            :patient-id="patient.patient_id"
            :barcode="patient.barcode"
            :full-name="patient.full_name"
            :patient-initial="patientInitial"
            :membership-plan="patient.membership_plan"
            :membership-plan-tier="patient.membership_plan_tier"
            :fund-balance="patient.fund_balance"
            :demo-line="billingDemoLine"
          />
          <div v-if="hasAllergy" class="ph-allergy ph-allergy--below-card">
            <svg class="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            Allergies: {{ patient.allergies }}
          </div>
        </div>

        <div v-if="vitals.length" class="ph-vitals">
          <div class="ph-vitals-lbl">Triage Vitals</div>
          <div class="ph-vitals-grid">
            <div
              v-for="v in vitals"
              :key="v.key"
              class="ph-vital-item ph-vital-item--horizontal"
              :class="v.severity && v.severity !== 'normal' ? `ph-vital-item--${v.severity}` : ''"
            >
              <span class="ph-vital-key">{{ v.key }}</span>
              <span class="ph-vital-val" :class="vitalValueClassForSeverity(v.severity)">{{ v.val }}</span>
              <span
                v-if="v.status"
                class="ph-vital-status"
                :class="`ph-vital-status--${v.severity}`"
              >{{ v.status }}</span>
            </div>
          </div>
        </div>

        <div class="ph-enc">
          <div>
            <div class="ph-enc-num mb-2">{{ encounter.encounter_number }}</div>
            <div class="flex flex-wrap gap-1.5">
              <EncounterBadge type="stage" :value="encounter.stage" />
              <EncounterBadge type="priority" :value="encounter.priority ?? 'normal'" />
            </div>
          </div>
          <div>
            <div class="ph-visit-type">{{ encounter.visit_type ?? 'OPD' }} visit</div>
            <div v-if="encounter.started_at" class="ph-visit-type mt-0.5">{{ encounter.started_at }}</div>
            <div
              v-if="encounter.is_locked"
              class="ph-allergy mt-2 !border-orange-200 !bg-orange-50 !text-orange-700 dark:!border-orange-800 dark:!bg-orange-950/40 dark:!text-orange-300"
            >
              Encounter Locked
            </div>
          </div>
        </div>
      </div>

      <div class="ph-toggle">
        <span class="ph-toggle-btn">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          Collapse patient panel
        </span>
      </div>
    </button>

    <button
      v-show="!open"
      type="button"
      class="ph-collapsed"
      aria-expanded="false"
      aria-label="Expand patient details"
      @click="toggleOpen(true)"
    >
      <div class="ph-billing-rail" aria-hidden="true">
        <PatientMembershipMiniCard
          :patient-id="patient.patient_id"
          :patient-initial="patientInitial"
          :membership-plan="patient.membership_plan"
          :membership-plan-tier="patient.membership_plan_tier"
          :fund-balance="patient.fund_balance"
        />
      </div>

      <div class="ph-collapsed-main">
        <div class="ph-collapsed-left">
          <div class="ph-collapsed-identity">
            <div class="ph-collapsed-name">{{ patient.full_name }}</div>
            <div class="ph-collapsed-meta">
              <span class="ph-collapsed-pid">{{ patient.patient_id }}</span>
              <span v-if="demoLine" class="ph-collapsed-dot">·</span>
              <span v-if="demoLine">{{ demoLine }}</span>
            </div>
          </div>
        </div>

        <div v-if="compactVitals.length" class="ph-collapsed-vitals">
          <span
            v-for="v in compactVitals"
            :key="v.key"
            class="ph-vital-chip"
            :class="chipClassForSeverity(v.severity)"
          >
            <span class="ph-vital-chip-key">{{ v.key }}</span>
            <span class="ph-vital-chip-val">{{ v.val }}</span>
          </span>
        </div>

        <div class="ph-collapsed-right">
          <div class="ph-collapsed-badges">
            <span class="ph-collapsed-enc">{{ encounter.encounter_number }}</span>
            <EncounterBadge type="stage" :value="encounter.stage" />
            <EncounterBadge
              v-if="encounter.priority && encounter.priority !== 'normal'"
              type="priority"
              :value="encounter.priority"
            />
            <span v-if="hasAllergy" class="ph-allergy ph-allergy--compact">Allergies</span>
          </div>
          <span class="ph-collapsed-expand">
            <span class="hidden sm:inline">Expand</span>
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  </div>
</template>
