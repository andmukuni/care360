<script setup lang="ts">
import { computed } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Message {
  id: number
  subject: string
  body: string
  direction: string
  read_at: string | null
  created_at: string | null
}

defineProps<{
  patient: Record<string, any>
  messages: { data: Message[]; meta: Record<string, any> }
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const form = useForm({
  subject: '',
  body: '',
})

function submit() {
  form.post('/portal/messages', { onSuccess: () => form.reset() })
}

function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Messages</h1>

    <div class="rounded-xl theme-surface p-4 mb-6">
      <h2 class="text-sm font-semibold mb-3">Send a message</h2>
      <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        <ul class="list-disc list-inside"><li v-for="(msg, key) in errors" :key="key">{{ msg }}</li></ul>
      </div>
      <form @submit.prevent="submit" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Subject</label>
          <input type="text" v-model="form.subject" required maxlength="160" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Message</label>
          <textarea v-model="form.body" rows="4" required maxlength="5000" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg"></textarea>
        </div>
        <ActionButton type="submit" variant="primary" class="!px-4 !py-2 text-sm" :loading="form.processing" loading-text="Submitting…">Send message</ActionButton>
      </form>
    </div>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Message history</h2></div>
      <div class="divide-y divide-neutral-100">
        <div v-for="message in messages.data" :key="message.id" class="px-4 py-3" :class="message.direction === 'in' ? 'bg-blue-50/50' : ''">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ message.subject }}</p>
              <p class="text-xs text-neutral-500 mt-0.5">{{ fmtDateTime(message.created_at) }} · {{ message.direction === 'in' ? 'From hospital' : 'Sent by you' }}</p>
            </div>
            <span v-if="message.direction === 'in' && !message.read_at" class="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">New</span>
          </div>
          <p class="text-sm text-neutral-700 mt-2 whitespace-pre-line">{{ message.body }}</p>
        </div>
        <p v-if="!messages.data.length" class="px-4 py-8 text-center text-sm text-neutral-500">No messages yet.</p>
      </div>
    </div>
  </PortalLayout>
</template>
