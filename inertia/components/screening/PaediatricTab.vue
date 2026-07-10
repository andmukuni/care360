<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ScreeningFormModal from '~/components/screening/ScreeningFormModal.vue'
import { parseJsonArrayField } from '~/support/screening/screening_json_fields'

const form = defineModel<Record<string, any>>({ required: true })

defineProps<{
  disabled?: boolean
}>()

type ImmunizationEntry = {
  vaccine_type: string
  vaccine: string
  dose: string
  batch_number: string
  date_given: string
}

type DevelopmentMilestone = {
  key: string
  name: string
  limits: string
  unit: string
  achieved: string | number
}

const BIRTH_OUTCOME_OPTIONS = ['Live Birth', 'Stillbirth', 'Preterm', 'Low Birth Weight', 'Neonatal Death'] as const
const GENERAL_CONDITION_OPTIONS = ['Good', 'Fair', 'Poor', 'Critical'] as const
const OTHER_FEEDING_OPTIONS = [
  'Exclusive breast feeding',
  'Exclusive alternative infant formula',
  'Supplementary food(No Breastfeeding)',
  'Mixed Feeding food(breast milk and other foods)',
  'Complimentary Feeding and continue breastfeeding upto 2 year or more',
  'Mixed based feed after 6 months in addition to other foods',
  'Other',
] as const
const TETANUS_OPTIONS = ['Yes', 'No', 'Unknown'] as const

const FEEDING_CODE_OPTIONS = [
  { value: 'Exclusive breastfeeding', label: 'Exclusive breastfeeding (in the 1st 6 months, breastfeeding only, no water, no other fluids except medicines)' },
  { value: 'Exclusive alternative infant formula', label: 'Exclusive alternative infant formula' },
  { value: 'Animal milk', label: 'Animal milk' },
  { value: 'Mixed feeding', label: 'Mixed feeding (breast milk and other foods)' },
  { value: 'Continued breastfeeding after 6 months', label: 'Continued breastfeeding after 6 months in addition to other foods' },
  { value: 'Milk based feed after 6 months', label: 'Milk based feed after 6 months in addition to other foods' },
  { value: 'Complimentary feeding after 6 months', label: 'Complimentary feeding after 6 months' },
  { value: 'Other', label: 'Other' },
] as const

const VACCINE_TYPES = [
  { name: 'Oral Polio Vaccine (OPV)', vaccines: ['OPV (Oral Polio Vaccine)'], doses: ['Birth Dose', 'Dose 1', 'Dose 2', 'Dose 3'] },
  { name: 'COVAX', vaccines: ['AstraZeneca (COVID Shield)', 'Pfizer-BioNTech (Comirnaty)', 'Johnson & Johnson (Janssen)', 'Sinopharm (BBIBP-CorV)', 'Moderna (Spikevax)'], doses: ['Dose 1', 'Dose 2', 'Booster 1', 'Booster 2'] },
  { name: 'Human Papilloma Virus Vaccine (HPV)', vaccines: ['Cervarix (2vHPV)', 'Gardasil (4vHPV)', 'Gardasil 9 (9vHPV)'], doses: ['Dose 1', 'Dose 2', 'Dose 3'] },
  { name: 'Measles', vaccines: ['Measles Vaccine', 'MR (Measles-Rubella)', 'MMR (Measles-Mumps-Rubella)'], doses: ['Dose 1', 'Dose 2'] },
  { name: 'Rota', vaccines: ['Rotarix (RV1)', 'RotaTeq (RV5)'], doses: ['Dose 1', 'Dose 2', 'Dose 3'] },
  { name: 'Pneumococcal conjugate vaccine (PCV)', vaccines: ['PCV 10 (Synflorix)', 'PCV 13 (Prevnar 13)', 'PCV 15', 'PCV 20'], doses: ['Dose 1', 'Dose 2', 'Dose 3', 'Booster 1'] },
  { name: 'DPT-HepB-Hib', vaccines: ['Pentavalent (DPT-HepB-Hib)', 'Hexaxim', 'Infanrix Hexa'], doses: ['Dose 1', 'Dose 2', 'Dose 3', 'Booster 1'] },
  { name: 'Inactivated Polio Vaccine (IPV)', vaccines: ['IPV (IPOL)', 'Imovax Polio'], doses: ['Dose 1', 'Dose 2', 'Booster 1'] },
  { name: 'Bacillus Calmette-Guérin (BCG)', vaccines: ['BCG Vaccine'], doses: ['Birth Dose', 'Single Dose'] },
] as const

