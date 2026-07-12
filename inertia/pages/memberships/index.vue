<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import { getPlanThemeByTier } from '~/constants/membershipPlanThemes'

interface Plan {
  id: number
  name: string
  slug: string
  tier: number
  description: string | null
  minimumDeposit: number
  minBalance: number | null
  discountPercent: number
  perks: string[]
  isActive: boolean
  sortOrder: number
  activeSubscriptionsCount: number
}

const props = defineProps<{ plans: Plan[] }>()

const fieldClass =
  'theme-field encounters-filter-field w-full px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const filterForm = reactive({
  search: '',
  tier: '',
  status: '',
})

const tierOptions = [1, 2, 3, 4]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Hidden' },
]

const hasFilters = computed(() =>
  Object.values(filterForm).some((value) => value !== null && value !== undefined && value !== '')
)

const activeFilterChips = computed(() => {
  const chips: { key: keyof typeof filterForm; label: string }[] = []

  if (filterForm.search.trim()) chips.push({ key: 'search', label: `Search: “${filterForm.search.trim()}”` })
  if (filterForm.tier) chips.push({ key: 'tier', label: `Tier: ${filterForm.tier}` })
  if (filterForm.status) {
    chips.push({
      key: 'status',
      label: `Status: ${statusOptions.find((o) => o.value === filterForm.status)?.label ?? filterForm.status}`,
    })
  }

  return chips
})

function clearFilters() {
  filterForm.search = ''
  filterForm.tier = ''
  filterForm.status = ''
}

function removeFilter(key: keyof typeof filterForm) {
  filterForm[key] = ''
}

const filteredPlans = computed(() => {
  let list = props.plans
  const term = filterForm.search.trim().toLowerCase()

  if (term) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description?.toLowerCase().includes(term) ?? false) ||
        p.perks.some((perk) => perk.toLowerCase().includes(term))
    )
  }
  if (filterForm.tier) list = list.filter((p) => p.tier === Number(filterForm.tier))
  if (filterForm.status === 'active') list = list.filter((p) => p.isActive)
  if (filterForm.status === 'inactive') list = list.filter((p) => !p.isActive)

  return list
})

const activePlanCount = computed(() => props.plans.filter((p) => p.isActive).length)
const totalActiveFunds = computed(() => props.plans.reduce((sum, p) => sum + p.activeSubscriptionsCount, 0))

const avgDiscount = computed(() => {
  if (!props.plans.length) return '—'
  const total = props.plans.reduce((sum, p) => sum + p.discountPercent, 0)
  return `${(total / props.plans.length).toFixed(1)}%`
})

const kpiCards = computed(() => [
  {
    key: 'total',
    label: 'Total plans',
    value: String(props.plans.length),
    meta: 'Individual wellness fund tiers',
    tone: 'sky',
  },
  {
    key: 'active',
    label: 'Active plans',
    value: String(activePlanCount.value),
    meta: 'Available for patient enrollment',
    tone: 'teal',
  },
  {
    key: 'funds',
    label: 'Active funds',
    value: String(totalActiveFunds.value),
    meta: 'Patients enrolled across all tiers',
    tone: 'violet',
  },
  {
    key: 'discount',
    label: 'Avg discount',
    value: avgDiscount.value,
    meta: 'Mean service discount across tiers',
    tone: 'amber',
  },
])

const kpiCardClass: Record<string, string> = {
  sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white dark:border-sky-900/50 dark:from-sky-950/35 dark:via-neutral-950 dark:to-neutral-950',
  violet:
    'border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-white dark:border-violet-900/50 dark:from-violet-950/30 dark:via-neutral-950 dark:to-neutral-950',
  teal: 'border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-white dark:border-teal-900/50 dark:from-teal-950/30 dark:via-neutral-950 dark:to-neutral-950',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-white dark:border-amber-900/50 dark:from-amber-950/25 dark:via-neutral-950 dark:to-neutral-950',
}

const kpiIconClass: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

const kpiValueClass: Record<string, string> = {
  sky: 'text-slate-900 dark:text-neutral-100',
  violet: 'text-violet-800 dark:text-violet-300',
  teal: 'text-teal-800 dark:text-teal-300',
  amber: 'text-amber-800 dark:text-amber-300',
}

function tierLabel(tier: number): string {
  return getPlanThemeByTier(tier)?.label ?? `Tier ${tier}`
}

