<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  patientId: string
  gender: string | null
  dateOfBirth: string | null
  nrcNumber: string | null
  phoneNumber: string | null
}>()

type MetaItem = {
  key: string
  label: string
  value: string
  mono?: boolean
}

function formatDob(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatGender(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'male' || normalized === 'm') return 'Male'
  if (normalized === 'female' || normalized === 'f') return 'Female'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const items = computed<MetaItem[]>(() => {
  const rows: MetaItem[] = [
    { key: 'id', label: 'ID', value: props.patientId, mono: true },
  ]

  const gender = formatGender(props.gender)
  if (gender) rows.push({ key: 'sex', label: 'Sex', value: gender })

  const dob = formatDob(props.dateOfBirth)
  if (dob) rows.push({ key: 'dob', label: 'DOB', value: dob })

  if (props.nrcNumber?.trim()) {
    rows.push({ key: 'nrc', label: 'NRC', value: props.nrcNumber.trim(), mono: true })
  }

  if (props.phoneNumber?.trim()) {
    rows.push({ key: 'phone', label: 'Phone', value: props.phoneNumber.trim(), mono: true })
  }

  return rows
})
</script>

<template>
  <div class="patient-meta-chips">
    <span
      v-for="item in items"
      :key="item.key"
      class="patient-meta-chip"
      :title="`${item.label}: ${item.value}`"
    >
      <span class="patient-meta-chip__label">{{ item.label }}</span>
      <span
        class="patient-meta-chip__value"
        :class="{ 'patient-meta-chip__value--mono': item.mono }"
      >
        {{ item.value }}
      </span>
    </span>
  </div>
</template>
