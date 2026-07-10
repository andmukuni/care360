<script setup lang="ts">
import { computed } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Document {
  id: number
  title: string
  original_filename: string
  approved_for_patient: boolean
  created_at: string | null
}

defineProps<{
  patient: Record<string, any>
  documents: { data: Document[]; meta: Record<string, any> }
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const form = useForm<{ title: string; file: File | null }>({
  title: '',
  file: null,
})

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  form.file = target.files?.[0] ?? null
}

function submit() {
  form.post('/portal/documents', {
    forceFormData: true,
    onSuccess: () => form.reset('title', 'file'),
  })
}

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Documents</h1>

    <div class="rounded-xl theme-surface p-4 mb-6">
      <h2 class="text-sm font-semibold mb-3">Upload document</h2>
      <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        <ul class="list-disc list-inside">
          <li v-for="(msg, key) in errors" :key="key">{{ msg }}</li>
        </ul>
      </div>
      <form @submit.prevent="submit" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Title</label>
          <input type="text" v-model="form.title" required maxlength="160" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">File (PDF, JPG, PNG — max 10 MB)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" required @change="onFile" class="w-full text-sm text-neutral-600" />
        </div>
        <ActionButton type="submit" variant="primary" class="!px-4 !py-2 text-sm" :loading="form.processing" loading-text="Submitting…">Upload</ActionButton>
      </form>
      <p class="text-xs text-neutral-500 mt-3">Uploaded files require hospital approval before they appear in your shared records.</p>
    </div>

    <div class="rounded-xl theme-surface overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Your documents</h2></div>
      <div class="divide-y divide-neutral-100">
        <div v-for="document in documents.data" :key="document.id" class="px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ document.title }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">{{ fmtDate(document.created_at) }} · {{ document.original_filename }}</p>
          </div>
          <div class="text-right shrink-0">
            <template v-if="document.approved_for_patient">
              <span class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Approved</span>
              <a :href="`/portal/documents/${document.id}/download`" class="block text-xs font-semibold underline mt-1">Download</a>
            </template>
            <span v-else class="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending review</span>
          </div>
        </div>
        <p v-if="!documents.data.length" class="px-4 py-8 text-center text-sm text-neutral-500">No documents yet. Upload referrals, test results, or other files to share with the hospital.</p>
      </div>
    </div>
  </PortalLayout>
</template>