function tierBadgeClass(tier: number): string {
  switch (tier) {
    case 1:
      return 'badge b-green'
    case 2:
      return 'badge b-blue'
    case 3:
      return 'badge b-amber'
    case 4:
      return 'badge b-gray'
    default:
      return 'badge b-gray'
  }
}

const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = useForm({
  name: '',
  tier: 1,
  description: '',
  minimum_deposit: 0,
  min_balance: 0,
  discount_percent: 0,
  perks: '',
  is_active: true,
  sort_order: 0,
})

function openCreate() {
  editingId.value = null
  form.reset()
  form.clearErrors()
  showForm.value = true
}

function openEdit(plan: Plan) {
  editingId.value = plan.id
  form.clearErrors()
  form.name = plan.name
  form.tier = plan.tier
  form.description = plan.description ?? ''
  form.minimum_deposit = plan.minimumDeposit
  form.min_balance = plan.minBalance ?? 0
  form.discount_percent = plan.discountPercent
  form.perks = plan.perks.join('\n')
  form.is_active = plan.isActive
  form.sort_order = plan.sortOrder
  showForm.value = true
}

function submit() {
  if (editingId.value) {
    form.put(`/memberships/${editingId.value}`, { onSuccess: () => (showForm.value = false) })
  } else {
    form.post('/memberships', { onSuccess: () => (showForm.value = false) })
  }
}

