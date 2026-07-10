<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const form = useForm({
  head_of_house: '',
  nrc_number: '',
  household_type: '',
  phone_number: '',
  village: '',
  town: '',
  subscription_plan: '',
  subscription_fee: null as number | null,
  payment_method: '',
  payment_status: 'Active',
  transaction_code: '',
})

function submit() {
  form.post('/households')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Create Household</h1></template>

    <form class="max-w-3xl space-y-6" @submit.prevent="submit">
      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Household Details</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Head of House *</label>
            <input v-model="form.head_of_house" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.head_of_house" class="mt-1 text-xs text-red-600">{{ form.errors.head_of_house }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">NRC Number</label>
            <input v-model="form.nrc_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Household Type</label>
            <input v-model="form.household_type" class="theme-field w-full rounded px-3 py-2" placeholder="e.g. Family" />
          </div>
        </div>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Location & Contact</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Phone Number</label>
            <input v-model="form.phone_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Village</label>
            <input v-model="form.village" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Town</label>
            <input v-model="form.town" class="theme-field w-full rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Subscription & Payment</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Subscription Plan</label>
            <input v-model="form.subscription_plan" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Subscription Fee</label>
            <input v-model.number="form.subscription_fee" type="number" step="0.01" min="0" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.subscription_fee" class="mt-1 text-xs text-red-600">{{ form.errors.subscription_fee }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Payment Method</label>
            <input v-model="form.payment_method" class="theme-field w-full rounded px-3 py-2" placeholder="e.g. Cash, Mobile Money" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Payment Status</label>
            <select v-model="form.payment_status" class="theme-field w-full rounded px-3 py-2">
              <option>Active</option>
              <option>Inactive</option>
              <option>Pending</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">Transaction Code</label>
            <input v-model="form.transaction_code" class="theme-field w-full rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Create Household</ActionButton>
        <Link href="/households" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
