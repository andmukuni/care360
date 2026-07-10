<script setup lang="ts">
import { computed } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface PatientRequest {
  id: number
  request_type: string
  details: string | null
  status: string
  staff_response: string | null
  created_at: string | null
}

defineProps<{
  patient: Record<string, any>
  requests: { data: PatientRequest[]; meta: Record<string, any> }
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const form = useForm({
  request_type: '',
  details: '',
})

function submit() {
  form.post('/portal/requests', { onSuccess: () => form.reset() })
}

const TYPE_LABELS: Record<string, string> = {
  referral_letter: 'Referral letter',
  medical_certificate: 'Medical certificate',
  sick_note: 'Sick note',
}
function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ')
}
function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Requests</h1>

    <div class="rounded-xl theme-surface p-4 mb-6">
      <h2 class="text-sm font-semibold mb-3">Submit a request</h2>
      <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        <ul class="list-disc list-inside"><li v-for="(msg, key) in errors" :key="key">{{ msg }}</li></ul>
      </div>
      <form @submit.prevent="submit" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Request type</label>
          <select v-model="form.request_type" required class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg">
            <option value="">Select type…</option>
            <option value="referral_letter">Referral letter</option>
            <option value="medical_certificate">Medical certificate</option>
            <option value="sick_note">Sick note</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Details (optional)</label>
          <textarea v-model="form.details" rows="4" maxlength="5000" placeholder="Include dates, employer name, or any details the hospital should know." class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg"></textarea>
        </div>
        <ActionButton type="submit" variant="primary" class="!px-4 !py-2 text-sm" :loading="form.processing" loading-text="Submitting…">Submit request</ActionButton>
      </form>
    </div>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Your requests</h2></div>
      <div class="divide-y divide-neutral-100">
        <div v-for="req in requests.data" :key="req.id" class="px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ typeLabel(req.request_type) }}</p>
              <p class="text-xs text-neutral-500 mt-0.5">{{ fmtDateTime(req.created_at) }}</p>
              <p v-if="req.details" class="text-sm text-neutral-600 mt-1">{{ req.details }}</p>
              <p v-if="req.staff_response" class="text-xs text-emerald-700 mt-2"><span class="font-semibold">Response:</span> {{ req.staff_response }}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">{{ req.status }}</span>
          </div>
        </div>
        <p v-if="!requests.data.length" class="px-4 py-8 text-center text-sm text-neutral-500">No requests yet.</p>
      </div>
    </div>
  </PortalLayout>
</template>
