import { nextTick, onMounted, onUnmounted, reactive } from 'vue'
import { useForm } from '@inertiajs/vue3'

export type SearchTab = 'barcode' | 'name' | 'nrc' | 'phone' | 'patient_no'

export interface PatientSearchResult {
  id: number
  patient_id: string
  full_name: string
  gender: string | null
  date_of_birth: string | null
  phone_number: string | null
  nrc_number: string | null
  status: string
  is_deceased: boolean
  active_encounter?: {
    id: number
    encounter_number: string
    current_stage: string
    stage_label: string
  } | null
  membership?: {
    membership_plan: string | null
    membership_plan_tier: number | null
    membership_discount_percent: number
    fund_balance: string
    outstanding_balance: string
  } | null
}

export interface HouseholdOption {
  id: string
  name: string
  label: string
}

interface UseRegistrationDeskOptions {
  villages: string[]
  selectedHouseholdOption: HouseholdOption | null
}

const SEARCH_TABS = [
  {
    key: 'barcode' as const,
    label: 'Barcode',
    icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  },
  {
    key: 'name' as const,
    label: 'Name',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    key: 'nrc' as const,
    label: 'NRC',
    icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0',
  },
  {
    key: 'phone' as const,
    label: 'Phone',
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  },
  {
    key: 'patient_no' as const,
    label: 'Patient No.',
    icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  },
]

function readXsrfToken(): string | null {
  const match = document.cookie.match(/(^| )XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[2]) : null
}

