<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Link, router, useForm, usePage } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import TermDefinitionPopover from '~/components/dictionary/TermDefinitionPopover.vue'

type Domain = 'diagnosis' | 'drug' | 'lab' | 'symptom'

interface Term {
  id: number
  domain: Domain
  code: string | null
  label: string
  synonyms: string[]
  definition: string | null
  hierarchy_path: string | null
  source: string
  hia_code: string | null
}

const props = defineProps<{
  domain: Domain
  search: string
  page: number
  perPage: number
  total: number
  domainCounts: Record<string, number>
  terms: Term[]
  canManage: boolean
}>()

const pageProps = usePage()
const flash = computed(() => (pageProps.props as any).flash ?? {})

const domains: { key: Domain; label: string }[] = [
  { key: 'diagnosis', label: 'Diagnoses' },
  { key: 'drug', label: 'Drugs' },
  { key: 'lab', label: 'Lab' },
  { key: 'symptom', label: 'Symptoms' },
]

const searchInput = ref(props.search)
const selectedId = ref<number | null>(props.terms[0]?.id ?? null)

watch(
  () => props.terms,
  (rows) => {
    if (!rows.find((t) => t.id === selectedId.value)) {
      selectedId.value = rows[0]?.id ?? null
    }
  }
)

const selected = computed(() => props.terms.find((t) => t.id === selectedId.value) ?? null)

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

function go(domain: Domain, search = searchInput.value, page = 1) {
  router.get(
    '/dictionary',
    { domain, search: search || undefined, page: page > 1 ? page : undefined },
    { preserveState: true, preserveScroll: true }
  )
}

function onSearchSubmit() {
  go(props.domain, searchInput.value, 1)
}

const showCreate = ref(false)
const editing = ref<Term | null>(null)

const createForm = useForm({
  domain: props.domain as Domain,
  label: '',
  code: '',
  definition: '',
  hierarchy_path: '',
  synonyms: '',
  hia_code: '',
  is_active: true,
})

const editForm = reactive({
  label: '',
  code: '',
  definition: '',
  hierarchy_path: '',
  synonyms: '',
  hia_code: '',
  is_active: true,
})

function openEdit(term: Term) {
  editing.value = term
  editForm.label = term.label
  editForm.code = term.code ?? ''
  editForm.definition = term.definition ?? ''
  editForm.hierarchy_path = term.hierarchy_path ?? ''
  editForm.synonyms = term.synonyms.join(', ')
  editForm.hia_code = term.hia_code ?? ''
  editForm.is_active = true
}

function submitCreate() {
  createForm.domain = props.domain
  createForm.post('/dictionary', {
    onSuccess: () => {
      showCreate.value = false
      createForm.reset()
    },
  })
}

function submitEdit() {
  if (!editing.value) return
  router.put(`/dictionary/${editing.value.id}`, { ...editForm }, {
    preserveScroll: true,
    onSuccess: () => {
      editing.value = null
    },
  })
}

function destroyTerm(term: Term) {
  if (!confirm(`Remove or deactivate “${term.label}”?`)) return
  router.delete(`/dictionary/${term.id}`)
}

function syncLibrary() {
  if (!confirm('Re-sync dictionary from ICD-11, NTG, medications, and lab catalogs? Manual definitions are preserved.')) {
    return
  }
  router.post('/dictionary/sync')
}

