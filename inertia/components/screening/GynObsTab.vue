<script setup lang="ts">
import { computed, watch } from 'vue'
import ChoiceCardGroup from '~/components/ui/ChoiceCardGroup.vue'
import TriStateToggle from '~/components/ui/TriStateToggle.vue'

type GynObsAlert = {
  type: 'danger' | 'warning' | 'info'
  code: string
  label: string
  detail: string
}

const form = defineModel<Record<string, any>>({ required: true })

defineProps<{
  disabled?: boolean
  alerts?: GynObsAlert[]
}>()

const CYCLE_REGULARITY_OPTIONS = [
  { value: 'regular', label: 'Regular', hint: 'Predictable cycle, typically every 21–35 days' },
  { value: 'irregular', label: 'Irregular', hint: 'Variable cycle length or timing' },
  { value: 'absent', label: 'Absent (Amenorrhoea)', hint: 'No menstrual periods recorded' },
]

const CONTRACEPTIVE_METHODS: Record<string, string> = {
  oral_pill: 'Oral Contraceptive Pill',
  injectable: 'Injectable (e.g. Depo-Provera)',
  implant: 'Implant (e.g. Jadelle / Implanon)',
  iud: 'IUD / Coil',
  condom_male: 'Male Condom',
  condom_female: 'Female Condom',
  natural: 'Natural / Rhythm / LAM',
  sterilisation: 'Sterilisation (Tubal Ligation)',
  none: 'None',
  other: 'Other (specify below)',
}

const CERVICAL_METHODS: Record<string, string> = {
  via: 'VIA (Visual Inspection with Acetic Acid)',
  vili: 'VILI (Visual Inspection with Lugol\'s Iodine)',
  pap_smear: 'Pap Smear (Cervical Cytology)',
  hpv_test: 'HPV DNA Test',
  colposcopy: 'Colposcopy',
  other: 'Other',
}

const CERVICAL_RESULTS: Record<string, string> = {
  normal: 'Normal',
  abnormal_low_grade: 'Abnormal — Low Grade (CIN 1)',
  abnormal_high_grade: 'Abnormal — High Grade (CIN 2/3)',
  suspicious_cancer: 'Suspicious of Cancer',
  inconclusive: 'Inconclusive / Inadequate Sample',
}

const showEddField = computed(() => form.value.currently_pregnant === true)
const showContraFields = computed(() => form.value.using_contraception === true)
const showContraOther = computed(() => form.value.contraceptive_method === 'other')
const showCervicalFields = computed(() => form.value.cervical_screening_done === true)
const showCervicalTreatmentType = computed(
  () => form.value.cervical_screening_done === true && form.value.cervical_treatment_done === true
)

const lmpDisplay = computed(() => {
  const val = form.value.last_menstrual_period
  if (!val) return '—'
  const date = new Date(`${val}T00:00:00`)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
})