const MILESTONES_DEF = [
  { key: 'social_smile', name: 'Social Smile', limits: '4 – 6 Weeks', unit: 'Weeks' },
  { key: 'head_holding', name: 'Head Holding', limits: '1 – 3 Months', unit: 'Months' },
  { key: 'turn_sound', name: 'Turn Towards Origin of Sound', limits: '2 – 3 Months', unit: 'Months' },
  { key: 'grasp_toy', name: 'Extends Hand to Grasp a Toy', limits: '2 – 3 Months', unit: 'Months' },
  { key: 'follow_eyes', name: 'Follow objects with eyes', limits: '2 – 4 Months', unit: 'Months' },
  { key: 'rolls_over', name: 'Rolls over', limits: '4 – 6 Months', unit: 'Months' },
  { key: 'babbles', name: 'Babbles', limits: '4 – 6 Months', unit: 'Months' },
  { key: 'objects_mouth', name: 'Takes objects to mouth', limits: '4 – 6 Months', unit: 'Months' },
  { key: 'sitting', name: 'Sitting', limits: '5 – 9 Months', unit: 'Months' },
  { key: 'repeats_syllables', name: 'Repeats syllables', limits: '6 – 9 Months', unit: 'Months' },
  { key: 'move_objects_hands', name: 'Move objects from one hand to another', limits: '6 – 9 Months', unit: 'Months' },
  { key: 'peek_a_boo', name: 'Plays peek-a-boo', limits: '6 – 9 Months', unit: 'Months' },
  { key: 'responds_name', name: 'Responds to own name', limits: '6 – 9 Months', unit: 'Months' },
  { key: 'steps_support', name: 'Takes steps with support', limits: '9 – 12 Months', unit: 'Months' },
  { key: 'picks_small', name: 'Picks up small objects or string with two fingers', limits: '9 – 12 Months', unit: 'Months' },
  { key: 'imitates_gestures', name: 'Imitates simple gestures', limits: '9 – 12 Months', unit: 'Months' },
  { key: 'points_words', name: 'Points to objects and says 2 – 3 words', limits: '9 – 12 Months', unit: 'Months' },
  { key: 'standing', name: 'Standing', limits: '7 – 13 Months', unit: 'Months' },
  { key: 'walking', name: 'Walking', limits: '12 – 18 Months', unit: 'Months' },
  { key: 'drinks_cup', name: 'Drinks from cup', limits: '12 – 18 Months', unit: 'Months' },
  { key: 'says_words', name: 'Says 7 – 10 words', limits: '12 – 18 Months', unit: 'Months' },
  { key: 'points_body', name: 'Points to body parts', limits: '12 – 18 Months', unit: 'Months' },
  { key: 'talking', name: 'Talking', limits: '9 – 24 Months', unit: 'Months' },
  { key: 'kicks_ball', name: 'Kicks ball and starts to run', limits: '18 – 24 Months', unit: 'Months' },
  { key: 'points_picture', name: 'Points at picture on request', limits: '18 – 24 Months', unit: 'Months' },
  { key: 'short_sentences', name: 'Sings and uses short sentences', limits: '18 – 24 Months', unit: 'Months' },
  { key: 'builds_tower', name: 'Builds tower with 3 blocks or boxes', limits: '18 – 24 Months', unit: 'Months' },
  { key: 'jumps_runs', name: 'Jumps and runs', limits: '> 24 Months', unit: 'Months' },
  { key: 'dresses_self', name: 'Begins to dress and undress by itself', limits: '> 24 Months', unit: 'Months' },
  { key: 'groups_objects', name: 'Groups similar objects', limits: '> 24 Months', unit: 'Months' },
  { key: 'plays_children', name: 'Plays with other children', limits: '> 24 Months', unit: 'Months' },
  { key: 'says_name_story', name: 'Says first name and tells short story', limits: '> 24 Months', unit: 'Months' },
] as const

