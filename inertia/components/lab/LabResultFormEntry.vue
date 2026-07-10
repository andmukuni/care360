<script setup lang="ts">
import { computed, ref } from 'vue'
import VitalInputWithBadge from '~/components/ui/VitalInputWithBadge.vue'
import SelectWithBadge from '~/components/ui/SelectWithBadge.vue'
import type { LabResultFormMaps, LabResultFormState } from '~/support/lab/lab_result_forms'
import {
  customFieldsForForm,
  FORM_TYPE_LABELS,
  FBC_FIELD_GROUPS,
  PANEL_FIELD_GROUPS,
  PANEL_LABELS,
} from '~/support/lab/lab_result_forms'
import {
  deriveInterpretationFromSelection,
  deriveInterpretationFromValue,
  deriveInterpretationForState,
  effectiveReferenceRange,
  fbcFieldBadge,
  formSummaryBadge,
  interpretationBadge,
  panelTextFieldBadge,
  customFieldBadge,
  quantitativeValueBadge,
} from '~/support/lab/lab_result_badges'
import LabPanelFieldInput from '~/components/lab/LabPanelFieldInput.vue'

const props = defineProps<{
  modelValue: LabResultFormState
  maps: LabResultFormMaps
  testName?: string | null
  formLabel?: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LabResultFormState]
}>()

const state = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const formType = computed(() => state.value.formType || 'quantitative')
const formTypeLabel = computed(
  () => props.formLabel ?? FORM_TYPE_LABELS[formType.value] ?? 'Quantitative result'
)
const customFields = computed(() => customFieldsForForm(state.value.formKey, props.maps))

const referenceRangeHint = computed(() =>
  effectiveReferenceRange(state.value.range, props.testName ?? null)
)

const valueBadge = computed(() =>
  quantitativeValueBadge(state.value.value, state.value.range, props.testName ?? null)
)

const interpretationFieldBadge = computed(() => interpretationBadge(state.value.interp))

const formSummary = computed(() =>
  formSummaryBadge(formType.value, state.value, props.testName ?? null)
)

function fbcBadgeFor(key: string) {
  return fbcFieldBadge(key, state.value.fbc[key])
}

function panelBadgeFor(panelKey: string, fieldKey: string) {
  const panels: Record<string, Record<string, string>> = {
    stool: state.value.stool,
    urine_chem: state.value.urine_chem,
    urine_micro: state.value.urine_micro,
    urine_macro: state.value.urine_macro,
    hvs: state.value.hvs,
    custom: state.value.custom,
  }
  const formTypeMap: Record<string, string> = {
    stool: 'stool_analysis',
    urine_chem: 'urine_chemistry',
    urine_micro: 'urine_microscopy',
    urine_macro: 'urine_macroscopy',
    hvs: 'hvs',
    custom: 'custom',
  }
  const value = panels[panelKey]?.[fieldKey] ?? ''
  if (panelKey === 'custom') {
    const field = customFields.value.find((f) => f.key === fieldKey)
    return customFieldBadge(field?.type ?? 'text', value)
  }
  return panelTextFieldBadge(formTypeMap[panelKey], fieldKey, value)
}

const interpManual = ref(Boolean(state.value.interp?.trim()))

function deriveInterpretation(next: LabResultFormState): string {
  return deriveInterpretationForState(next.formType, next, props.testName ?? null) ?? ''
}

function emitState(next: LabResultFormState, options?: { autoInterpret?: boolean }) {
  const shouldAutoInterpret = options?.autoInterpret ?? false
  if (shouldAutoInterpret && !interpManual.value) {
    const derived = deriveInterpretation(next)
    next = { ...next, interp: derived }
  }
  emit('update:modelValue', next)
}

function patch(partial: Partial<LabResultFormState>, options?: { autoInterpret?: boolean }) {
  const autoInterpret =
    options?.autoInterpret ??
    ('value' in partial || 'range' in partial)
  emitState({ ...state.value, ...partial }, { autoInterpret })
}

