<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface RateCardRow {
  id: number
  code: string
  name: string
  category: string
  activityType: string
  activityKey: string | null
  linkedActivity: string
  price: number
  isActive: boolean
}

const props = defineProps<{
  services: {
    data: RateCardRow[]
    meta: {
      currentPage: number
      lastPage: number
      perPage: number
      total: number
    }
  }
  filters: { search: string; activityType: string }
  activityTypes: string[]
  categories: string[]
  counts: Record<string, number>
}>()

const editingId = ref<number | null>(null)

const activityLabels: Record<string, string> = {
  consultation: 'Consultations',
  lab_test: 'Lab Tests',
  medication: 'Medications',
  treatment_room: 'Treatment Room',
}

const totalServices = computed(() =>
  Object.values(props.counts).reduce((sum, n) => sum + n, 0)
)

function filterByType(type: string) {
  router.get('/rate-card', {
    activity_type: type,
    search: props.filters.search || undefined,
  }, { preserveState: true })
}

function search() {
  const input = (document.getElementById('rate-card-search') as HTMLInputElement | null)?.value ?? ''
  router.get('/rate-card', {
    search: input || undefined,
    activity_type: props.filters.activityType || undefined,
  }, { preserveState: true })
}

function startEdit(row: RateCardRow) {
  editingId.value = row.id
}

function cancelEdit() {
  editingId.value = null
}

function saveEdit(row: RateCardRow, form: HTMLFormElement) {
  const formData = new FormData(form)
  router.put(`/rate-card/${row.id}`, {
    name: formData.get('name'),
    price: Number(formData.get('price')),
    category: formData.get('category'),
    is_active: formData.get('is_active') === 'on',
  }, {
    preserveScroll: true,
    onSuccess: () => {
      editingId.value = null
    },
  })
}

function syncCatalog() {
  if (!confirm('Sync rate card from consultations, lab tests, medications, and treatment room? Existing prices will be kept.')) {
    return
  }
  router.post('/rate-card/sync')
}

function formatPrice(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Rate Card</h1>
    </template>

    <div class="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
      Configure prices for consultations, lab tests, medications, and treatment room services.
      Billing previews and invoices use these rates, falling back to system defaults when a service is inactive or missing.
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="!filters.activityType ? 'bg-orange-600 text-white' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'"
          @click="filterByType('')"
        >
          All ({{ totalServices }})
        </button>
        <button
          v-for="type in activityTypes"
          :key="type"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="filters.activityType === type ? 'bg-orange-600 text-white' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'"
          @click="filterByType(type)"
        >
          {{ activityLabels[type] ?? type }} ({{ counts[type] ?? 0 }})
        </button>
      </div>

      <button
        type="button"
        class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        @click="syncCatalog"
      >
        Sync from Activities
      </button>
    </div>

    <form class="mb-4 flex gap-2" @submit.prevent="search">
      <input
        id="rate-card-search"
        type="search"
        :value="filters.search"
        placeholder="Search by name, code, or activity…"
        class="w-full max-w-md rounded border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <button type="submit" class="rounded bg-neutral-800 px-3 py-1.5 text-sm text-white dark:bg-neutral-200 dark:text-neutral-900">
        Search
      </button>
    </form>

    <div class="theme-surface overflow-hidden rounded-lg shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="theme-card-header text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th class="px-4 py-3">Service</th>
            <th class="px-4 py-3">Activity</th>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3 text-right">Price</th>
            <th class="px-4 py-3">Active</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in services.data"
            :key="row.id"
            class="border-b border-neutral-100"
          >
            <template v-if="editingId === row.id">
              <td colspan="7" class="px-4 py-3">
                <form class="grid gap-3 md:grid-cols-6" @submit.prevent="saveEdit(row, $event.target as HTMLFormElement)">
                  <label class="md:col-span-2">
                    <span class="mb-1 block text-xs text-neutral-500">Name</span>
                    <input name="name" :value="row.name" required class="theme-field w-full rounded px-2 py-1" />
                  </label>
                  <label>
                    <span class="mb-1 block text-xs text-neutral-500">Price</span>
                    <input name="price" type="number" min="0" step="0.01" :value="row.price" required class="theme-field w-full rounded px-2 py-1" />
                  </label>
                  <label>
                    <span class="mb-1 block text-xs text-neutral-500">Category</span>
                    <select name="category" :value="row.category" class="theme-field w-full rounded px-2 py-1">
                      <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                  </label>
                  <label class="flex items-end gap-2 pb-1">
                    <input name="is_active" type="checkbox" :checked="row.isActive" />
                    <span class="text-xs">Active</span>
                  </label>
                  <div class="flex items-end justify-end gap-2">
                    <button type="button" class="text-neutral-500 hover:underline" @click="cancelEdit">Cancel</button>
                    <button type="submit" class="rounded bg-emerald-600 px-3 py-1 text-white">Save</button>
                  </div>
                </form>
              </td>
            </template>
            <template v-else>
              <td class="px-4 py-3">
                <div class="font-medium text-neutral-800 dark:text-neutral-100">{{ row.name }}</div>
                <div class="text-xs text-neutral-500">{{ row.code }}</div>
              </td>
              <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400">{{ row.linkedActivity }}</td>
              <td class="px-4 py-3 capitalize">{{ row.activityType.replace('_', ' ') }}</td>
              <td class="px-4 py-3 capitalize">{{ row.category }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ formatPrice(row.price) }}</td>
              <td class="px-4 py-3">
                <span :class="row.isActive ? 'text-emerald-700' : 'text-neutral-400'">
                  {{ row.isActive ? 'Yes' : 'No' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button type="button" class="text-blue-600 hover:underline" @click="startEdit(row)">Edit</button>
              </td>
            </template>
          </tr>
          <tr v-if="!services.data.length">
            <td colspan="7" class="px-4 py-8 text-center text-neutral-500">
              No rate card services found.
              <button type="button" class="ml-1 text-blue-600 hover:underline" @click="syncCatalog">Sync from activities</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="services.meta.lastPage > 1" class="mt-4 flex items-center justify-between text-sm">
      <span class="text-neutral-500">
        Page {{ services.meta.currentPage }} of {{ services.meta.lastPage }} ({{ services.meta.total }} services)
      </span>
      <div class="flex gap-2">
        <Link
          v-if="services.meta.currentPage > 1"
          :href="`/rate-card?page=${services.meta.currentPage - 1}&activity_type=${filters.activityType}&search=${filters.search}`"
          class="rounded border px-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          preserve-state
        >
          Previous
        </Link>
        <Link
          v-if="services.meta.currentPage < services.meta.lastPage"
          :href="`/rate-card?page=${services.meta.currentPage + 1}&activity_type=${filters.activityType}&search=${filters.search}`"
          class="rounded border px-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          preserve-state
        >
          Next
        </Link>
      </div>
    </div>
  </StaffLayout>
</template>