// ── Birth History ──
const birthModalOpen = ref(false)
const birthHasData = computed(
  () =>
    !!form.value.birth_weight ||
    !!form.value.birth_length ||
    !!form.value.birth_outcome ||
    !!form.value.head_circumference ||
    !!form.value.chest_circumference ||
    !!form.value.general_condition ||
    form.value.is_breast_feeding_well ||
    !!form.value.other_feeding_option ||
    !!form.value.delivery_time ||
    !!form.value.vaccination_outside ||
    !!form.value.tetanus_at_birth ||
    !!form.value.birth_notes
)

// ── Immunization ──
const immModalOpen = ref(false)
const immParsed = parseJsonArrayField<ImmunizationEntry>(form.value.immunization_history)
const immEntries = ref<ImmunizationEntry[]>([...immParsed.entries])
const immForm = ref<ImmunizationEntry>({
  vaccine_type: '',
  vaccine: '',
  dose: '',
  batch_number: '',
  date_given: '',
})

const availableVaccines = computed(() => {
  const vt = VACCINE_TYPES.find((v) => v.name === immForm.value.vaccine_type)
  return vt ? vt.vaccines : []
})

const availableDoses = computed(() => {
  const vt = VACCINE_TYPES.find((v) => v.name === immForm.value.vaccine_type)
  return vt ? vt.doses : ['Dose 1', 'Dose 2', 'Dose 3', 'Booster 1', 'Booster 2']
})

watch(
  immEntries,
  (entries) => {
    form.value.immunization_history = entries.length > 0 ? JSON.stringify(entries) : ''
  },
  { deep: true }
)

function resetImmForm() {
  immForm.value = { vaccine_type: '', vaccine: '', dose: '', batch_number: '', date_given: '' }
}

function addImmEntry() {
  if (!immForm.value.vaccine_type || !immForm.value.vaccine || !immForm.value.dose || !immForm.value.date_given) return
  immEntries.value.push({ ...immForm.value })
  resetImmForm()
}

function removeImmEntry(idx: number) {
  immEntries.value.splice(idx, 1)
}

// ── Feeding ──
const feedingModalOpen = ref(false)
const feedingHasData = computed(() => !!form.value.feeding_code || !!form.value.feeding_comments)

// ── Development ──
const devModalOpen = ref(false)
let savedDev: DevelopmentMilestone[] = []
try {
  const raw = form.value.development_history
  if (typeof raw === 'string' && raw.startsWith('[')) savedDev = JSON.parse(raw)
  else if (Array.isArray(raw)) savedDev = raw
} catch {
  savedDev = []
}

const milestones = ref<DevelopmentMilestone[]>(
  MILESTONES_DEF.map((m) => {
    const saved = savedDev.find((s) => s.key === m.key)
    return { ...m, achieved: saved?.achieved ?? '' }
  })
)

const devFilledCount = computed(() => milestones.value.filter((m) => m.achieved).length)

const todayIsoDate = new Date().toISOString().slice(0, 10)

watch(
  milestones,
  () => {
    const filled = milestones.value
      .filter((m) => m.achieved)
      .map((m) => ({ key: m.key, name: m.name, limits: m.limits, achieved: m.achieved, unit: m.unit }))
    form.value.development_history = filled.length > 0 ? JSON.stringify(filled) : ''
  },
  { deep: true }
)
</script>