function patchInterp(interp: string) {
  interpManual.value = interp !== ''
  patch({ interp }, { autoInterpret: false })
}

function patchResultValue(value: string) {
  patch({ value }, { autoInterpret: true })
}

type PanelKey = 'fbc' | 'stool' | 'urine_chem' | 'urine_micro' | 'urine_macro' | 'hvs' | 'custom'

function patchPanelField(panelKey: PanelKey, field: string, value: string) {
  const current = state.value[panelKey]
  if (typeof current !== 'object' || current === null) return
  const next: LabResultFormState = {
    ...state.value,
    [panelKey]: { ...(current as Record<string, string>), [field]: value },
  }
  emitState(next, { autoInterpret: true })
}

const interpretationOptions = [
  { value: '', label: '—' },
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'critical', label: 'Critical' },
  { value: 'inconclusive', label: 'Inconclusive' },
]

const urineColourOptions = [
  'Pale Yellow',
  'Yellow',
  'Dark Yellow',
  'Amber',
  'Orange',
  'Pink',
  'Red',
  'Brown',
  'Colourless',
  'Other',
]

const urineTurbidityOptions = ['Clear', 'Slightly Turbid', 'Turbid', 'Very Turbid']

const urineColourSelectOptions = urineColourOptions.map((opt) => ({ value: opt, label: opt }))
const urineTurbiditySelectOptions = urineTurbidityOptions.map((opt) => ({ value: opt, label: opt }))
</script>

