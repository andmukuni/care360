import { computed, ref, watch } from 'vue'
import { MedQuantity } from '~/support/med_quantity'
import { readXsrfToken } from '~/support/xsrf'

export type MedUnitDetail = {
  name: string
  form: string | null
  strength: string | null
}

export type MedSearchResult = {
  id: number
  name: string
  generic_name: string | null
  strength: string | null
  form: string
  category: string | null
  default_route: string | null
  default_frequency: string | null
  stock_on_hand?: number | null
  units?: string[]
  unit_details?: MedUnitDetail[]
  definition?: string | null
}

export type PrescriptionCartItem = {
  drug_name: string
  formulation: string
  dose: string
  item_per_dose: number
  frequency: number | string
  time_per: string
  frequency_unit: string
  duration: number | string
  duration_unit: string
  route: string
  start_date: string
  end_date: string
  quantity_prescribed: number | string
  is_passer_by: string
  instructions: string
}

function emptyForm(): PrescriptionCartItem {
  return {
    drug_name: '',
    formulation: '',
    dose: '',
    item_per_dose: 1,
    frequency: '',
    time_per: '',
    frequency_unit: '',
    duration: '',
    duration_unit: '',
    route: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    quantity_prescribed: '',
    is_passer_by: '0',
    instructions: '',
  }
}

const FREQUENCY_UNIT_MAP: Record<string, number> = {
  STAT: 1,
  QHS: 1,
  Nocturnal: 1,
  QAM: 1,
  OD: 1,
  BD: 2,
  Q12H: 2,
  TDS: 3,
  QID: 4,
  QW: 1,
  PRN: 1,
  'once every 3 months': 1,
  'once every 2 months': 1,
}

const TIME_PER_MAP: Record<string, number> = {
  'five times in a day (5/1)': 5,
  'every 4 hours (6/1)': 6,
  'every 3 hours (8/1)': 8,
  'every 2 hours (12/1)': 12,
  'every other day (1/2)': 1,
  '2 times every week (2/7)': 2,
  '3 times every week (3/7)': 3,
  '4 times each week (4/7)': 4,
  '5 times each week (5/7)': 5,
  '6 times each week (6/7)': 6,
  'twice every month (2/30)': 2,
  'Once every week': 1,
}