function destroy(plan: Plan) {
  if (confirm(`Delete plan “${plan.name}”?`)) {
    router.delete(`/memberships/${plan.id}`, { preserveScroll: true })
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Membership Plans</h1></template>

    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Define and manage wellness fund tiers that patients can join through the portal and staff desk.
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        @click="openCreate"
      >
        New Plan
      </button>
    </div>

    <div class="card mb-4 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Wellness fund</p>
      <p class="mt-1 text-sm text-blue-900 dark:text-blue-200">
        {{ totalActiveFunds }} active fund account{{ totalActiveFunds === 1 ? '' : 's' }} across {{ activePlanCount }} plan{{ activePlanCount === 1 ? '' : 's' }}.
        <Link href="/subscriptions" class="font-semibold underline">Manage enrollments →</Link>
      </p>
    </div>

    <!-- KPI strip -->
    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="rounded-xl border p-4 shadow-sm"
        :class="kpiCardClass[card.tone]"
      >
        <div class="mb-2 flex items-center gap-2.5">
          <span
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="kpiIconClass[card.tone]"
            aria-hidden="true"
          >
            <svg v-if="card.key === 'total'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <svg v-else-if="card.key === 'active'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="card.key === 'funds'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 7h10M7 12h10M7 17h6" />
            </svg>
          </span>
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ card.label }}
          </p>
        </div>
        <p class="text-2xl font-bold leading-none" :class="kpiValueClass[card.tone]">{{ card.value }}</p>
        <p class="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{{ card.meta }}</p>
      </div>
    </div>

    <!-- Filters -->
    <form class="card mb-3 p-3" @submit.prevent>
      <div class="grid grid-cols-2 items-end gap-2 lg:grid-cols-12">
        <div class="relative col-span-2 lg:col-span-5">
          <svg
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="filterForm.search"
            type="search"
            placeholder="Search plan name, description, or perks…"
            :class="[fieldClass, 'pl-8']"
          />
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.tier" :class="fieldClass" aria-label="Tier">
            <option value="">All tiers</option>
            <option v-for="tier in tierOptions" :key="tier" :value="String(tier)">
              Tier {{ tier }} · {{ tierLabel(tier) }}
            </option>
          </select>
        </div>

        <div class="col-span-1 lg:col-span-3">
          <select v-model="filterForm.status" :class="fieldClass" aria-label="Status">
            <option value="">All statuses</option>
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="col-span-2 flex justify-end lg:col-span-1">
          <button
            v-if="hasFilters"
            type="button"
            class="theme-icon-btn btn-icon inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Clear filters"
            aria-label="Clear filters"
            @click="clearFilters"
          >
            <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        v-if="hasFilters"
        class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800"
      >
        <span class="text-[11px] text-neutral-500">
          {{ filteredPlans.length }} result{{ filteredPlans.length === 1 ? '' : 's' }}
        </span>
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300"
          @click="removeFilter(chip.key)"
        >
          {{ chip.label }}
          <svg class="h-2.5 w-2.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </form>

    <!-- Plans table -->
    <div class="card overflow-hidden">
      <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Plan directory</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="encounters-table w-full min-w-[1040px] text-sm">
          <thead>
            <tr class="staff-table-head">
              <th class="px-4 py-2.5 text-left">Plan</th>
              <th class="px-4 py-2.5 text-left">Tier</th>
              <th class="px-4 py-2.5 text-right">Min. deposit</th>
              <th class="px-4 py-2.5 text-right">Discount</th>
              <th class="px-4 py-2.5 text-right">Active funds</th>
              <th class="px-4 py-2.5 text-left">Perks</th>
              <th class="px-4 py-2.5 text-left">Status</th>
              <th class="encounters-table__actions px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr
              v-for="row in filteredPlans"
              :key="row.id"
              class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td class="px-4 py-2.5">
                <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ row.name }}</p>
                <p class="text-xs text-neutral-400">Sort #{{ row.sortOrder }}</p>
                <p v-if="row.description" class="mt-0.5 line-clamp-1 text-xs text-neutral-500">{{ row.description }}</p>
                <p v-if="row.tier === 1 && row.minBalance !== null" class="mt-0.5 text-xs text-neutral-500">
                  Min balance ZMW {{ row.minBalance.toFixed(2) }}
                </p>
              </td>
              <td class="px-4 py-2.5">
                <span :class="tierBadgeClass(row.tier)">T{{ row.tier }} · {{ tierLabel(row.tier) }}</span>
              </td>
              <td class="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                ZMW {{ row.minimumDeposit.toFixed(2) }}
              </td>
              <td class="px-4 py-2.5 text-right font-medium text-neutral-800 dark:text-neutral-200">
                {{ row.discountPercent.toFixed(1) }}%
              </td>
              <td class="px-4 py-2.5 text-right font-medium text-neutral-800 dark:text-neutral-200">
                {{ row.activeSubscriptionsCount }}
              </td>
              <td class="px-4 py-2.5">
                <p v-if="row.perks.length" class="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {{ row.perks.join(' · ') }}
                </p>
                <span v-else class="text-xs text-neutral-400">—</span>
              </td>
              <td class="px-4 py-2.5">
                <span :class="row.isActive ? 'badge b-green' : 'badge b-gray'">
                  {{ row.isActive ? 'Active' : 'Hidden' }}
                </span>
              </td>
              <td class="encounters-table__actions px-4 py-2.5">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    @click="openEdit(row)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-red-400 dark:hover:bg-neutral-800"
                    @click="destroy(row)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredPlans.length">
              <td colspan="8" class="px-4 py-12 text-center text-sm text-neutral-500">
                <template v-if="hasFilters">
                  No plans match the current filters.
                  <button type="button" class="font-medium text-neutral-800 underline dark:text-neutral-200" @click="clearFilters">
                    Clear filters
                  </button>
                </template>
                <template v-else>No membership plans yet.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="theme-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
        <h2 class="mb-4 text-base font-semibold">{{ editingId ? 'Edit Plan' : 'New Plan' }}</h2>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-sm font-medium">Name</label>
            <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Tier (1–4)</label>
              <input v-model.number="form.tier" type="number" min="1" max="4" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.tier" class="mt-1 text-sm text-red-600">{{ form.errors.tier }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Min. Deposit</label>
              <input v-model.number="form.minimum_deposit" type="number" step="0.01" min="0" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.minimum_deposit" class="mt-1 text-sm text-red-600">{{ form.errors.minimum_deposit }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Min. Balance</label>
              <input v-model.number="form.min_balance" type="number" step="0.01" min="0" class="theme-field w-full rounded px-3 py-2" />
              <p class="mt-1 text-xs text-neutral-500">Tier 1 only.</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Discount %</label>
              <input v-model.number="form.discount_percent" type="number" step="0.01" min="0" max="100" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.discount_percent" class="mt-1 text-sm text-red-600">{{ form.errors.discount_percent }}</p>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description</label>
            <textarea v-model="form.description" rows="2" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Perks (one per line)</label>
            <textarea v-model="form.perks" rows="3" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.is_active" type="checkbox" /> Active
          </label>
          <div class="flex gap-2 pt-2">
            <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save</ActionButton>
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="showForm = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </StaffLayout>
</template>