export function useRegistrationDesk(options: UseRegistrationDeskOptions) {
  const desk = reactive({
    searchQuery: '',
    searchDob: '',
    searchSex: '',
    searchResults: [] as PatientSearchResult[],
    searching: false,
    searchPerformed: false,
    selectedPatient: null as PatientSearchResult | null,
    showNewPatientForm: false,
    newPatientMode: 'patient' as 'patient' | 'household',
    householdSuggestions: [] as HouseholdOption[],
    householdSearch: options.selectedHouseholdOption?.label ?? '',
    selectedHouseholdId: options.selectedHouseholdOption?.id ?? '',
    selectedHouseholdLabel: options.selectedHouseholdOption?.label ?? '',
    householdSuggestionOpen: false,
    villageOptions: [...options.villages],
    villageQuery: '',
    villageSuggestionOpen: false,
    showAddVillage: false,
    newVillageName: '',
    addVillageError: '',
    addVillageLoading: false,
    activeTab: 'barcode' as SearchTab,
    phoneLocal: '',
    scannerStatus: 'Hardware scanner ready — click in the field and scan.',
    scannerDiagnosticsEnabled: true,
    scannerDiag: {
      lastCode: '—',
      lastSource: '—',
      lastLength: 0,
      lastInterKeyMsLabel: '—',
      lastScannedAt: '—',
      signalLabel: 'Waiting for scan',
      signalToneClass: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
      signalHint: 'Scan a code to classify keyboard burst timing.',
    },
    barcodeInput: null as HTMLInputElement | null,
    newVillageInput: null as HTMLInputElement | null,
    nrcSearchInput: '',
  })

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let householdDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let searchAbortController: AbortController | null = null
  let membershipAbortController: AbortController | null = null
  let suppressBackdropClose = false
  let scannerBuffer = ''
  let scannerFirstCharAt = 0
  let scannerLastCharAt = 0
  let scannerFlushTimer: ReturnType<typeof setTimeout> | null = null

  const form = useForm({
    patient_id: null as number | null,
    full_name: '',
    gender: '' as string,
    date_of_birth: '',
    nrc_number: '',
    phone_number: '',
    email: '',
    create_household: false,
    household_id: '',
    village: '',
    visit_type: '',
    priority_level: 'normal',
    search_reference: '',
    registration_notes: '',
    confirm_inactive_patient: false,
  })

  function currentLabel(): string {
    const labels: Record<SearchTab, string> = {
      barcode: 'Scan Patient Barcode',
      name: 'Search by Patient Name',
      nrc: 'Search by NRC Number',
      phone: 'Search by Phone Number',
      patient_no: 'Search by Patient Number',
    }
    return labels[desk.activeTab]
  }

  function visibleResults(): PatientSearchResult[] {
    if (['name', 'phone', 'nrc'].includes(desk.activeTab)) {
      return desk.searchResults.slice(0, 5)
    }
    return desk.searchResults
  }

  function resultCountLabel(): string {
    if (['name', 'phone', 'nrc'].includes(desk.activeTab) && desk.searchResults.length > 5) {
      return `Showing 5 of ${desk.searchResults.length} result(s)`
    }
    return `${desk.searchResults.length} result(s) found`
  }

  function resetScannerBuffer() {
    scannerBuffer = ''
    scannerFirstCharAt = 0
    scannerLastCharAt = 0
    if (scannerFlushTimer) {
      clearTimeout(scannerFlushTimer)
      scannerFlushTimer = null
    }
  }

  function classifyScannerSignal(source: string, avgGap: number | null, codeLength: number) {
    if (source === 'hardware') {
      if (avgGap !== null && avgGap <= 25 && codeLength >= 6) {
        return {
          label: 'Likely hardware scanner',
          toneClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
          hint: 'Fast burst timing matches scanner-style keyboard wedge input.',
        }
      }
      return {
        label: 'Possible manual typing',
        toneClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        hint: 'Input arrived through keyboard path but timing looked slower than a typical scanner burst.',
      }
    }
    return {
      label: 'Manual entry',
      toneClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      hint: 'Code was submitted from manual keyboard entry.',
    }
  }

  function updateScannerDiagnostics(code: string, source: string, meta: { burstDurationMs?: number } = {}) {
    const normalizedSource = source === 'hardware' ? 'USB/Bluetooth scanner' : 'Manual keyboard'
    const burst = Number(meta.burstDurationMs || 0)
    const avgGap = code.length > 1 && burst > 0 ? Math.round(burst / (code.length - 1)) : null
    const signal = classifyScannerSignal(source, avgGap, code.length)

    desk.scannerDiag = {
      lastCode: code,
      lastSource: normalizedSource,
      lastLength: code.length,
      lastInterKeyMsLabel: avgGap !== null ? `${avgGap} ms` : '—',
      lastScannedAt: new Date().toLocaleTimeString(),
      signalLabel: signal.label,
      signalToneClass: signal.toneClass,
      signalHint: signal.hint,
    }
  }

  function commitScannedCode(rawCode: string, source: 'manual' | 'hardware' = 'manual', meta: { burstDurationMs?: number } = {}) {
    const code = (rawCode || '').trim()
    if (code.length < 2) return
    updateScannerDiagnostics(code, source, meta)
    desk.searchQuery = code
    desk.scannerStatus = `✓ Scanned: ${code}`
    searchPatients()
    setTimeout(() => {
      desk.barcodeInput?.focus()
      desk.barcodeInput?.select()
    }, 0)
  }

  function handleHardwareScanner(event: KeyboardEvent) {
    if (desk.activeTab !== 'barcode' || desk.showNewPatientForm) return
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const target = event.target as HTMLElement | null
    const isInputLike =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)

    if (isInputLike && target !== desk.barcodeInput) return

    const key = event.key
    const now = Date.now()

    if (key === 'Enter' || key === 'Tab') {
      if (scannerBuffer.trim().length >= 3) {
        event.preventDefault()
        commitScannedCode(scannerBuffer, 'hardware', {
          burstDurationMs: Math.max(0, now - (scannerFirstCharAt || now)),
        })
      }
      resetScannerBuffer()
      return
    }

    if (key.length !== 1) return

    if (now - scannerLastCharAt > 130) {
      scannerBuffer = ''
      scannerFirstCharAt = 0
    }
    if (scannerBuffer.length === 0) scannerFirstCharAt = now
    scannerLastCharAt = now
    scannerBuffer += key

    if (scannerFlushTimer) clearTimeout(scannerFlushTimer)
    scannerFlushTimer = setTimeout(() => {
      if (scannerBuffer.trim().length >= 6) {
        commitScannedCode(scannerBuffer, 'hardware', {
          burstDurationMs: Math.max(0, Date.now() - (scannerFirstCharAt || Date.now())),
        })
      }
      resetScannerBuffer()
    }, 100)
  }

  function focusActiveSearchField() {
    if (desk.activeTab === 'barcode') {
      desk.barcodeInput?.focus()
      desk.barcodeInput?.select()
    } else {
      const panel = document.querySelector(`[data-search-tab="${desk.activeTab}"]`)
      const input = panel?.querySelector('input, select, textarea') as HTMLElement | null
      input?.focus()
    }
  }

  function switchTab(key: SearchTab) {
    resetScannerBuffer()
    searchAbortController?.abort()
    searchAbortController = null
    membershipAbortController?.abort()
    membershipAbortController = null
    desk.activeTab = key
    desk.phoneLocal = ''
    desk.searchQuery = ''
    desk.nrcSearchInput = ''
    desk.searchDob = ''
    desk.searchSex = ''
    desk.searchResults = []
    desk.searchPerformed = false
    desk.searching = false

    if (key === 'barcode') {
      desk.scannerStatus = 'Hardware scanner ready — scan now or type barcode manually.'
    }
  }

  function formatNrcInput(value: string): string {
    const raw = value.replace(/[^0-9]/g, '')
    let formatted = ''
    for (let i = 0; i < raw.length && i < 9; i++) {
      if (i === 6 || i === 8) formatted += '/'
      formatted += raw[i]
    }
    return formatted
  }

  function onNrcSearchInput(event: Event) {
    const el = event.target as HTMLInputElement
    const formatted = formatNrcInput(el.value)
    el.value = formatted
    desk.nrcSearchInput = formatted
    desk.searchQuery = formatted
    queueSearchPatients()
  }

  function onNrcSearchBackspace(event: KeyboardEvent) {
    const el = event.target as HTMLInputElement
    if (el.value.endsWith('/')) {
      event.preventDefault()
      const trimmed = el.value.slice(0, -2)
      el.value = trimmed
      desk.nrcSearchInput = trimmed
      desk.searchQuery = trimmed
    }
  }

  function applyNrcFormat(event: Event) {
    const el = event.target as HTMLInputElement
    el.value = formatNrcInput(el.value)
    form.nrc_number = el.value
  }

  function onNrcFieldBackspace(event: KeyboardEvent) {
    const el = event.target as HTMLInputElement
    if (el.value.endsWith('/')) {
      event.preventDefault()
      el.value = el.value.slice(0, -2)
      form.nrc_number = el.value
    }
  }

  function titleCaseName(event: Event) {
    const el = event.target as HTMLInputElement
    const start = el.selectionStart
    const end = el.selectionEnd
    el.value = el.value.replace(/\b\w/g, (c) => c.toUpperCase())
    form.full_name = el.value
    if (start !== null && end !== null) el.setSelectionRange(start, end)
  }

  function formatPhoneInput(event: Event) {
    const el = event.target as HTMLInputElement
    let raw = el.value.replace(/[^0-9]/g, '')
    if (raw.length > 9) raw = raw.substring(0, 9)
    const formatted = raw.length > 2 ? `${raw.substring(0, 2)} ${raw.substring(2)}` : raw
    desk.phoneLocal = formatted
    el.value = formatted
    desk.searchQuery = formatted.replace(/\s/g, '')
    queueSearchPatients()
  }

  function queueSearchPatients(delay = 200) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => searchPatients(), delay)
  }

  async function enrichSearchMembership(patientIds: number[], searchSignal: AbortSignal) {
    if (patientIds.length === 0) {
      return
    }

    membershipAbortController?.abort()
    const membershipController = new AbortController()
    membershipAbortController = membershipController

    const onSearchAbort = () => membershipController.abort()
    searchSignal.addEventListener('abort', onSearchAbort, { once: true })

    try {
      const params = new URLSearchParams({ ids: patientIds.join(',') })
      const res = await fetch(`/registration/search-patient/membership?${params}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        signal: membershipController.signal,
      })
      if (membershipController.signal.aborted || searchSignal.aborted) return

      const data = await res.json()
      const membershipById = data.membership ?? {}

      for (const patient of desk.searchResults) {
        if (membershipById[patient.id]) {
          patient.membership = membershipById[patient.id]
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    } finally {
      searchSignal.removeEventListener('abort', onSearchAbort)
      if (membershipAbortController === membershipController) {
        membershipAbortController = null
      }
    }
  }

  async function searchPatients() {
    if (desk.searchQuery.length < 2) {
      searchAbortController?.abort()
      searchAbortController = null
      membershipAbortController?.abort()
      membershipAbortController = null
      desk.searchResults = []
      desk.searchPerformed = false
      desk.searching = false
      return
    }

    searchAbortController?.abort()
    membershipAbortController?.abort()
    const controller = new AbortController()
    searchAbortController = controller

    desk.searching = true
    try {
      const params = new URLSearchParams({ q: desk.searchQuery })
      if (desk.searchDob) params.append('date_of_birth', desk.searchDob)
      if (desk.activeTab === 'name' && desk.searchSex) params.append('sex', desk.searchSex)

      const res = await fetch(`/registration/search-patient?${params}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return

      const data = await res.json()
      desk.searchResults = (data.patients ?? []).map((patient: PatientSearchResult) => ({
        ...patient,
        active_encounter: patient.active_encounter ?? null,
        membership: patient.membership ?? null,
      }))
      desk.searchPerformed = true

      void enrichSearchMembership(
        desk.searchResults.map((patient) => patient.id),
        controller.signal
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      desk.searchResults = []
      desk.searchPerformed = true
    } finally {
      if (searchAbortController === controller) {
        desk.searching = false
        searchAbortController = null
      }
    }
  }

  function queueSearchHouseholds(delay = 250) {
    if (householdDebounceTimer) clearTimeout(householdDebounceTimer)
    householdDebounceTimer = setTimeout(() => searchHouseholds(), delay)
  }

  async function searchHouseholds() {
    const query = desk.householdSearch.trim()
    if (query === '') {
      desk.selectedHouseholdId = ''
      desk.selectedHouseholdLabel = ''
      desk.householdSuggestions = []
      desk.householdSuggestionOpen = false
      return
    }

    if (query !== desk.selectedHouseholdLabel) {
      desk.selectedHouseholdId = ''
    }

    try {
      const params = new URLSearchParams({ q: query })
      const res = await fetch(`/registration/search-households?${params}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!res.ok) throw new Error('Household search failed')
      const data = await res.json()
      desk.householdSuggestions = data.households ?? []
      desk.householdSuggestionOpen = desk.householdSuggestions.length > 0
    } catch {
      desk.householdSuggestions = []
      desk.householdSuggestionOpen = false
    }
  }

  function selectHousehold(household: HouseholdOption) {
    desk.selectedHouseholdId = household.id
    desk.selectedHouseholdLabel = household.label
    desk.householdSearch = household.label
    desk.householdSuggestions = []
    desk.householdSuggestionOpen = false
  }

  function filteredVillageSuggestions(): string[] {
    const q = desk.villageQuery.trim().toLowerCase()
    const pool = q === '' ? desk.villageOptions : desk.villageOptions.filter((v) => v.toLowerCase().includes(q))
    return pool.slice(0, 4)
  }

  function openVillageSuggestions() {
    if (desk.newPatientMode !== 'household') {
      desk.villageSuggestionOpen = false
      return
    }
    desk.villageSuggestionOpen = filteredVillageSuggestions().length > 0
  }

  function onVillageInput() {
    form.village = desk.villageQuery
    desk.villageSuggestionOpen = filteredVillageSuggestions().length > 0
  }

  function selectVillage(village: string) {
    desk.villageQuery = village
    form.village = village
    desk.villageSuggestionOpen = false
  }

  async function saveNewVillage() {
    const name = desk.newVillageName.trim()
    if (!name) {
      desk.addVillageError = 'Please type a village name.'
      return
    }

    desk.addVillageLoading = true
    desk.addVillageError = ''
    const token = readXsrfToken()

    try {
      const res = await fetch('/registration/villages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        desk.addVillageError = data.message ?? 'Could not save village.'
        return
      }
      desk.villageOptions = [...desk.villageOptions, data.name].sort((a, b) => a.localeCompare(b))
      desk.villageQuery = data.name
      form.village = data.name
      desk.showAddVillage = false
      desk.newVillageName = ''
      desk.villageSuggestionOpen = false
    } catch {
      desk.addVillageError = 'Network error — please try again.'
    } finally {
      desk.addVillageLoading = false
    }
  }

  function selectPatient(patient: PatientSearchResult) {
    if (patient.active_encounter) {
      return
    }
    if (patient.is_deceased) {
      alert('This patient is marked as deceased. New encounters cannot be started.')
      return
    }
    suppressBackdropClose = true
    desk.selectedPatient = patient
    form.confirm_inactive_patient = false
    desk.showNewPatientForm = false
    desk.newPatientMode = 'patient'
    void nextTick(() => {
      requestAnimationFrame(() => {
        suppressBackdropClose = false
      })
    })
  }

  function openNewPatientForm(mode: 'patient' | 'household' = 'patient') {
    suppressBackdropClose = true
    desk.selectedPatient = null
    desk.newPatientMode = mode
    desk.showNewPatientForm = true
    desk.searchResults = []
    desk.searchPerformed = false
    try {
      form.reset()
      form.priority_level = 'normal'
    } catch {
      // Keep modal open even if Inertia form reset fails.
    }

    void nextTick(() => {
      requestAnimationFrame(() => {
        suppressBackdropClose = false
      })
    })

    if (mode === 'household') {
      desk.selectedHouseholdId = ''
      desk.selectedHouseholdLabel = ''
      desk.householdSearch = ''
      desk.householdSuggestions = []
      desk.householdSuggestionOpen = false
      desk.villageSuggestionOpen = false
      desk.villageQuery = ''
      desk.showAddVillage = false
      desk.newVillageName = ''
      desk.addVillageError = ''
    }
  }

  function closeModalFromBackdrop() {
    if (suppressBackdropClose) return
    resetForm()
  }

  function resetForm() {
    desk.selectedPatient = null
    desk.showNewPatientForm = false
    desk.newPatientMode = 'patient'
    desk.selectedHouseholdId = ''
    desk.selectedHouseholdLabel = ''
    desk.householdSearch = ''
    desk.householdSuggestions = []
    desk.householdSuggestionOpen = false
    desk.villageQuery = ''
    desk.villageSuggestionOpen = false
    desk.showAddVillage = false
    desk.newVillageName = ''
    desk.addVillageError = ''
    form.confirm_inactive_patient = false
    form.reset()
    form.priority_level = 'normal'
  }

  function submitStartEncounter() {
    if (desk.selectedPatient?.is_deceased) {
      alert('This patient is marked as deceased. New encounters cannot be started.')
      return
    }

    if (
      desk.selectedPatient &&
      !desk.selectedPatient.is_deceased &&
      desk.selectedPatient.status === 'inactive'
    ) {
      if (!confirm('This patient is inactive. Start an encounter anyway?')) return
      form.confirm_inactive_patient = true
    }

    form.patient_id = desk.selectedPatient?.id ?? null
    form.create_household = desk.newPatientMode === 'household'
    form.household_id = desk.selectedHouseholdId
    form.village = desk.villageQuery
    form.search_reference = desk.searchQuery

    form.post('/encounters/start')
  }

  onMounted(() => {
    window.addEventListener('keydown', handleHardwareScanner)
    if (desk.activeTab === 'barcode') {
      desk.scannerStatus = 'Hardware scanner ready — scan now or type barcode manually.'
    }
    nextTick(() => focusActiveSearchField())
    if (desk.selectedHouseholdId && desk.householdSearch.trim() !== '') {
      desk.selectedHouseholdLabel = desk.householdSearch
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleHardwareScanner)
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    if (householdDebounceTimer) clearTimeout(householdDebounceTimer)
    searchAbortController?.abort()
    membershipAbortController?.abort()
    resetScannerBuffer()
  })

  Object.assign(desk, {
    tabs: SEARCH_TABS,
    currentLabel,
    visibleResults,
    resultCountLabel,
    switchTab,
    focusActiveSearchField,
    commitScannedCode,
    onNrcSearchInput,
    onNrcSearchBackspace,
    applyNrcFormat,
    onNrcFieldBackspace,
    titleCaseName,
    formatPhoneInput,
    queueSearchPatients,
    searchPatients,
    queueSearchHouseholds,
    searchHouseholds,
    selectHousehold,
    filteredVillageSuggestions,
    openVillageSuggestions,
    onVillageInput,
    selectVillage,
    saveNewVillage,
    selectPatient,
    openNewPatientForm,
    closeModalFromBackdrop,
    resetForm,
    submitStartEncounter,
  })

  Object.defineProperty(desk, 'form', {
    enumerable: true,
    get: () => form,
  })

  return desk as typeof desk & {
    form: typeof form
    tabs: typeof SEARCH_TABS
    currentLabel: typeof currentLabel
    visibleResults: typeof visibleResults
    resultCountLabel: typeof resultCountLabel
    switchTab: typeof switchTab
    focusActiveSearchField: typeof focusActiveSearchField
    commitScannedCode: typeof commitScannedCode
    onNrcSearchInput: typeof onNrcSearchInput
    onNrcSearchBackspace: typeof onNrcSearchBackspace
    applyNrcFormat: typeof applyNrcFormat
    onNrcFieldBackspace: typeof onNrcFieldBackspace
    titleCaseName: typeof titleCaseName
    formatPhoneInput: typeof formatPhoneInput
    queueSearchPatients: typeof queueSearchPatients
    searchPatients: typeof searchPatients
    queueSearchHouseholds: typeof queueSearchHouseholds
    searchHouseholds: typeof searchHouseholds
    selectHousehold: typeof selectHousehold
    filteredVillageSuggestions: typeof filteredVillageSuggestions
    openVillageSuggestions: typeof openVillageSuggestions
    onVillageInput: typeof onVillageInput
    selectVillage: typeof selectVillage
    saveNewVillage: typeof saveNewVillage
    selectPatient: typeof selectPatient
    openNewPatientForm: typeof openNewPatientForm
    closeModalFromBackdrop: typeof closeModalFromBackdrop
    resetForm: typeof resetForm
    submitStartEncounter: typeof submitStartEncounter
  }
}