export function usePrescriptionCart(
  onCartChange?: () => void,
  options?: { isAlreadyRequested?: (signature: string) => boolean }
) {
  const cart = ref<PrescriptionCartItem[]>([])
  const showModal = ref(false)
  const form = ref<PrescriptionCartItem>(emptyForm())
  const showError = ref(false)
  const errorMsg = ref('')

  const drugSearch = ref('')
  const drugResults = ref<MedSearchResult[]>([])
  const drugLoading = ref(false)
  const drugPopoverOpen = ref(false)
  const drugActiveIdx = ref(-1)
  let drugSearchSeq = 0
  let drugSearchTimer: ReturnType<typeof setTimeout> | null = null

  const selectedDrugUnits = ref<string[]>([])
  const selectedUnitDetails = ref<MedUnitDetail[]>([])

  const unitStrings = computed(() =>
    [form.value.dose, ...selectedDrugUnits.value].filter(Boolean)
  )

  const quantityFormulaHint = computed(
    () =>
      MedQuantity.compute({
        itemPerDose: form.value.item_per_dose,
        frequency: form.value.frequency,
        frequencyUnit: form.value.frequency_unit,
        duration: form.value.duration,
        durationUnit: form.value.duration_unit,
        formulation: form.value.formulation,
        unitStrings: unitStrings.value,
      }).hint
  )

  function syncFormulationFromDose() {
    const detail = selectedUnitDetails.value.find((u) => u.name === form.value.dose)
    const mapped = detail ? MedQuantity.formulationForForm(detail.form) : null
    if (mapped) form.value.formulation = mapped
  }

  function computeQuantity() {
    const result = MedQuantity.compute({
      itemPerDose: form.value.item_per_dose,
      frequency: form.value.frequency,
      frequencyUnit: form.value.frequency_unit,
      duration: form.value.duration,
      durationUnit: form.value.duration_unit,
      formulation: form.value.formulation,
      unitStrings: unitStrings.value,
    })
    form.value.quantity_prescribed = result.quantity === null ? '' : result.quantity.toString()
  }

  function computeEndDate() {
    const dur = parseFloat(String(form.value.duration)) || 0
    if (!form.value.start_date || !dur) return
    const unit = form.value.duration_unit || 'Days'
    if (unit === 'Indefinite') return
    let dayCount = dur
    if (unit === 'Weeks') dayCount = dur * 7
    else if (unit === 'Months') dayCount = dur * 30
    else if (unit === 'Years') dayCount = dur * 365
    const d = new Date(form.value.start_date)
    d.setDate(d.getDate() + Math.round(dayCount))
    form.value.end_date = d.toISOString().slice(0, 10)
  }

  function applyFrequencyPreset() {
    const n = FREQUENCY_UNIT_MAP[form.value.frequency_unit]
    if (n !== undefined) form.value.frequency = n
  }

  function applyTimePer() {
    const n = TIME_PER_MAP[form.value.time_per]
    if (n !== undefined) form.value.frequency = n
  }

  watch(() => form.value.item_per_dose, computeQuantity)
  watch(() => form.value.frequency, computeQuantity)
  watch(() => form.value.formulation, computeQuantity)
  watch(
    () => form.value.dose,
    () => {
      syncFormulationFromDose()
      computeQuantity()
    }
  )
  watch(
    () => form.value.duration,
    () => {
      computeQuantity()
      computeEndDate()
    }
  )
  watch(
    () => form.value.duration_unit,
    () => {
      computeQuantity()
      computeEndDate()
    }
  )
  watch(() => form.value.start_date, computeEndDate)
  watch(
    () => form.value.frequency_unit,
    () => {
      applyFrequencyPreset()
      computeQuantity()
    }
  )
  watch(
    () => form.value.time_per,
    () => applyTimePer()
  )

  function onDrugInput() {
    form.value.drug_name = drugSearch.value
    form.value.dose = ''
    selectedDrugUnits.value = []
    selectedUnitDetails.value = []
    searchDrugs()
  }

  async function searchDrugs() {
    const seq = ++drugSearchSeq
    drugLoading.value = true
    try {
      const url = `/medications/search?q=${encodeURIComponent(drugSearch.value.trim())}`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MedSearchResult[]
      if (seq !== drugSearchSeq) return
      drugResults.value = Array.isArray(data) ? data : []
      drugActiveIdx.value = drugResults.value.length > 0 ? 0 : -1
      drugPopoverOpen.value = true
    } catch {
      if (seq !== drugSearchSeq) return
      drugResults.value = []
    } finally {
      if (seq === drugSearchSeq) drugLoading.value = false
    }
  }

  function debouncedDrugSearch() {
    if (drugSearchTimer) clearTimeout(drugSearchTimer)
    drugSearchTimer = setTimeout(onDrugInput, 250)
  }

  function selectDrug(med: MedSearchResult) {
    form.value.drug_name = med.name
    drugSearch.value = med.name
    selectedDrugUnits.value = Array.isArray(med.units) && med.units.length > 0 ? med.units : []
    selectedUnitDetails.value = Array.isArray(med.unit_details) ? med.unit_details : []
    form.value.dose = selectedDrugUnits.value.length === 1 ? selectedDrugUnits.value[0] : ''
    if (med.default_route) form.value.route = med.default_route
    if (med.default_frequency) form.value.frequency_unit = med.default_frequency
    form.value.formulation = MedQuantity.detectFormulation(med)
    drugPopoverOpen.value = false
    drugActiveIdx.value = -1
  }

  function moveDrugActive(delta: number) {
    if (!drugResults.value.length) return
    const next = drugActiveIdx.value + delta
    drugActiveIdx.value = (next + drugResults.value.length) % drugResults.value.length
  }

  function pickDrugActive() {
    if (drugActiveIdx.value >= 0 && drugActiveIdx.value < drugResults.value.length) {
      selectDrug(drugResults.value[drugActiveIdx.value])
    }
  }

  function resetModal() {
    form.value = emptyForm()
    drugSearch.value = ''
    drugResults.value = []
    drugPopoverOpen.value = false
    drugActiveIdx.value = -1
    selectedDrugUnits.value = []
    selectedUnitDetails.value = []
    showError.value = false
    errorMsg.value = ''
  }

  function addToCart() {
    if (!form.value.drug_name.trim()) {
      errorMsg.value = 'General Drug is required.'
      showError.value = true
      return
    }
    if (!form.value.dose.trim()) {
      errorMsg.value = 'Dosage is required.'
      showError.value = true
      return
    }
    if (!form.value.formulation) {
      errorMsg.value = 'Dispense Unit is required.'
      showError.value = true
      return
    }
    if (!form.value.quantity_prescribed) {
      errorMsg.value = 'Quantity is required. Fill duration & frequency or enter manually.'
      showError.value = true
      return
    }
    const signature = `${form.value.drug_name.trim()}|${form.value.dose.trim()}|${form.value.formulation}`
    if (
      cart.value.some(
        (item) =>
          `${item.drug_name}|${item.dose}|${item.formulation}` === signature
      ) ||
      options?.isAlreadyRequested?.(signature)
    ) {
      errorMsg.value = 'This medication is already in the request.'
      showError.value = true
      return
    }
    showError.value = false
    cart.value.push({ ...form.value })
    onCartChange?.()
    resetModal()
    showModal.value = false
  }

  function removeFromCart(idx: number) {
    cart.value.splice(idx, 1)
    onCartChange?.()
  }

  function clearCart() {
    cart.value = []
    onCartChange?.()
  }

  function openModal() {
    showModal.value = true
  }

  function closeModal() {
    resetModal()
    showModal.value = false
  }

  function closeDrugPopover() {
    drugPopoverOpen.value = false
  }

  function setDrugActiveIdx(idx: number) {
    drugActiveIdx.value = idx
  }

  return {
    cart,
    showModal,
    form,
    showError,
    errorMsg,
    drugSearch,
    drugResults,
    drugLoading,
    drugPopoverOpen,
    drugActiveIdx,
    selectedDrugUnits,
    selectedUnitDetails,
    quantityFormulaHint,
    debouncedDrugSearch,
    searchDrugs,
    selectDrug,
    moveDrugActive,
    pickDrugActive,
    resetModal,
    addToCart,
    removeFromCart,
    clearCart,
    openModal,
    closeModal,
    closeDrugPopover,
    computeQuantity,
    setDrugActiveIdx,
  }
}
