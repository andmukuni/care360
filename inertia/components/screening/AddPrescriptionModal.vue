<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import type { MedSearchResult } from '~/composables/usePrescriptionCart'

const show = defineModel<boolean>('show', { required: true })

const props = defineProps<{
  form: {
    drug_name: string
    formulation: string
    dose: string
    item_per_dose: number
    frequency: number | string
    time_per: string
    frequency_unit: string
    duration: number | string
    duration_unit: string
    route: string
    start_date: string
    end_date: string
    quantity_prescribed: number | string
    is_passer_by: string
    instructions: string
  }
  drugSearch: string
  drugResults: MedSearchResult[]
  drugLoading: boolean
  drugPopoverOpen: boolean
  drugActiveIdx: number
  selectedDrugUnits: string[]
  showError: boolean
  errorMsg: string
  quantityFormulaHint: string
}>()

const emit = defineEmits<{
  'update:drugSearch': [value: string]
  'update:form': [value: typeof props.form]
  drugInput: []
  drugFocus: []
  selectDrug: [med: MedSearchResult]
  moveDrugActive: [delta: number]
  pickDrugActive: []
  closeDrugPopover: []
  setDrugActiveIdx: [idx: number]
  computeQuantity: []
  addToCart: []
  close: []
}>()

function patchForm(partial: Partial<typeof props.form>) {
  emit('update:form', { ...props.form, ...partial })
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-rx-drug-search]')) emit('closeDrugPopover')
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('close')"
    >
    <div
      class="modal-panel flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg shadow-2xl"
      @click.stop
    >
      <div
        class="flex flex-shrink-0 items-center justify-between theme-card-header px-6 py-4"
      >
        <h3 class="text-base font-bold text-neutral-900 dark:text-white">Add Prescription Request</h3>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          @click="emit('close')"
        >
          <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 space-y-4 overflow-y-auto p-6">
        <div class="relative" data-rx-drug-search>
          <label class="field-label">General Drug <span class="text-red-500">*</span></label>
          <div class="relative">
            <input
              :value="drugSearch"
              type="text"
              class="field-input pr-8"
              placeholder="Type to search medication…"
              autocomplete="off"
              spellcheck="false"
              @input="emit('update:drugSearch', ($event.target as HTMLInputElement).value); emit('drugInput')"
              @focus="emit('drugFocus')"
              @keydown.arrow-down.prevent="emit('moveDrugActive', 1)"
              @keydown.arrow-up.prevent="emit('moveDrugActive', -1)"
              @keydown.enter.prevent="emit('pickDrugActive')"
              @keydown.escape="emit('closeDrugPopover')"
            />
            <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg
                v-if="drugLoading"
                class="h-4 w-4 animate-spin text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <svg
                v-else
                class="h-4 w-4 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
          </div>
          <div
            v-if="drugPopoverOpen && (drugResults.length > 0 || drugSearch.length > 0)"
            class="theme-surface absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded shadow-lg"
          >
            <div
              v-if="drugResults.length === 0 && !drugLoading"
              class="px-4 py-3.5 text-center text-sm text-neutral-400"
            >
              No medications found for "{{ drugSearch }}"
            </div>
            <div
              v-for="(med, idx) in drugResults"
              :key="med.id"
              class="cursor-pointer border-b border-neutral-100 px-4 py-2.5 last:border-0"
              :class="drugActiveIdx === idx ? 'bg-neutral-100 dark:bg-neutral-700' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'"
              @mouseenter="emit('setDrugActiveIdx', idx)"
              @click="emit('selectDrug', med)"
            >
              <div class="text-sm font-semibold text-neutral-900 dark:text-white">{{ med.name }}</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                {{ med.units?.length ? med.units.join(' · ') : med.form || '' }}
              </div>
              <div v-if="med.definition" class="mt-0.5 line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ med.definition }}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="field-label">Frequency Unit (if not Time unit) <span class="text-red-500">*</span></label>
          <select
            :value="form.frequency_unit"
            class="field-input"
            @change="patchForm({ frequency_unit: ($event.target as HTMLSelectElement).value })"
          >
            <option value="">--Select--</option>
            <option value="STAT">Stat - 1 time only immediately</option>
            <option value="QHS">QHS- At Bed Time (1/1)</option>
            <option value="Nocturnal">Nocturnal- At bed time-night (1/1)</option>
            <option value="QAM">QAM- Each Morning (1/1)</option>
            <option value="OD">OD- Once a day (1/1)</option>
            <option value="BD">BD- Twice a day (2/1)</option>
            <option value="Q12H">Q12h - Every Hours</option>
            <option value="TDS">TDS- Three times a day</option>
            <option value="QID">QID- Four times a day</option>
            <option value="PRN">PRN- Per Nurse requirement</option>
            <option value="QW">QW- once weekly</option>
            <option value="once every 3 months">once every 3 months</option>
            <option value="once every 2 months">once every 2 months</option>
          </select>
          <p v-if="form.frequency_unit" class="mt-1 text-xs text-neutral-400">
            Frequency &amp; Time Per are set from this unit — quantity is calculated from it
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Dosage / Strength <span class="text-red-500">*</span></label>
            <select
              v-if="selectedDrugUnits.length > 0"
              :value="form.dose"
              class="field-input"
              @change="patchForm({ dose: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">--Select Dosage--</option>
              <option v-for="u in selectedDrugUnits" :key="u" :value="u">{{ u }}</option>
            </select>
            <input
              v-else
              :value="form.dose"
              type="text"
              class="field-input"
              placeholder="e.g. 500 mg, 10 mg/5 mL"
              @input="patchForm({ dose: ($event.target as HTMLInputElement).value })"
            />
            <p class="mt-1 text-xs text-neutral-400">Concentration or strength of the drug</p>
          </div>

          <div>
            <label class="field-label">Quantity per Dose <span class="text-red-500">*</span></label>
            <div
              class="flex overflow-hidden rounded border border-neutral-300 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400 dark:border-neutral-600"
            >
              <input
                :value="form.item_per_dose"
                type="number"
                min="0.1"
                step="any"
                class="theme-field w-24 border-0 px-3 py-2 text-sm text-neutral-900 focus:outline-none dark:text-white"
                placeholder="e.g. 2"
                @input="patchForm({ item_per_dose: Number(($event.target as HTMLInputElement).value) || 0 })"
              />
              <div class="w-px flex-shrink-0 bg-neutral-200 dark:bg-neutral-600" />
              <select
                :value="form.formulation"
                class="flex-1 cursor-pointer border-0 bg-neutral-50 px-2 py-2 text-sm text-neutral-700 focus:outline-none dark:bg-neutral-800 dark:text-neutral-200"
                @change="patchForm({ formulation: ($event.target as HTMLSelectElement).value })"
              >
                <option value="">-- Unit --</option>
                <optgroup label="Solid / Oral">
                  <option value="Tablets">Tablets</option>
                  <option value="Capsules">Capsules</option>
                  <option value="Sachets">Sachets</option>
                  <option value="Lozenges">Lozenges</option>
                  <option value="Suppositories">Suppositories</option>
                </optgroup>
                <optgroup label="Liquid / Volume">
                  <option value="mL">mL (Syrup / Solution)</option>
                  <option value="Drops">Drops</option>
                  <option value="Bottles">Bottles</option>
                </optgroup>
                <optgroup label="Injectable">
                  <option value="Ampoules">Ampoules</option>
                  <option value="Vials">Vials</option>
                  <option value="Units">Units (e.g. Insulin)</option>
                </optgroup>
                <optgroup label="Topical / Inhaled">
                  <option value="Puffs">Puffs (Inhaler)</option>
                  <option value="Tubes">Tubes</option>
                  <option value="Patches">Patches</option>
                  <option value="g">g (Cream / Ointment)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="mg">mg</option>
                  <option value="IU">IU</option>
                  <option value="Other">Other</option>
                </optgroup>
              </select>
            </div>
            <p class="mt-1 text-xs text-neutral-400">
              e.g. <strong>2 Tablets</strong>, <strong>10 mL</strong>, <strong>1 Ampoule</strong> per administration
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Frequency <span class="text-red-500">*</span></label>
            <input
              :value="form.frequency"
              type="number"
              min="1"
              class="field-input"
              placeholder="e.g. 3"
              :readonly="!!form.frequency_unit"
              :class="form.frequency_unit ? 'cursor-not-allowed bg-neutral-100 opacity-60 dark:bg-neutral-800' : ''"
              @input="patchForm({ frequency: ($event.target as HTMLInputElement).value })"
            />
            <p class="mt-1 text-xs text-neutral-400">
              {{ form.frequency_unit ? 'Set by the Frequency Unit' : 'Times per period (auto-set from unit)' }}
            </p>
          </div>
          <div>
            <label class="field-label">Time Per (Time Unit) <span class="text-red-500">*</span></label>
            <select
              :value="form.time_per"
              class="field-input"
              :disabled="!!form.frequency_unit"
              :class="form.frequency_unit ? 'cursor-not-allowed bg-neutral-100 opacity-60 dark:bg-neutral-800' : ''"
              @change="patchForm({ time_per: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">--Select--</option>
              <option value="Day">Day</option>
              <option value="Month">Month</option>
              <option value="Hour">Hour</option>
              <option value="Quarterly">Quarterly</option>
              <option value="five times in a day (5/1)">five times in a day (5/1)</option>
              <option value="every 4 hours (6/1)">every 4 hours (6/1)</option>
              <option value="every 3 hours (8/1)">every 3 hours (8/1)</option>
              <option value="every 2 hours (12/1)">every 2 hours (12/1)</option>
              <option value="every other day (1/2)">every other day (1/2)</option>
              <option value="2 times every week (2/7)">2 times every week (2/7)</option>
              <option value="3 times every week (3/7)">3 times every week (3/7)</option>
              <option value="4 times each week (4/7)">4 times each week (4/7)</option>
              <option value="5 times each week (5/7)">5 times each week (5/7)</option>
              <option value="6 times each week (6/7)">6 times each week (6/7)</option>
              <option value="twice every month (2/30)">twice every month (2/30)</option>
              <option value="other variable frequency (custom)">other variable frequency (custom)</option>
              <option value="Once every week">Once every week</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="field-label">Duration <span class="text-red-500">*</span></label>
            <input
              :value="form.duration"
              type="number"
              min="1"
              class="field-input"
              placeholder="e.g. 7"
              @input="patchForm({ duration: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div>
            <label class="field-label">Duration Unit</label>
            <select
              :value="form.duration_unit"
              class="field-input"
              @change="patchForm({ duration_unit: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">--Select--</option>
              <option>Days</option>
              <option>Weeks</option>
              <option>Months</option>
              <option>Years</option>
              <option>Indefinite</option>
            </select>
          </div>
          <div>
            <label class="field-label">Route <span class="text-red-500">*</span></label>
            <select
              :value="form.route"
              class="field-input"
              @change="patchForm({ route: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">--Select--</option>
              <option value="Not Found">Not Found</option>
              <option value="Oral">Per-Oral (PO)</option>
              <option value="Sublingual">Sublingual (SL)</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="IV">Intravascular (IV)</option>
              <option value="SC">Subcutaneous (SQ)</option>
              <option value="Topical">Topical</option>
              <option value="Rectal">Rectal</option>
              <option value="Ophthalmic">Eye</option>
              <option value="Otic">Ear</option>
              <option value="Nasal">Nose</option>
              <option value="Inhalation">Inhalational</option>
              <option value="Transdermal">Transdermal</option>
              <option value="Intradermal">Interdermal</option>
              <option value="Other">Other</option>
              <option value="Vaginal">Vaginal</option>
              <option value="Intrathecal">Intrathecal</option>
              <option value="PRN">PRN</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="field-label">Start Date <span class="text-red-500">*</span></label>
            <input
              :value="form.start_date"
              type="date"
              class="field-input"
              @input="patchForm({ start_date: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div>
            <label class="field-label">End Date <span class="text-red-500">*</span></label>
            <input
              :value="form.end_date"
              type="date"
              class="field-input"
              @input="patchForm({ end_date: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div>
            <label class="field-label flex items-center justify-between">
              <span>
                Quantity
                <span
                  v-if="form.formulation"
                  class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700"
                >
                  {{ form.formulation }}
                </span>
              </span>
              <button
                type="button"
                title="Recalculate from formula"
                class="flex items-center gap-1 text-[10px] font-normal text-neutral-400 transition hover:text-blue-600"
                @click="emit('computeQuantity')"
              >
                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Recalc
              </button>
            </label>
            <input
              :value="form.quantity_prescribed"
              type="number"
              min="1"
              class="field-input"
              placeholder="—"
              @input="patchForm({ quantity_prescribed: ($event.target as HTMLInputElement).value })"
            />
            <p class="mt-1 text-xs leading-tight text-neutral-400">{{ quantityFormulaHint }}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="field-label">Is Passer By</label>
            <select
              :value="form.is_passer_by"
              class="field-input"
              @change="patchForm({ is_passer_by: ($event.target as HTMLSelectElement).value })"
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </select>
          </div>
        </div>

        <div>
          <label class="field-label">Comments</label>
          <textarea
            :value="form.instructions"
            rows="3"
            class="field-input"
            placeholder="Enter Comments"
            @input="patchForm({ instructions: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>

        <p v-if="showError" class="text-xs font-medium text-red-500">{{ errorMsg }}</p>
      </div>

      <div
        class="flex flex-shrink-0 justify-end gap-3 border-t border-neutral-200 px-6 py-4"
      >
        <button type="button" class="btn-secondary px-4 py-2 text-xs" @click="emit('close')">Close</button>
        <ActionButton type="button" class="!px-4 !py-2 text-xs" @click="emit('addToCart')">
          <svg class="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add to Cart
        </ActionButton>
      </div>
    </div>
  </div>
  </Teleport>
</template>