<template>
  <div class="lab-result-form-entry space-y-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
        {{ formTypeLabel }}
      </p>
      <span
        v-if="formSummary"
        class="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
        :style="{ background: formSummary.bg, color: formSummary.color }"
      >
        {{ formSummary.label }}
      </span>
    </div>

    <template v-if="formType === 'quantitative'">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Result value</label>
          <VitalInputWithBadge
            :model-value="state.value"
            input-type="text"
            input-class="text-sm"
            :readonly="disabled"
            :badge="valueBadge ?? interpretationFieldBadge"
            :placeholder="referenceRangeHint ? `e.g. within ${referenceRangeHint}` : 'Enter numeric or text result'"
            @update:model-value="patchResultValue(String($event ?? ''))"
          />
        </div>
        <div>
          <label class="field-label">Reference range</label>
          <input
            :value="state.range"
            :disabled="disabled"
            class="field-input text-sm"
            :placeholder="referenceRangeHint || 'e.g. 11.5–16.5'"
            @input="patch({ range: ($event.target as HTMLInputElement).value }, { autoInterpret: true })"
          />
        </div>
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="md:col-span-2">
          <label class="field-label">Result text / notes</label>
          <textarea
            :value="state.text"
            :disabled="disabled"
            class="field-input text-sm"
            rows="2"
            placeholder="Narrative or microscopy findings…"
            @input="patch({ text: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'rapid_test'">
      <div class="flex flex-wrap gap-3">
        <label
          v-for="option in ['Negative', 'Positive']"
          :key="option"
          class="flex cursor-pointer items-center gap-2 rounded border px-4 py-3 text-sm transition"
          :class="
            state.value === option
              ? option === 'Negative'
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-red-500 bg-red-50 text-red-800'
              : 'theme-surface'
          "
        >
          <input
            type="radio"
            class="sr-only"
            :checked="state.value === option"
            :disabled="disabled"
            @change="patchResultValue(option)"
          />
          <span class="font-semibold">{{ option }}</span>
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'reactive_test'">
      <div class="flex flex-wrap gap-3">
        <label
          v-for="option in ['Non-Reactive', 'Reactive']"
          :key="option"
          class="flex cursor-pointer items-center gap-2 rounded border px-4 py-3 text-sm transition"
          :class="
            state.value === option
              ? option === 'Non-Reactive'
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-red-500 bg-red-50 text-red-800'
              : 'theme-surface'
          "
        >
          <input
            type="radio"
            class="sr-only"
            :checked="state.value === option"
            :disabled="disabled"
            @change="patchResultValue(option)"
          />
          <span class="font-semibold">{{ option }}</span>
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'koh'">
      <div class="flex flex-wrap gap-3">
        <label
          v-for="option in ['No Yeast Seen', 'Yeast Seen']"
          :key="option"
          class="flex cursor-pointer items-center gap-2 rounded border px-4 py-3 text-sm transition"
          :class="
            state.value === option
              ? option === 'No Yeast Seen'
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-red-500 bg-red-50 text-red-800'
              : 'theme-surface'
          "
        >
          <input
            type="radio"
            class="sr-only"
            :checked="state.value === option"
            :disabled="disabled"
            @change="patchResultValue(option)"
          />
          <span class="font-semibold">{{ option }}</span>
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'urine_macroscopy'">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Colour</label>
          <SelectWithBadge
            :model-value="state.urine_macro.colour"
            select-class="text-sm"
            :disabled="disabled"
            :badge="panelBadgeFor('urine_macro', 'colour')"
            :options="[{ value: '', label: '— Select —' }, ...urineColourSelectOptions]"
            @update:model-value="patchPanelField('urine_macro', 'colour', $event)"
          />
        </div>
        <div>
          <label class="field-label">Turbidity</label>
          <SelectWithBadge
            :model-value="state.urine_macro.turbidity"
            select-class="text-sm"
            :disabled="disabled"
            :badge="panelBadgeFor('urine_macro', 'turbidity')"
            :options="[{ value: '', label: '— Select —' }, ...urineTurbiditySelectOptions]"
            @update:model-value="patchPanelField('urine_macro', 'turbidity', $event)"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'fbc'">
      <p class="text-xs text-neutral-500">Fill in values from the analyser printout. Leave blanks empty.</p>
      <div
        v-for="(groupKeys, groupLabel) in {
          'Absolute counts': FBC_FIELD_GROUPS.absolute,
          'Differentials %': FBC_FIELD_GROUPS.differentials,
          'Red cell indices': FBC_FIELD_GROUPS.redCell,
          'Platelet indices': FBC_FIELD_GROUPS.platelet,
        }"
        :key="groupLabel"
        class="space-y-2"
      >
        <p class="text-[10px] font-bold uppercase text-neutral-500">{{ groupLabel }}</p>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
          <div v-for="key in groupKeys" :key="key" class="space-y-0.5">
            <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {{ PANEL_LABELS.fbc[key] }}
            </label>
            <div class="flex items-center gap-1">
              <VitalInputWithBadge
                :model-value="state.fbc[key]"
                input-type="number"
                step="any"
                input-class="flex-1 text-xs"
                :readonly="disabled"
                :badge="fbcBadgeFor(key)"
                @update:model-value="patchPanelField('fbc', key, String($event ?? ''))"
              />
              <span v-if="PANEL_LABELS.fbc_units[key]" class="text-[10px] text-neutral-400">
                {{ PANEL_LABELS.fbc_units[key] }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'stool_analysis'">
      <div
        v-for="(groupKeys, groupLabel) in {
          Macroscopy: PANEL_FIELD_GROUPS.stool_macro,
          'Stool microscopy': PANEL_FIELD_GROUPS.stool_micro,
        }"
        :key="groupLabel"
        class="space-y-2"
      >
        <p class="text-[10px] font-bold uppercase text-neutral-500">{{ groupLabel }}</p>
        <div class="grid grid-cols-2 gap-2">
          <div v-for="key in groupKeys" :key="key" class="space-y-0.5">
            <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {{ groupLabel === 'Macroscopy' ? PANEL_LABELS.stool_macro[key] : PANEL_LABELS.stool_micro[key] }}
            </label>
            <LabPanelFieldInput
              :model-value="state.stool[key]"
              :disabled="disabled"
              :badge="panelBadgeFor('stool', key)"
              @update:model-value="patchPanelField('stool', key, $event)"
            />
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'urine_chemistry'">
      <div class="grid grid-cols-2 gap-2">
        <div v-for="key in PANEL_FIELD_GROUPS.urine_chem" :key="key" class="space-y-0.5">
          <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {{ PANEL_LABELS.urine_chem[key] }}
          </label>
          <LabPanelFieldInput
            :model-value="state.urine_chem[key]"
            :disabled="disabled"
            :badge="panelBadgeFor('urine_chem', key)"
            @update:model-value="patchPanelField('urine_chem', key, $event)"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'urine_microscopy'">
      <div class="grid grid-cols-2 gap-2">
        <div v-for="key in PANEL_FIELD_GROUPS.urine_micro" :key="key" class="space-y-0.5">
          <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {{ PANEL_LABELS.urine_micro[key] }}
          </label>
          <LabPanelFieldInput
            :model-value="state.urine_micro[key]"
            :disabled="disabled"
            :badge="panelBadgeFor('urine_micro', key)"
            @update:model-value="patchPanelField('urine_micro', key, $event)"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'hvs'">
      <div class="grid grid-cols-2 gap-2">
        <div v-for="key in PANEL_FIELD_GROUPS.hvs" :key="key" class="space-y-0.5">
          <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {{ PANEL_LABELS.hvs[key] }}
          </label>
          <LabPanelFieldInput
            :model-value="state.hvs[key]"
            :disabled="disabled"
            :badge="panelBadgeFor('hvs', key)"
            @update:model-value="patchPanelField('hvs', key, $event)"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">Interpretation</label>
          <SelectWithBadge
            :model-value="state.interp"
            select-class="text-sm"
            :disabled="disabled"
            :badge="interpretationFieldBadge"
            :options="interpretationOptions"
            @update:model-value="patchInterp($event)"
          />
        </div>
        <div>
          <label class="field-label">Remarks</label>
          <input
            :value="state.remarks"
            :disabled="disabled"
            class="field-input text-sm"
            placeholder="Optional"
            @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="formType === 'custom'">
      <div v-for="field in customFields" :key="field.key" class="space-y-1">
        <label class="field-label">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </label>
        <textarea
          v-if="field.type === 'textarea'"
          :value="state.custom[field.key] ?? ''"
          :disabled="disabled"
          class="field-input text-sm"
          rows="2"
          :placeholder="field.placeholder ?? ''"
          @input="patchPanelField('custom', field.key, ($event.target as HTMLTextAreaElement).value)"
        />
        <SelectWithBadge
          v-else-if="field.type === 'select'"
          :model-value="state.custom[field.key] ?? ''"
          select-class="text-sm"
          :disabled="disabled"
          :badge="panelBadgeFor('custom', field.key)"
          :options="[{ value: '', label: '— Select —' }, ...field.options.map((opt) => ({ value: opt, label: opt }))]"
          @update:model-value="patchPanelField('custom', field.key, $event)"
        />
        <LabPanelFieldInput
          v-else-if="field.type === 'number'"
          :model-value="state.custom[field.key] ?? ''"
          input-type="number"
          step="any"
          input-class="text-sm"
          :disabled="disabled"
          :badge="panelBadgeFor('custom', field.key)"
          :placeholder="field.placeholder ?? ''"
          @update:model-value="patchPanelField('custom', field.key, $event)"
        />
        <LabPanelFieldInput
          v-else
          :model-value="state.custom[field.key] ?? ''"
          input-class="text-sm"
          :disabled="disabled"
          :badge="panelBadgeFor('custom', field.key)"
          :placeholder="field.placeholder ?? ''"
          @update:model-value="patchPanelField('custom', field.key, $event)"
        />
      </div>
      <div>
        <label class="field-label">Interpretation</label>
        <SelectWithBadge
          :model-value="state.interp"
          select-class="text-sm"
          :disabled="disabled"
          :badge="interpretationFieldBadge"
          :options="interpretationOptions"
          @update:model-value="patchInterp($event)"
        />
      </div>
      <div>
        <label class="field-label">Remarks</label>
        <input
          :value="state.remarks"
          :disabled="disabled"
          class="field-input text-sm"
          placeholder="Optional"
          @input="patch({ remarks: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </div>
</template>
