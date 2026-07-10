<script setup lang="ts">
import { ref } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import DataTable from '~/components/staff/DataTable.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

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

defineProps<{ plans: Plan[] }>()

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'tier', label: 'Tier' },
  { key: 'minimumDeposit', label: 'Min. Deposit' },
  { key: 'discountPercent', label: 'Discount %' },
  { key: 'activeSubscriptionsCount', label: 'Active Funds' },
  { key: 'isActive', label: 'Active' },
]

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
    router.delete(`/memberships/${plan.id}`)
  }
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Membership Plans</h1></template>

    <div class="mb-4 flex justify-end">
      <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openCreate">
        New Plan
      </button>
    </div>

    <DataTable :columns="columns" :rows="plans">
      <template #cell:minimumDeposit="{ row }">ZMW {{ row.minimumDeposit.toFixed(2) }}</template>
      <template #cell:isActive="{ row }">
        <span :class="row.isActive ? 'text-green-700' : 'text-sand-11'">{{ row.isActive ? 'Yes' : 'No' }}</span>
      </template>
      <template #actions="{ row }">
        <button type="button" class="text-blue-600 hover:underline" @click="openEdit(row)">Edit</button>
        <button type="button" class="ml-3 text-red-600 hover:underline" @click="destroy(row)">Delete</button>
      </template>
    </DataTable>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg theme-panel rounded-lg p-6">
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
              <p class="mt-1 text-xs text-sand-11">Tier 1 only.</p>
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
