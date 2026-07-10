<script setup lang="ts">
import { computed } from 'vue'
import {
  extractGcsPoints,
  gcsSeverityClass,
  gcsSeverityLabel,
  parseGcsAssessmentNotes,
} from '~/support/screening/gcs_assessment'

const props = defineProps<{
  value: string
}>()

const gcs = computed(() => parseGcsAssessmentNotes(props.value))

const components = computed(() => {
  if (!gcs.value) return []

  return [
    { key: 'eye', label: 'Eye', value: gcs.value.eye, points: extractGcsPoints(gcs.value.eye) },
    { key: 'verbal', label: 'Verbal', value: gcs.value.verbal, points: extractGcsPoints(gcs.value.verbal) },
    { key: 'motor', label: 'Motor', value: gcs.value.motor, points: extractGcsPoints(gcs.value.motor) },
  ]
})
</script>

<template>
  <div v-if="gcs" class="gcs-card">
    <div class="gcs-card__header">
      <div>
        <p class="gcs-card__title">Glasgow Coma Scale</p>
        <p class="gcs-card__subtitle">{{ gcsSeverityLabel(gcs.score) }} impairment</p>
      </div>
      <div class="gcs-card__score" :class="gcsSeverityClass(gcs.score)">
        <span class="gcs-card__score-val">{{ gcs.score }}</span>
        <span class="gcs-card__score-max">/ 15</span>
      </div>
    </div>

    <div class="gcs-card__grid">
      <div v-for="item in components" :key="item.key" class="gcs-card__item">
        <div class="gcs-card__item-head">
          <span class="gcs-card__item-label">{{ item.label }}</span>
          <span v-if="item.points" class="gcs-card__item-points">{{ item.points }} pts</span>
        </div>
        <p class="gcs-card__item-value">{{ item.value.replace(/\s*\(\d+\s*points?\)/i, '').trim() }}</p>
      </div>
    </div>

    <div v-if="gcs.result" class="gcs-card__result">
      <p class="gcs-card__result-label">Clinical Result</p>
      <p class="gcs-card__result-value">{{ gcs.result }}</p>
    </div>
  </div>
</template>