const gestationalAge = computed(() => {
  const val = form.value.last_menstrual_period
  if (!val) return ''
  const lmp = new Date(`${val}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const totalDays = Math.floor((today.getTime() - lmp.getTime()) / (24 * 60 * 60 * 1000))
  if (totalDays < 0) return ''
  const weeks = Math.floor(totalDays / 7)
  const days = totalDays % 7
  return `GA: ${weeks} wk${weeks !== 1 ? 's' : ''} + ${days} day${days !== 1 ? 's' : ''}`
})

watch(
  () => form.value.last_menstrual_period,
  (val) => {
    if (!val || form.value.expected_delivery_date) return
    const lmp = new Date(`${val}T00:00:00`)
    const edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000)
    form.value.expected_delivery_date = edd.toISOString().slice(0, 10)
  }
)

watch(
  () => form.value.currently_pregnant,
  (val) => {
    if (val !== true) form.value.expected_delivery_date = null
  }
)

watch(
  () => form.value.using_contraception,
  (val) => {
    if (val !== true) {
      form.value.contraceptive_method = null
      form.value.contraceptive_duration_months = null
      form.value.contraceptive_method_other = null
    }
  }
)

watch(
  () => form.value.contraceptive_method,
  (val) => {
    if (val !== 'other') form.value.contraceptive_method_other = null
  }
)

watch(
  () => form.value.cervical_screening_done,
  (val) => {
    if (val !== true) {
      form.value.cervical_screening_date = null
      form.value.cervical_screening_method = null
      form.value.cervical_screening_result = null
      form.value.cervical_screening_result_notes = null
      form.value.cervical_treatment_done = null
      form.value.cervical_treatment_type = null
    }
  }
)

watch(
  () => form.value.cervical_treatment_done,
  (val) => {
    if (val !== true) form.value.cervical_treatment_type = null
  }
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="alerts?.length" class="space-y-2">
      <div
        v-for="alert in alerts"
        :key="alert.code"
        class="theme-field rounded px-3 py-2 text-sm"
        :class="
          alert.type === 'danger'
            ? 'border-red-200 bg-red-50 text-red-900'
            : alert.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-sky-200 bg-sky-50 text-sky-900'
        "
      >
        <div class="font-semibold">{{ alert.label }}</div>
        <div class="mt-0.5 text-xs opacity-90">{{ alert.detail }}</div>
      </div>
    </div>

    <div class="section-card divide-y divide-neutral-200 !mb-0 !overflow-hidden !p-0 dark:divide-white/[0.04]">
      <!-- Menstrual History -->
      <section class="px-5 py-5">
        <div class="gyn-section-head">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
          </svg>
          <h3 class="gyn-section-title">Menstrual History</h3>
        </div>

        <div class="mt-4">
          <label class="field-label">Cycle Regularity</label>
          <ChoiceCardGroup
            v-model="form.menstrual_cycle_regularity"
            class="mt-2"
            :options="CYCLE_REGULARITY_OPTIONS"
            :disabled="disabled"
            :columns="3"
          />
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label">Cycle Length <span class="unit">days</span></label>
            <input v-model="form.cycle_length_days" type="number" min="1" max="60" class="field-input" placeholder="e.g. 28" :disabled="disabled" />
          </div>
          <div>
            <label class="field-label">Duration of Flow <span class="unit">days</span></label>
            <input v-model="form.duration_of_flow_days" type="number" min="1" max="30" class="field-input" placeholder="e.g. 5" :disabled="disabled" />
          </div>
          <div>
            <label class="field-label">Last Menstrual Period (LMP)</label>
            <input v-model="form.last_menstrual_period" type="date" class="field-input" :disabled="disabled" />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label">Dysmenorrhoea <span class="unit">(Painful Periods)</span></label>
            <TriStateToggle v-model="form.dysmenorrhoea" class="mt-2" :disabled="disabled" />
          </div>
          <div>
            <label class="field-label">Intermenstrual Bleeding</label>
            <TriStateToggle v-model="form.intermenstrual_bleeding" class="mt-2" :disabled="disabled" />
          </div>
          <div>
            <label class="field-label">Post-Coital Bleeding</label>
            <TriStateToggle v-model="form.post_coital_bleeding" class="mt-2" :disabled="disabled" />
          </div>
        </div>

        <div class="mt-4">
          <label class="field-label">Menstrual Notes</label>
          <textarea
            v-model="form.menstrual_notes"
            rows="2"
            class="field-input"
            placeholder="Any additional menstrual history details…"
            :disabled="disabled"
          />
        </div>
      </section>

      <!-- Obstetrics History -->
      <section class="px-5 py-5">
        <div class="gyn-section-head">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c2.21 0 4-1.79 4-4S14.21 3 12 3 8 4.79 8 7s1.79 4 4 4zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
          </svg>
          <h3 class="gyn-section-title">Obstetrics History</h3>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="f in ['gravida', 'para', 'abortus', 'living_children']" :key="f" class="gyn-metric-card">
            <label class="gyn-metric-label">{{ f.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }}</label>
            <input v-model="form[f]" type="number" min="0" max="20" class="gyn-metric-input" placeholder="0" :disabled="disabled" />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="gyn-readonly-field">
            <label class="field-label">LMP <span class="unit">(from Menstrual History)</span></label>
            <p class="gyn-readonly-value">{{ lmpDisplay }}</p>
          </div>
          <div>
            <label class="field-label">Currently Pregnant</label>
            <TriStateToggle v-model="form.currently_pregnant" class="mt-2" :disabled="disabled" />
          </div>
          <div v-show="showEddField">
            <label class="field-label">Expected Delivery Date (EDD)</label>
            <input v-model="form.expected_delivery_date" type="date" class="field-input" :disabled="disabled" />
            <p v-if="gestationalAge" class="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">{{ gestationalAge }}</p>
          </div>
        </div>

        <div class="mt-4 space-y-4">
          <div>
            <label class="field-label">Previous Obstetric Complications</label>
            <textarea
              v-model="form.previous_obstetric_complications"
              rows="2"
              class="field-input"
              placeholder="e.g. PPH, pre-eclampsia, C-section, stillbirth, IUGR…"
              :disabled="disabled"
            />
          </div>
          <div>
            <label class="field-label">Obstetrics Notes</label>
            <textarea v-model="form.obstetrics_notes" rows="2" class="field-input" :disabled="disabled" />
          </div>
        </div>
      </section>

      <!-- Contraceptive History -->
      <section class="px-5 py-5">
        <div class="gyn-section-head">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 class="gyn-section-title">Contraceptive History</h3>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label">Currently Using Contraception?</label>
            <TriStateToggle v-model="form.using_contraception" class="mt-2" :disabled="disabled" />
          </div>
          <div v-show="showContraFields">
            <label class="field-label">Current Method</label>
            <select v-model="form.contraceptive_method" class="field-input" :disabled="disabled">
              <option :value="null">— Select method —</option>
              <option v-for="(label, val) in CONTRACEPTIVE_METHODS" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div v-show="showContraFields">
            <label class="field-label">Duration of Use <span class="unit">months</span></label>
            <input v-model="form.contraceptive_duration_months" type="number" min="0" max="600" class="field-input" :disabled="disabled" />
          </div>
          <div v-show="showContraOther" class="sm:col-span-2 lg:col-span-3">
            <label class="field-label">Specify Other Method <span class="text-red-500">*</span></label>
            <input v-model="form.contraceptive_method_other" type="text" maxlength="100" class="field-input" :disabled="disabled" />
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <label class="field-label">Previous Contraceptive Methods</label>
            <textarea v-model="form.previous_contraceptive_methods" rows="2" class="field-input" :disabled="disabled" />
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <label class="field-label">Contraceptive Notes</label>
            <textarea v-model="form.contraceptive_notes" rows="2" class="field-input" :disabled="disabled" />
          </div>
        </div>
      </section>

      <!-- Cervical Cancer History -->
      <section class="px-5 py-5">
        <div class="gyn-section-head">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="gyn-section-title">Cervical Cancer History</h3>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label">Previous Cervical Screening Done?</label>
            <TriStateToggle v-model="form.cervical_screening_done" class="mt-2" :disabled="disabled" />
          </div>
          <div v-show="showCervicalFields">
            <label class="field-label">Date of Last Screening</label>
            <input v-model="form.cervical_screening_date" type="date" class="field-input" :disabled="disabled" />
          </div>
          <div v-show="showCervicalFields">
            <label class="field-label">Screening Method</label>
            <select v-model="form.cervical_screening_method" class="field-input" :disabled="disabled">
              <option :value="null">— Select method —</option>
              <option v-for="(label, val) in CERVICAL_METHODS" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div v-show="showCervicalFields">
            <label class="field-label">Screening Result / Outcome</label>
            <select v-model="form.cervical_screening_result" class="field-input" :disabled="disabled">
              <option :value="null">— Select result —</option>
              <option v-for="(label, val) in CERVICAL_RESULTS" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div v-show="showCervicalFields" class="lg:col-span-3">
            <label class="field-label">Result Detail / Notes</label>
            <textarea v-model="form.cervical_screening_result_notes" rows="2" class="field-input" :disabled="disabled" />
          </div>
          <div v-show="showCervicalFields">
            <label class="field-label">Treatment Given After Screening?</label>
            <TriStateToggle v-model="form.cervical_treatment_done" class="mt-2" :disabled="disabled" />
          </div>
          <div v-show="showCervicalTreatmentType">
            <label class="field-label">Treatment Type</label>
            <input v-model="form.cervical_treatment_type" type="text" maxlength="100" class="field-input" :disabled="disabled" />
          </div>
          <div class="lg:col-span-3">
            <label class="field-label">Cervical Cancer Notes</label>
            <textarea v-model="form.cervical_cancer_notes" rows="2" class="field-input" :disabled="disabled" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.gyn-section-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #171717;
}
:global(.dark) .gyn-section-head {
  color: #e5e5e5;
}
.gyn-section-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.gyn-metric-card {
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  background: #fafafa;
  padding: 0.65rem 0.75rem;
}
:global(.dark) .gyn-metric-card {
  border-color: #404040;
  background: #171717;
}
.gyn-metric-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #737373;
  margin-bottom: 0.35rem;
}
.gyn-metric-input {
  width: 100%;
  border: 0;
  background: transparent;
  font-size: 1.125rem;
  font-weight: 700;
  color: #171717;
  outline: none;
}
.gyn-metric-input::placeholder {
  color: #d4d4d4;
  font-weight: 500;
}
:global(.dark) .gyn-metric-input {
  color: #f5f5f5;
}
.gyn-readonly-field {
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  background: #fafafa;
  padding: 0.65rem 0.75rem;
}
:global(.dark) .gyn-readonly-field {
  border-color: #404040;
  background: #171717;
}
.gyn-readonly-value {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #525252;
}
:global(.dark) .gyn-readonly-value {
  color: #d4d4d4;
}
</style>
