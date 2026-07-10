<script setup lang="ts">
import { computed } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{
  patient: Record<string, any>
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const form = useForm({
  title: '',
  severity: 'medium',
  description: '',
})

function submit() {
  form.post('/portal/feedback', { onSuccess: () => form.reset() })
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Feedback</h1>

    <div class="rounded-xl theme-surface p-4">
      <h2 class="text-sm font-semibold mb-3">Share your feedback</h2>
      <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        <ul class="list-disc list-inside"><li v-for="(msg, key) in errors" :key="key">{{ msg }}</li></ul>
      </div>
      <p class="text-sm text-neutral-600 mb-4">Tell us about your experience. Your feedback helps us improve care and services.</p>
      <form @submit.prevent="submit" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Subject</label>
          <input type="text" v-model="form.title" required maxlength="160" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Severity</label>
          <select v-model="form.severity" required class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg">
            <option value="low">Low — suggestion or minor issue</option>
            <option value="medium">Medium — needs attention</option>
            <option value="high">High — urgent concern</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Description</label>
          <textarea v-model="form.description" rows="5" required maxlength="5000" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg"></textarea>
        </div>
        <ActionButton type="submit" variant="primary" class="!px-4 !py-2 text-sm" :loading="form.processing" loading-text="Submitting…">Submit feedback</ActionButton>
      </form>
    </div>
  </PortalLayout>
</template>