const domainTone: Record<Domain, string> = {
  diagnosis: 'border-violet-200 bg-violet-50 text-violet-800',
  drug: 'border-sky-200 bg-sky-50 text-sky-800',
  lab: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  symptom: 'border-amber-200 bg-amber-50 text-amber-900',
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Medical Library</h1>
    </template>

    <div
      v-if="flash.success"
      class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {{ flash.success }}
    </div>

    <section class="mb-5 rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 dark:border-teal-700 dark:bg-teal-950/40">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-teal-700/80">Clinical dictionary</p>
          <h2 class="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            Search diagnoses, drugs, lab tests, and symptoms
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Standardized terms with optional definitions help clinicians pick the right language in screening,
            pharmacy, and lab workflows.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="canManage"
            type="button"
            class="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-50"
            @click="syncLibrary"
          >
            Sync sources
          </button>
          <button
            v-if="canManage"
            type="button"
            class="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900"
            @click="showCreate = true"
          >
            Add term
          </button>
        </div>
      </div>
    </section>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="d in domains"
        :key="d.key"
        type="button"
        class="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
        :class="
          domain === d.key
            ? domainTone[d.key]
            : 'theme-surface text-neutral-600 hover:bg-neutral-50'
        "
        @click="go(d.key, searchInput, 1)"
      >
        {{ d.label }}
        <span class="ml-1 tabular-nums opacity-70">({{ domainCounts[d.key] ?? 0 }})</span>
      </button>
    </div>

    <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="onSearchSubmit">
      <input
        v-model="searchInput"
        type="search"
        class="min-w-[16rem] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        :placeholder="`Search ${domain} terms…`"
      />
      <button type="submit" class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
        Search
      </button>
    </form>

    <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div class="theme-surface overflow-hidden rounded-xl">
        <div class="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800">
          {{ total.toLocaleString() }} terms · page {{ page }} / {{ totalPages }}
        </div>
        <ul class="max-h-[32rem] divide-y divide-neutral-100 overflow-y-auto dark:divide-white/[0.04]">
          <li v-if="!terms.length" class="px-4 py-8 text-center text-sm text-neutral-500">
            No terms found. Try Sync sources or broaden your search.
          </li>
          <li
            v-for="term in terms"
            :key="term.id"
            class="cursor-pointer px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            :class="selectedId === term.id ? 'bg-teal-50/80 dark:bg-teal-950/30' : ''"
            @click="selectedId = term.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ term.label }}
                  <TermDefinitionPopover
                    :term-id="term.id"
                    :label="term.label"
                    :definition="term.definition"
                    :code="term.code"
                    :hierarchy-path="term.hierarchy_path"
                  />
                </p>
                <p class="mt-0.5 truncate text-[11px] text-neutral-500">
                  <span v-if="term.code" class="font-mono">{{ term.code }} · </span>
                  {{ term.hierarchy_path || term.source }}
                </p>
                <p v-if="term.definition" class="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {{ term.definition }}
                </p>
              </div>
              <div v-if="canManage" class="flex shrink-0 gap-2">
                <button type="button" class="text-xs text-blue-600 hover:underline" @click.stop="openEdit(term)">
                  Edit
                </button>
                <button type="button" class="text-xs text-red-600 hover:underline" @click.stop="destroyTerm(term)">
                  Remove
                </button>
              </div>
            </div>
          </li>
        </ul>
        <div class="flex items-center justify-between border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <button
            type="button"
            class="text-xs font-semibold text-neutral-600 disabled:opacity-40"
            :disabled="page <= 1"
            @click="go(domain, searchInput, page - 1)"
          >
            ← Previous
          </button>
          <button
            type="button"
            class="text-xs font-semibold text-neutral-600 disabled:opacity-40"
            :disabled="page >= totalPages"
            @click="go(domain, searchInput, page + 1)"
          >
            Next →
          </button>
        </div>
      </div>

      <aside class="theme-surface rounded-xl p-5">
        <template v-if="selected">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Definition</p>
          <h3 class="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ selected.label }}</h3>
          <p v-if="selected.code" class="mt-1 font-mono text-xs text-teal-700 dark:text-teal-300">{{ selected.code }}</p>
          <p v-if="selected.hierarchy_path" class="mt-1 text-xs text-neutral-500">{{ selected.hierarchy_path }}</p>
          <p class="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {{ selected.definition || 'No definition yet. Use Edit to add one for junior clinicians.' }}
          </p>
          <div v-if="selected.synonyms.length" class="mt-4">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Synonyms</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="syn in selected.synonyms"
                :key="syn"
                class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ syn }}
              </span>
            </div>
          </div>
          <p class="mt-4 text-[11px] text-neutral-400">
            Source: {{ selected.source }}
            <span v-if="selected.hia_code"> · HIA {{ selected.hia_code }}</span>
          </p>
          <Link href="/screening/queue" class="mt-4 inline-flex text-xs font-semibold text-teal-800 hover:underline dark:text-teal-300">
            Use in clinical workflows →
          </Link>
        </template>
        <p v-else class="text-sm text-neutral-500">Select a term to view its definition.</p>
      </aside>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h3 class="text-base font-semibold">Add dictionary term</h3>
        <div class="mt-4 space-y-3">
          <input v-model="createForm.label" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Label" />
          <input v-model="createForm.code" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Code (optional)" />
          <textarea v-model="createForm.definition" rows="3" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Definition" />
          <input v-model="createForm.synonyms" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Synonyms (comma-separated)" />
          <input v-model="createForm.hierarchy_path" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Hierarchy path" />
          <input v-model="createForm.hia_code" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="HIA code (optional)" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded px-3 py-2 text-sm" @click="showCreate = false">Cancel</button>
          <button
            type="button"
            class="rounded bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="createForm.processing"
            @click="submitCreate"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h3 class="text-base font-semibold">Edit term</h3>
        <div class="mt-4 space-y-3">
          <input v-model="editForm.label" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Label" />
          <input v-model="editForm.code" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Code" />
          <textarea v-model="editForm.definition" rows="4" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Definition" />
          <input v-model="editForm.synonyms" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Synonyms (comma-separated)" />
          <input v-model="editForm.hierarchy_path" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Hierarchy path" />
          <input v-model="editForm.hia_code" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="HIA code" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded px-3 py-2 text-sm" @click="editing = null">Cancel</button>
          <button type="button" class="rounded bg-teal-800 px-3 py-2 text-sm font-semibold text-white" @click="submitEdit">
            Update
          </button>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
