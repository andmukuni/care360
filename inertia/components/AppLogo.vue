<script setup lang="ts">
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

defineProps<{
  size?: 'sm' | 'md' | 'lg'
  class?: string
}>()

const page = usePage()
const clinic = computed(() => (page.props as any).clinic as {
  name?: string
  logoUrl?: string | null
  hideLogo?: boolean
} | undefined)

const visible = computed(() => !clinic.value?.hideLogo && Boolean(clinic.value?.logoUrl))

const sizeClass: Record<string, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
}
</script>

<template>
  <img
    v-if="visible"
    :src="clinic!.logoUrl!"
    :alt="clinic?.name || 'Facility logo'"
    width="88"
    height="88"
    :class="[
      sizeClass[size ?? 'md'],
      'rounded-lg object-contain',
      $props.class,
    ]"
  />
</template>
