<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  isEdit: boolean
  targetFields: string[]
  stageScopes: string[]
  matchKinds: string[]
  triggerContexts: string[]
  testTypes: { id: number; name: string }[]
  catalogNames: string[]
  row?: {
    id: number
    test_name: string | null
    test_type_id: number | null
    match_kind: string
    match_value: string | null
    target_field: string
    suggestion_text: string | null
    prescription_payload: string | null
    stage_scope: string[]
    trigger_context: string
    context_match: string | null
    priority: number
    is_active: boolean
    notes: string | null
  }
}>()

const form = useForm({
  test_name: props.row?.test_name ?? '',
  test_type_id: props.row?.test_type_id ?? null,
  match_kind: props.row?.match_kind ?? 'interpretation',
  match_value: props.row?.match_value ?? '',
  target_field: props.row?.target_field ?? 'final_diagnosis',
  suggestion_text: props.row?.suggestion_text ?? '',
  prescription_payload: props.row?.prescription_payload ?? '',
  stage_scope: props.row?.stage_scope?.length ? [...props.row.stage_scope] : ['screening_review'],
  trigger_context: props.row?.trigger_context ?? 'lab_result',
  context_match: props.row?.context_match ?? '',
  priority: props.row?.priority ?? 0,
  is_active: props.row?.is_active ?? true,
  notes: props.row?.notes ?? '',
})

function toggleStage(stage: string) {
  const idx = form.stage_scope.indexOf(stage)
  if (idx >= 0) form.stage_scope.splice(idx, 1)
  else form.stage_scope.push(stage)
}

function submit() {
  if (props.isEdit && props.row) {
    form.put(`/test-types/possible-results/${props.row.id}`)
  } else {
    form.post('/test-types/possible-results')
  }
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">{{ isEdit ? 'Edit' : 'New' }} Possible Result</h1>
    </template>

    <form class="mx-auto max-w-2xl space-y-4" @submit.prevent="submit">
      <div>
        <label class="field-label">Trigger context</label>
        <select v-model="form.trigger_context" class="field-input">
          <option v-for="ctx in triggerContexts" :key="ctx" :value="ctx">{{ ctx }}</option>
        </select>
      </div>

      <div v-if="form.trigger_context === 'lab_result'" class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">Test name</label>
          <input v-model="form.test_name" list="catalog-names" class="field-input" placeholder="e.g. MPS RDT" />
          <datalist id="catalog-names">
            <option v-for="name in catalogNames" :key="name" :value="name" />
          </datalist>
        </div>
        <div>
          <label class="field-label">Test type (optional)</label>
          <select v-model="form.test_type_id" class="field-input">
            <option :value="null">—</option>
            <option v-for="t in testTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </div>

      <div v-else>
        <label class="field-label">Context match keyword</label>
        <input v-model="form.context_match" class="field-input" placeholder="e.g. fever, malaria, tb" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">Match kind</label>
          <select v-model="form.match_kind" class="field-input">
            <option v-for="k in matchKinds" :key="k" :value="k">{{ k }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">Match value</label>
          <input v-model="form.match_value" class="field-input" placeholder="e.g. Positive, abnormal" />
        </div>
      </div>

      <div>
        <label class="field-label">Target field</label>
        <select v-model="form.target_field" class="field-input">
          <option v-for="f in targetFields" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>

      <div>
        <label class="field-label">Suggestion text</label>
        <textarea v-model="form.suggestion_text" rows="3" class="field-input" />
      </div>

      <div>
        <label class="field-label">Prescription payload (JSON array, optional)</label>
        <textarea v-model="form.prescription_payload" rows="4" class="field-input font-mono text-xs" placeholder='[{"drug_name":"Paracetamol","dose":"1g",...}]' />
      </div>

      <div>
        <label class="field-label mb-2 block">Stage scope</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="stage in stageScopes"
            :key="stage"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-semibold"
            :class="form.stage_scope.includes(stage) ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-neutral-300 text-neutral-600'"
            @click="toggleStage(stage)"
          >
            {{ stage }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">Priority</label>
          <input v-model.number="form.priority" type="number" min="0" class="field-input" />
        </div>
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.is_active" type="checkbox" />
            Active
          </label>
        </div>
      </div>

      <div>
        <label class="field-label">Notes (admin reference)</label>
        <textarea v-model="form.notes" rows="2" class="field-input" />
      </div>

      <div class="flex gap-2">
        <ActionButton type="submit" :loading="form.processing">Save</ActionButton>
        <Link href="/test-types/possible-results" class="btn-secondary inline-flex items-center px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
