<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { computed } from 'vue'

const props = defineProps<{
  encounter: {
    id: number
    encounter_number: string
    current_stage: string
    stage_label: string
  }
}>()

const stageClass = computed(() => {
  const map: Record<string, string> = {
    registration: 'registration-active-encounter-badge--registration',
    triage: 'registration-active-encounter-badge--triage',
    screening: 'registration-active-encounter-badge--screening',
    lab: 'registration-active-encounter-badge--lab',
    screening_review: 'registration-active-encounter-badge--screening-review',
    pharmacy: 'registration-active-encounter-badge--pharmacy',
    treatment_room: 'registration-active-encounter-badge--treatment-room',
  }
  return map[props.encounter.current_stage] ?? 'registration-active-encounter-badge--default'
})
</script>

<template>
  <Link
    :href="`/encounters/${encounter.id}`"
    class="registration-active-encounter-badge"
    :class="stageClass"
    :title="`Open active visit ${encounter.encounter_number} at ${encounter.stage_label}`"
  >
    <span class="registration-active-encounter-badge__dot" aria-hidden="true" />
    <span class="registration-active-encounter-badge__label">Active visit</span>
    <span class="registration-active-encounter-badge__stage">{{ encounter.stage_label }}</span>
    <span class="registration-active-encounter-badge__number">{{ encounter.encounter_number }}</span>
  </Link>
</template>
