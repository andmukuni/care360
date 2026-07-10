<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    type?: 'stage' | 'status' | 'priority'
    value?: string | null
    withDot?: boolean
  }>(),
  {
    type: 'status',
    withDot: false,
  }
)

const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold'

const stageMap: Record<string, { label: string; palette: string; dot: string }> = {
  registration: {
    label: 'Registration',
    palette: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
  },
  triage: {
    label: 'Triage',
    palette: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  screening: {
    label: 'Screening',
    palette: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
  },
  lab: {
    label: 'Lab',
    palette: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500',
  },
  screening_review: {
    label: 'Screening Review',
    palette: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  pharmacy: {
    label: 'Pharmacy',
    palette: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  treatment_room: {
    label: 'Treatment Room',
    palette: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  completed: {
    label: 'Completed',
    palette: 'bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
    dot: 'bg-neutral-500',
  },
}

const statusMap: Record<string, { label: string; palette: string }> = {
  started: {
    label: 'Started',
    palette: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
  },
  queued: {
    label: 'Queued',
    palette: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  },
  in_progress: {
    label: 'In Progress',
    palette: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800',
  },
  completed: {
    label: 'Completed',
    palette: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    palette: 'bg-neutral-200 text-neutral-500 border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
  },
}

const priorityMap: Record<string, { label: string; palette: string }> = {
  normal: {
    label: 'Normal',
    palette: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
  },
  urgent: {
    label: 'Urgent',
    palette: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
  },
  emergency: {
    label: 'Emergency',
    palette: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800',
  },
  stat: {
    label: 'STAT',
    palette: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800',
  },
}

const fallback = {
  label: '—',
  palette: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
  dot: 'bg-neutral-400',
}

const key = computed(() =>
  String(props.value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
)

const resolved = computed(() => {
  if (props.type === 'stage') {
    return stageMap[key.value] ?? {
      label: props.value ? String(props.value).replace(/_/g, ' ') : fallback.label,
      palette: fallback.palette,
      dot: fallback.dot,
    }
  }
  if (props.type === 'status') {
    return statusMap[key.value] ?? {
      label: props.value ? String(props.value).replace(/_/g, ' ') : fallback.label,
      palette: fallback.palette,
      dot: fallback.dot,
    }
  }
  return priorityMap[key.value] ?? priorityMap.normal
})
</script>

<template>
  <span :class="[base, resolved.palette]">
    <span v-if="withDot && 'dot' in resolved" class="h-1.5 w-1.5 rounded-full" :class="resolved.dot" />
    {{ resolved.label }}
  </span>
</template>
