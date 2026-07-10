<script setup lang="ts">
import { computed } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import PortalGuestLayout from '~/layouts/PortalGuestLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Tier {
  threshold: string
  discount: string
}

interface PartnershipOption {
  key: string
  label: string
  tiers: Tier[]
}

defineProps<{
  fundName: string
  partnershipOptions: PartnershipOption[]
  benefits: string[]
  terms: string[]
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)
const firstError = computed(() => {
  const values = Object.values(errors.value)
  return values.length ? String(values[0]) : null
})

const form = useForm({
  company_name: '',
  registration_number: '',
  contact_name: '',
  job_title: '',
  email: '',
  phone: '',
  employees_count: '',
  estimated_deposit_or_volume: '',
  partnership_option: '',
  message: '',
})

const partnershipRadios: Array<{ value: string; label: string }> = [
  { value: 'advance_deposit', label: 'Option A — Advance Deposit' },
  { value: 'hybrid', label: 'Option B — Hybrid Model' },
]

function formatThreshold(threshold: string): string {
  const numeric = Number(threshold.replace(/[>+,]|Custom/g, ''))
  if (!Number.isNaN(numeric) && numeric > 0) {
    return 'ZMW ' + numeric.toLocaleString('en-US')
  }
  return threshold
}

function submit() {
  form.post('/wellness-fund/corporate')
}
</script>

<template>
  <PortalGuestLayout>
    <div class="text-left">
      <div class="mb-6">
        <p class="text-xs font-semibold text-teal-700 uppercase tracking-wide">
          {{ clinicName }}
        </p>
        <h1 class="text-xl font-bold text-neutral-900 mt-1">Corporate Wellness Partnership</h1>
        <p class="text-neutral-600 mt-2 text-sm leading-relaxed">
          A structured partnership for registered companies and institutions to manage employee
          healthcare costs through the {{ fundName }} corporate program.
        </p>
      </div>

      <section class="mb-6">
        <h2 class="text-sm font-bold text-teal-800 mb-3">Partnership Options</h2>
        <div class="grid gap-3">
          <div
            v-for="option in partnershipOptions"
            :key="option.key"
            class="rounded-xl border border-teal-100 bg-white p-4 shadow-sm"
          >
            <h3 class="font-semibold text-neutral-900 mb-2 text-sm">{{ option.label }}</h3>
            <ul class="space-y-1 text-sm text-neutral-700">
              <li v-for="(tier, idx) in option.tiers" :key="idx">
                <span class="font-medium">{{ formatThreshold(tier.threshold) }}</span>
                → {{ tier.discount }}% discount
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="mb-6">
        <h2 class="text-sm font-bold text-teal-800 mb-2">Corporate Value-Added Benefits</h2>
        <ul class="list-disc pl-5 space-y-1 text-sm text-neutral-700">
          <li v-for="(benefit, idx) in benefits" :key="idx">{{ benefit }}</li>
        </ul>
      </section>

      <section class="mb-6">
        <h2 class="text-sm font-bold text-teal-800 mb-2">Terms for Corporate Clients</h2>
        <ul class="list-disc pl-5 space-y-1 text-sm text-neutral-700">
          <li v-for="(term, idx) in terms" :key="idx">{{ term }}</li>
        </ul>
      </section>

      <section class="theme-surface rounded-2xl p-4 shadow-sm">
        <h2 class="text-base font-bold text-neutral-900 mb-1">Corporate KYC / Sign-up</h2>
        <p class="text-xs text-neutral-600 mb-4">
          Submit your details and our team will contact you to complete KYC and sign the formal
          agreement.
        </p>

        <div
          v-if="firstError"
          class="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm"
        >
          {{ firstError }}
        </div>

        <form @submit.prevent="submit" class="grid gap-3">
          <label class="block text-sm">
            <span class="font-medium">Company name *</span>
            <input
              v-model="form.company_name"
              type="text"
              required
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Registration number</span>
            <input
              v-model="form.registration_number"
              type="text"
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Contact name *</span>
            <input
              v-model="form.contact_name"
              type="text"
              required
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Job title</span>
            <input
              v-model="form.job_title"
              type="text"
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Email *</span>
            <input
              v-model="form.email"
              type="email"
              required
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Phone</span>
            <input
              v-model="form.phone"
              type="text"
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Employees (approx.)</span>
            <input
              v-model="form.employees_count"
              type="number"
              min="1"
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Estimated deposit (ZMW)</span>
            <input
              v-model="form.estimated_deposit_or_volume"
              type="number"
              step="0.01"
              min="0"
              class="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <fieldset>
            <legend class="font-medium text-sm mb-2">Partnership option *</legend>
            <div class="grid gap-2">
              <label
                v-for="radio in partnershipRadios"
                :key="radio.value"
                class="flex items-center gap-2 rounded border px-3 py-2 text-sm"
              >
                <input
                  v-model="form.partnership_option"
                  type="radio"
                  :value="radio.value"
                  required
                />
                {{ radio.label }}
              </label>
            </div>
          </fieldset>

          <label class="block text-sm">
            <span class="font-medium">Additional notes</span>
            <textarea
              v-model="form.message"
              rows="4"
              class="mt-1 w-full rounded border px-3 py-2"
            ></textarea>
          </label>

          <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Submitting…">Submit KYC request</ActionButton>
        </form>
      </section>
    </div>
  </PortalGuestLayout>
</template>
