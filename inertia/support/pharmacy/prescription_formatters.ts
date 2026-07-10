export function formatRxFrequency(item: {
  frequency?: string | number | null
  frequency_unit?: string | null
  time_per?: string | null
}) {
  if (item.frequency_unit) {
    return item.time_per ? `${item.frequency_unit} · ${item.time_per}` : item.frequency_unit
  }
  if (item.frequency) {
    return item.time_per ? `${item.frequency} · ${item.time_per}` : String(item.frequency)
  }
  return '—'
}

export function formatRxDuration(item: {
  duration?: string | number | null
  duration_unit?: string | null
}) {
  if (!item.duration) return '—'
  return item.duration_unit ? `${item.duration} ${item.duration_unit}` : String(item.duration)
}

export function formatRxDose(item: {
  dose?: string | null
  item_per_dose?: number | null
  formulation?: string | null
  strength?: string | null
}) {
  const parts: string[] = []
  if (item.item_per_dose && item.formulation) {
    parts.push(`${item.item_per_dose} ${item.formulation}`)
  }
  if (item.dose) parts.push(item.dose)
  if (item.strength) parts.push(item.strength)
  return parts.length ? parts.join(' · ') : '—'
}

export function formatPatientAge(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age >= 0 ? `${age} yrs` : null
}

export function formatDateLabel(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
