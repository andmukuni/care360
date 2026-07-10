<script setup lang="ts">
interface ProfileUser {
  id: number
  name: string
  raw_name: string
  title: string | null
  specialty: string | null
  bio: string | null
  email: string
  is_portal_bookable: boolean
  profile_photo_url: string | null
  roles: string[]
}

interface Stats {
  encountersStarted: number
  encountersClosed: number
  prescriptions: number
  dispenses: number
  labRecorded: number
  labVerified: number
  calendarEvents: number
}

interface TimelineItem {
  type: string
  label: string
  sub: string
  ref: string
  date: string | null
  icon: string
  color: string
}

const props = defineProps<{
  user: ProfileUser
  stats: Stats
  timeline: TimelineItem[]
}>()

const statCards = [
  { key: 'encountersStarted', label: 'Encounters Started' },
  { key: 'encountersClosed', label: 'Encounters Closed' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'dispenses', label: 'Dispenses' },
  { key: 'labRecorded', label: 'Lab Recorded' },
  { key: 'labVerified', label: 'Lab Verified' },
  { key: 'calendarEvents', label: 'Calendar Events' },
] as const

const colorClass: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  rose: 'bg-rose-100 text-rose-700',
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <div class="theme-panel flex items-center gap-4 rounded-lg p-6">
      <div
        class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand-3 text-xl font-semibold text-sand-11"
      >
        <img v-if="props.user.profile_photo_url" :src="props.user.profile_photo_url" alt="" class="h-full w-full object-cover" />
        <span v-else>{{ props.user.raw_name.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">{{ props.user.name }}</h2>
        <p class="text-sm text-sand-11">{{ props.user.specialty ?? props.user.email }}</p>
        <div class="mt-1 flex flex-wrap gap-1">
          <span
            v-for="r in props.user.roles"
            :key="r"
            class="rounded bg-sand-3 px-1.5 py-0.5 text-xs"
          >
            {{ r }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="props.user.bio" class="theme-panel rounded-lg p-6">
      <h3 class="mb-2 text-sm font-medium text-sand-11">About</h3>
      <p class="whitespace-pre-line text-sm">{{ props.user.bio }}</p>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <div v-for="card in statCards" :key="card.key" class="theme-panel rounded-lg p-4 text-center">
        <div class="text-2xl font-semibold">{{ props.stats[card.key] }}</div>
        <div class="mt-1 text-xs text-sand-11">{{ card.label }}</div>
      </div>
    </div>

    <div class="theme-panel rounded-lg p-6">
      <h3 class="mb-4 text-sm font-medium text-sand-11">Activity Timeline</h3>
      <p v-if="!props.timeline.length" class="text-sm text-sand-11">No recent activity.</p>
      <ul v-else class="space-y-3">
        <li v-for="(item, i) in props.timeline" :key="i" class="flex items-start gap-3">
          <span
            class="mt-0.5 rounded px-2 py-0.5 text-xs"
            :class="colorClass[item.color] ?? 'bg-sand-3 text-sand-11'"
          >
            {{ item.type }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm">
              <span class="font-medium">{{ item.label }}</span>
              — {{ item.sub }}
              <span class="text-sand-11">({{ item.ref }})</span>
            </div>
            <div class="text-xs text-sand-11">{{ formatDate(item.date) }}</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
