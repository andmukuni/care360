<script setup lang="ts">
import { ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  encounter: { id: number; encounter_number: string; patient_name: string | null }
  groups: string[]
  existingItems: { test_name: string; specimen_type: string | null; lab_specimen_type_id: number | null; test_group: string | null }[]
  existingPriority: string
}>()

const query = ref('')
const searchResults = ref<any[]>([])
const items = ref<any[]>([...props.existingItems])
const priority = ref(props.existingPriority || 'normal')
const saving = ref(false)
let timer: any = null

function search() {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (query.value.trim().length < 1) {
      searchResults.value = []
      return
    }
    const res = await fetch(`/screening/lab-tests/search?q=${encodeURIComponent(query.value.trim())}`, {
      headers: { Accept: 'application/json' },
    })
    const data = await res.json()
    searchResults.value = data.results ?? []
  }, 250)
}

function addItem(t: any) {
  if (items.value.some((i) => i.test_name === t.name)) return
  items.value.push({
    test_name: t.name,
    test_code: t.code ?? null,
    specimen_type: t.specimen ?? null,
    lab_specimen_type_id: t.specimen_type_id ?? null,
    test_group: t.group ?? null,
  })
  query.value = ''
  searchResults.value = []
}
function removeItem(i: number) {
  items.value.splice(i, 1)
}

async function save() {
  if (!items.value.length) return
  saving.value = true
  try {
    await fetch(`/lab/${props.encounter.id}/add-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items.value, priority_level: priority.value }),
    })
    router.visit(`/lab/${props.encounter.id}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">Add Tests — {{ encounter.patient_name }} ({{ encounter.encounter_number }})</h1>
    </template>

    <div class="max-w-3xl space-y-4">
      <div class="theme-panel rounded-lg p-4">
        <input v-model="query" type="search" placeholder="Search tests…" class="theme-field w-full rounded px-2 py-1.5 text-sm" @input="search" />
        <ul v-if="searchResults.length" class="mt-2 max-h-56 overflow-y-auto rounded border border-sand-6">
          <li v-for="t in searchResults" :key="t.id" class="cursor-pointer border-b border-sand-4 px-2 py-1.5 text-sm hover:bg-sand-2" @click="addItem(t)">
            <div>{{ t.name }} <span class="text-sand-11">{{ t.group }}</span></div>
            <div v-if="t.definition" class="mt-0.5 line-clamp-2 text-[11px] text-sand-11">{{ t.definition }}</div>
          </li>
        </ul>
      </div>

      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-2 text-sm font-medium">Selected ({{ items.length }})</h3>
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="(it, i) in items" :key="i" class="border-b border-sand-4">
              <td class="py-1.5">{{ it.test_name }}</td>
              <td class="text-sand-11">{{ it.specimen_type ?? '—' }}</td>
              <td class="text-right"><button type="button" class="text-red-600 hover:underline" @click="removeItem(i)">Remove</button></td>
            </tr>
            <tr v-if="!items.length"><td colspan="3" class="py-3 text-center text-sand-11">No tests selected.</td></tr>
          </tbody>
        </table>
        <div class="mt-3 flex items-center gap-2">
          <select v-model="priority" class="rounded border border-sand-6 px-2 py-1.5 text-sm">
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
          <ActionButton variant="blue" :loading="saving" loading-text="Saving…" :disabled="!items.length" @click="save">Save tests</ActionButton>
        </div>
      </div>

      <Link :href="`/lab/${encounter.id}`" class="text-sm text-blue-600 hover:underline">Back to lab</Link>
    </div>
  </StaffLayout>
</template>
