import { ref } from 'vue'
import { readXsrfToken } from '~/support/xsrf'

export type LabTestSearchResult = {
  id: number
  name: string
  group: string | null
  specimen: string | null
  specimen_type_id: number | null
  code?: string | null
  definition?: string | null
}

export type LabCartItem = {
  test_name: string
  test_code: string | null
  specimen_type: string | null
  lab_specimen_type_id: number | null
  test_group: string | null
  instructions: string | null
}

function emptyDraft(): LabCartItem {
  return {
    test_name: '',
    test_code: null,
    specimen_type: null,
    lab_specimen_type_id: null,
    test_group: null,
    instructions: null,
  }
}

export function useLabCart(
  onCartChange?: () => void,
  options?: { isAlreadyRequested?: (testName: string) => boolean }
) {
  const cart = ref<LabCartItem[]>([])
  const showModal = ref(false)
  const draft = ref<LabCartItem>(emptyDraft())
  const showError = ref(false)
  const errorMsg = ref('')

  const testSearch = ref('')
  const testResults = ref<LabTestSearchResult[]>([])
  const testLoading = ref(false)
  const testPopoverOpen = ref(false)
  const testActiveIdx = ref(-1)
  let testSearchSeq = 0
  let testSearchTimer: ReturnType<typeof setTimeout> | null = null

  function resetModal() {
    draft.value = emptyDraft()
    testSearch.value = ''
    testResults.value = []
    testPopoverOpen.value = false
    testActiveIdx.value = -1
    showError.value = false
    errorMsg.value = ''
  }

  async function searchTests() {
    const seq = ++testSearchSeq
    testLoading.value = true
    try {
      const q = testSearch.value.trim()
      const url = `/screening/lab-tests/search?q=${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': readXsrfToken(),
        },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { results?: LabTestSearchResult[] }
      if (seq !== testSearchSeq) return
      testResults.value = Array.isArray(data.results) ? data.results : []
      testActiveIdx.value = testResults.value.length > 0 ? 0 : -1
      testPopoverOpen.value = true
    } catch {
      if (seq !== testSearchSeq) return
      testResults.value = []
    } finally {
      if (seq === testSearchSeq) testLoading.value = false
    }
  }

  function onTestInput() {
    draft.value.test_name = testSearch.value
    debouncedTestSearch()
  }

  function debouncedTestSearch() {
    if (testSearchTimer) clearTimeout(testSearchTimer)
    testSearchTimer = setTimeout(() => void searchTests(), 250)
  }

  function selectTest(test: LabTestSearchResult) {
    draft.value = {
      test_name: test.name,
      test_code: test.code ?? null,
      specimen_type: test.specimen ?? null,
      lab_specimen_type_id: test.specimen_type_id ?? null,
      test_group: test.group ?? null,
      instructions: draft.value.instructions,
    }
    testSearch.value = test.name
    testPopoverOpen.value = false
    testActiveIdx.value = -1
  }

  function moveTestActive(delta: number) {
    if (!testResults.value.length) return
    const next = testActiveIdx.value + delta
    testActiveIdx.value = (next + testResults.value.length) % testResults.value.length
  }

  function pickTestActive() {
    if (testActiveIdx.value >= 0 && testActiveIdx.value < testResults.value.length) {
      selectTest(testResults.value[testActiveIdx.value])
    }
  }

  function addToCart() {
    if (!draft.value.test_name.trim()) {
      errorMsg.value = 'Select a test before adding to the request.'
      showError.value = true
      return
    }
    const testName = draft.value.test_name.trim()
    if (
      cart.value.some((item) => item.test_name === testName) ||
      options?.isAlreadyRequested?.(testName)
    ) {
      errorMsg.value = 'This test is already in the request.'
      showError.value = true
      return
    }
    showError.value = false
    cart.value.push({ ...draft.value })
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

  function closeTestPopover() {
    testPopoverOpen.value = false
  }

  function setTestActiveIdx(idx: number) {
    testActiveIdx.value = idx
  }

  return {
    cart,
    showModal,
    draft,
    showError,
    errorMsg,
    testSearch,
    testResults,
    testLoading,
    testPopoverOpen,
    testActiveIdx,
    debouncedTestSearch,
    searchTests,
    onTestInput,
    selectTest,
    moveTestActive,
    pickTestActive,
    addToCart,
    removeFromCart,
    clearCart,
    openModal,
    closeModal,
    closeTestPopover,
    setTestActiveIdx,
  }
}
