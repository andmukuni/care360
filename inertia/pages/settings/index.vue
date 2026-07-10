<script setup lang="ts">
import { reactive, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface Field {
  label: string
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'file'
  placeholder?: string
  options?: Record<string, string>
  accept?: string
  value: string
  previewUrl?: string | null
}

interface Group {
  label: string
  icon: string
  fields: Record<string, Field>
}

const props = defineProps<{
  groups: Record<string, Group>
}>()

const groupKeys = Object.keys(props.groups)
const activeTab = ref(groupKeys[0] ?? '')

const formState = reactive<Record<string, Record<string, string>>>({})
for (const [group, meta] of Object.entries(props.groups)) {
  formState[group] = {}
  for (const [key, field] of Object.entries(meta.fields)) {
    if (field.type === 'file') continue
    formState[group][key] = field.value
  }
}

const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(props.groups.clinic?.fields?.logo?.previewUrl ?? null)
const removeLogo = ref(false)
const saving = ref(false)

function onLogoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  logoFile.value = file
  removeLogo.value = false
  if (file) {
    logoPreview.value = URL.createObjectURL(file)
  }
}

function clearLogo() {
  logoFile.value = null
  removeLogo.value = true
  logoPreview.value = '/images/app-icon.png'
}

function save(group: string) {
  saving.value = true

  if (group === 'clinic') {
    const data: Record<string, any> = { ...formState[group] }
    if (logoFile.value) {
      data.logo = logoFile.value
    }
    if (removeLogo.value) {
      data.remove_logo = true
    }

    router.post(`/settings/${group}`, data, {
      forceFormData: true,
      preserveScroll: true,
      onFinish: () => {
        saving.value = false
        logoFile.value = null
        removeLogo.value = false
      },
    })
    return
  }

  router.post(`/settings/${group}`, { ...formState[group] }, {
    preserveScroll: true,
    onFinish: () => {
      saving.value = false
    },
  })
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">System Settings</h1></template>

    <div class="flex flex-wrap gap-1 border-b border-sand-6">
      <button
        v-for="key in groupKeys"
        :key="key"
        type="button"
        class="rounded-t px-4 py-2 text-sm"
        :class="activeTab === key ? 'border-b-2 border-blue-600 font-medium text-blue-700' : 'text-sand-11'"
        @click="activeTab = key"
      >
        {{ props.groups[key].label }}
      </button>
    </div>

    <div v-for="key in groupKeys" v-show="activeTab === key" :key="key" class="mt-6">
      <form class="theme-panel max-w-2xl space-y-4 rounded-lg p-6" @submit.prevent="save(key)">
        <div v-for="(field, fieldKey) in props.groups[key].fields" :key="fieldKey">
          <label class="block text-sm font-medium mb-1">{{ field.label }}</label>

          <div v-if="field.type === 'file'" class="space-y-3">
            <div
              class="flex items-center gap-4"
              :class="formState.clinic?.hide_logo === 'yes' ? 'opacity-40' : ''"
            >
              <img
                :src="logoPreview || field.previewUrl || '/images/app-icon.png'"
                alt="Facility logo preview"
                class="h-16 w-16 rounded-lg border border-sand-6 object-contain bg-sand-2"
              />
              <div class="flex flex-wrap gap-2">
                <label
                  class="cursor-pointer theme-panel rounded px-3 py-2 text-sm hover:bg-sand-2"
                  :class="formState.clinic?.hide_logo === 'yes' ? 'pointer-events-none' : ''"
                >
                  Choose image
                  <input
                    type="file"
                    class="hidden"
                    :disabled="formState.clinic?.hide_logo === 'yes'"
                    :accept="field.accept || 'image/png,image/jpeg,image/webp'"
                    @change="onLogoChange"
                  />
                </label>
                <button
                  type="button"
                  class="rounded border border-sand-6 px-3 py-2 text-sm text-sand-11 hover:bg-sand-2 disabled:opacity-50"
                  :disabled="formState.clinic?.hide_logo === 'yes'"
                  @click="clearLogo"
                >
                  Use default
                </button>
              </div>
            </div>
            <p class="text-xs text-sand-11">
              <template v-if="formState.clinic?.hide_logo === 'yes'">
                Logo is hidden system-wide. Set Hide Logo to “Show logo” to display it again.
              </template>
              <template v-else>
                PNG, JPG, or WebP up to 2 MB. Shown in the sidebar, logins, and printouts.
              </template>
            </p>
          </div>

          <select
            v-else-if="field.type === 'select'"
            v-model="formState[key][fieldKey]"
            class="theme-field w-full rounded px-3 py-2"
          >
            <option v-for="(optLabel, optValue) in field.options" :key="optValue" :value="optValue">
              {{ optLabel }}
            </option>
          </select>

          <textarea
            v-else-if="field.type === 'textarea'"
            v-model="formState[key][fieldKey]"
            rows="4"
            class="theme-field w-full rounded px-3 py-2"
            :placeholder="field.placeholder"
          ></textarea>

          <input
            v-else
            v-model="formState[key][fieldKey]"
            :type="field.type"
            class="theme-field w-full rounded px-3 py-2"
            :placeholder="field.placeholder"
          />
        </div>

        <div class="pt-2">
          <button type="submit" :disabled="saving" class="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
            Save {{ props.groups[key].label }}
          </button>
        </div>
      </form>
    </div>
  </StaffLayout>
</template>