<template>
  <div class="section-card divide-y divide-neutral-100 !overflow-hidden !p-0 dark:divide-white/[0.04]">
    <!-- Birth History -->
    <div class="flex items-center justify-between px-5 py-4">
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Birth History</span>
      <div class="flex gap-2">
        <button v-if="birthHasData" type="button" class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:text-neutral-200" :disabled="disabled" @click="birthModalOpen = true">Edit Record</button>
        <button type="button" class="inline-flex items-center gap-1.5 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600" :disabled="disabled" @click="birthModalOpen = true">Add Record</button>
      </div>
      <ScreeningFormModal v-model:show="birthModalOpen" title="Birth History" :disabled="disabled" @save="birthModalOpen = false">
        <div class="space-y-4 p-6">
          <div class="grid grid-cols-3 gap-4">
            <div><label class="field-label">Birth Weight (kg) <span class="text-red-500">*</span></label><input v-model="form.birth_weight" type="number" step="0.01" min="0.1" max="15" class="field-input" placeholder="Enter Birth Weight (kg)" :disabled="disabled" /></div>
            <div><label class="field-label">Birth Length (cm)</label><input v-model="form.birth_length" type="number" step="0.1" min="1" max="100" class="field-input" placeholder="Enter Birth Length (cm)" :disabled="disabled" /></div>
            <div><label class="field-label">Birth Outcome <span class="text-red-500">*</span></label><select v-model="form.birth_outcome" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in BIRTH_OUTCOME_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="field-label">Head Circumference</label><input v-model="form.head_circumference" type="number" step="0.1" min="1" max="100" class="field-input" :disabled="disabled" /></div>
            <div><label class="field-label">Chest Circumference</label><input v-model="form.chest_circumference" type="number" step="0.1" min="1" max="100" class="field-input" :disabled="disabled" /></div>
          </div>
          <div class="grid grid-cols-2 items-end gap-4">
            <div><label class="field-label">General Condition <span class="text-red-500">*</span></label><select v-model="form.general_condition" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in GENERAL_CONDITION_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <label class="inline-flex cursor-pointer select-none items-center gap-2 pb-2"><input v-model="form.is_breast_feeding_well" type="checkbox" class="h-4 w-4 rounded border-neutral-300 text-blue-600" :disabled="disabled" /><span class="text-sm text-neutral-700 dark:text-neutral-300">Is Breast Feeding Well</span></label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="field-label">Other Feeding Option <span class="text-red-500">*</span></label><select v-model="form.other_feeding_option" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in OTHER_FEEDING_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
            <div><label class="field-label">Delivery Time <span class="text-red-500">*</span></label><input v-model="form.delivery_time" type="time" class="field-input" :disabled="disabled" /></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="field-label">Vaccination Outside</label><input v-model="form.vaccination_outside" type="text" class="field-input" :disabled="disabled" /></div>
            <div><label class="field-label">Tetanus At Birth <span class="text-red-500">*</span></label><select v-model="form.tetanus_at_birth" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="o in TETANUS_OPTIONS" :key="o" :value="o">{{ o }}</option></select></div>
          </div>
          <div><label class="field-label">Note</label><textarea v-model="form.birth_notes" rows="3" class="field-input" placeholder="Enter Note" :disabled="disabled" /></div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Immunization History -->
    <div class="flex items-center justify-between px-5 py-4">
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Immunization History</span>
      <div class="flex gap-2">
        <button v-if="immEntries.length > 0" type="button" class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:text-neutral-200" :disabled="disabled" @click="immModalOpen = true">Edit Record</button>
        <button type="button" class="inline-flex items-center gap-1.5 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600" :disabled="disabled" @click="immModalOpen = true">Add Record</button>
      </div>
      <ScreeningFormModal v-model:show="immModalOpen" title="Immunization History" :disabled="disabled" @save="immModalOpen = false">
        <div class="space-y-4 p-6">
          <div class="space-y-3 theme-surface rounded p-4">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="field-label">Vaccine Type <span class="text-red-500">*</span></label><select v-model="immForm.vaccine_type" class="field-input" :disabled="disabled" @change="immForm.vaccine = ''; immForm.dose = ''"><option value="">--Select--</option><option v-for="vt in VACCINE_TYPES" :key="vt.name" :value="vt.name">{{ vt.name }}</option></select></div>
              <div><label class="field-label">Vaccine <span class="text-red-500">*</span></label><select v-model="immForm.vaccine" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="v in availableVaccines" :key="v" :value="v">{{ v }}</option></select></div>
              <div><label class="field-label">Vaccine Dose <span class="text-red-500">*</span></label><select v-model="immForm.dose" class="field-input" :disabled="disabled"><option value="">--Select--</option><option v-for="d in availableDoses" :key="d" :value="d">{{ d }}</option></select></div>
              <div><label class="field-label">Batch Number</label><input v-model="immForm.batch_number" type="text" class="field-input" placeholder="Enter Batch Number" :disabled="disabled" /></div>
              <div><label class="field-label">Date Given <span class="text-red-500">*</span></label><input v-model="immForm.date_given" type="date" class="field-input" :max="todayIsoDate" :disabled="disabled" /></div>
            </div>
            <button type="button" class="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800" :disabled="disabled" @click="addImmEntry">Add</button>
          </div>
          <div v-if="immEntries.length > 0" class="theme-surface overflow-hidden rounded">
            <table class="w-full text-sm"><thead class="bg-neutral-100 dark:bg-neutral-800"><tr><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Vaccine Type</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Vaccine</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Dose</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Batch #</th><th class="px-3 py-1.5 text-left text-[10px] font-semibold uppercase text-neutral-500">Date Given</th><th class="w-8 px-2 py-1.5" /></tr></thead>
              <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]"><tr v-for="(entry, idx) in immEntries" :key="idx"><td class="px-3 py-1.5 text-xs">{{ entry.vaccine_type }}</td><td class="px-3 py-1.5 text-xs font-medium">{{ entry.vaccine }}</td><td class="px-3 py-1.5 text-xs">{{ entry.dose }}</td><td class="px-3 py-1.5 text-xs">{{ entry.batch_number || '—' }}</td><td class="px-3 py-1.5 text-xs">{{ entry.date_given || '—' }}</td><td class="px-2 py-1.5 text-center"><button type="button" class="text-red-400 hover:text-red-700" :disabled="disabled" @click="removeImmEntry(idx)">×</button></td></tr></tbody>
            </table>
          </div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Feeding History -->
    <div class="flex items-center justify-between px-5 py-4">
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Feeding History</span>
      <div class="flex gap-2">
        <button v-if="feedingHasData" type="button" class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:text-neutral-200" :disabled="disabled" @click="feedingModalOpen = true">Edit Record</button>
        <button type="button" class="inline-flex items-center gap-1.5 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600" :disabled="disabled" @click="feedingModalOpen = true">Add Record</button>
      </div>
      <ScreeningFormModal v-model:show="feedingModalOpen" title="Feeding History" max-width-class="max-w-xl" :disabled="disabled" @save="feedingModalOpen = false">
        <div class="space-y-4 p-6">
          <div><label class="field-label">Infant Feeding Code</label><select v-model="form.feeding_code" class="field-input" :disabled="disabled"><option value="">— Select —</option><option v-for="opt in FEEDING_CODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></div>
          <div><label class="field-label">Comments</label><textarea v-model="form.feeding_comments" rows="3" class="field-input" placeholder="Additional feeding details..." :disabled="disabled" /></div>
        </div>
      </ScreeningFormModal>
    </div>

    <!-- Development History -->
    <div class="flex items-center justify-between px-5 py-4">
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Development History</span>
      <div class="flex gap-2">
        <button v-if="devFilledCount > 0" type="button" class="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 dark:text-neutral-200" :disabled="disabled" @click="devModalOpen = true">Edit Record</button>
        <button type="button" class="inline-flex items-center gap-1.5 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600" :disabled="disabled" @click="devModalOpen = true">Add Record</button>
      </div>
      <ScreeningFormModal v-model:show="devModalOpen" title="Development History" max-width-class="max-w-3xl" :disabled="disabled" @save="devModalOpen = false">
        <div class="px-6 py-4">
          <table class="w-full">
            <thead class="theme-card-header sticky top-0"><tr class="border-b border-neutral-200"><th class="w-2/5 py-2 text-left text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300">Milestone</th><th class="w-1/4 py-2 text-left text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300">Normal Limits</th><th class="w-1/3 py-2 text-left text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300">Age Achieved</th></tr></thead>
            <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
              <tr v-for="m in milestones" :key="m.key" class="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <td class="py-2.5 pr-3 text-sm text-neutral-800 dark:text-neutral-200">{{ m.name }}</td>
                <td class="py-2.5 pr-3 text-sm text-neutral-500">{{ m.limits }}</td>
                <td class="py-2.5"><div class="flex items-center gap-2"><span class="w-12 text-[11px] font-medium text-neutral-500">{{ m.unit }}</span><input v-model="m.achieved" type="number" min="0" step="1" class="field-input !py-1.5 !text-sm w-28" :placeholder="`Enter ${m.unit}`" :disabled="disabled" /></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ScreeningFormModal>
    </div>
  </div>
</template>
