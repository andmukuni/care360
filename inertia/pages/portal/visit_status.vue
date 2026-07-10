<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  visitPayload: Record<string, any>
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toneClasses(tone: string | undefined): string {
  if (tone === 'action') return 'bg-amber-50 border-amber-200'
  if (tone === 'waiting') return 'bg-blue-50 border-blue-200'
  return 'bg-teal-50 border-teal-200'
}

// Auto-refresh while a visit is active
let timer: ReturnType<typeof setInterval> | undefined
const pollSeconds = ref(Number(props.visitPayload.poll_interval_seconds ?? 15))
onMounted(() => {
  if (props.visitPayload.has_active_visit) {
    timer = setInterval(() => {
      router.reload({ only: ['visitPayload'] })
    }, pollSeconds.value * 1000)
  }
})
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Visit status</h1>
      <p class="text-sm text-neutral-500 mt-1">Live update for your current hospital visit</p>
    </div>

    <template v-if="visitPayload.has_active_visit">
      <div v-if="visitPayload.guidance" class="mb-4 p-4 rounded-xl border" :class="toneClasses(visitPayload.guidance.tone)">
        <p class="text-base font-bold text-neutral-900">{{ visitPayload.guidance.title }}</p>
        <p class="text-sm text-neutral-600 mt-1">{{ visitPayload.guidance.message }}</p>
        <p v-if="visitPayload.queue_position" class="text-sm font-semibold mt-2 text-neutral-800">
          Queue position #{{ visitPayload.queue_position }}
        </p>
      </div>

      <div class="mb-4 theme-surface rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-neutral-100">
          <h2 class="text-sm font-bold text-neutral-900">Active visit</h2>
        </div>
        <div class="px-4 py-4 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ visitPayload.encounter?.encounterNumber ?? 'Current visit' }}</p>
              <p class="text-xs text-neutral-500 mt-0.5">Started {{ fmtDateTime(visitPayload.encounter?.startedAt) }}</p>
            </div>
            <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              {{ visitPayload.status_label ?? 'In progress' }}
            </span>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-lg bg-neutral-50 p-3">
              <dt class="text-xs text-neutral-500 uppercase font-semibold">Stage</dt>
              <dd class="font-semibold mt-1">{{ visitPayload.stage_label ?? '—' }}</dd>
            </div>
            <div class="rounded-lg bg-neutral-50 p-3">
              <dt class="text-xs text-neutral-500 uppercase font-semibold">Status</dt>
              <dd class="font-semibold mt-1">{{ visitPayload.status_label ?? '—' }}</dd>
            </div>
            <div v-if="visitPayload.queue_position" class="col-span-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <dt class="text-xs text-amber-700 uppercase font-semibold">Queue position</dt>
              <dd class="font-bold text-lg mt-1 text-amber-900">#{{ visitPayload.queue_position }}</dd>
            </div>
          </dl>

          <Link v-if="visitPayload.encounter" :href="`/portal/visits/${visitPayload.encounter.id}`"
                class="inline-block text-sm font-semibold text-neutral-700 underline">
            View visit details
          </Link>
        </div>
      </div>

      <p class="text-xs text-neutral-400 text-center">
        Updates automatically every {{ visitPayload.poll_interval_seconds ?? 15 }} seconds while your visit is active.
      </p>
    </template>

    <template v-else>
      <div class="theme-surface rounded-xl p-8 text-center">
        <p class="text-base font-semibold text-neutral-900">No active visit</p>
        <p class="text-sm text-neutral-500 mt-1">You are not currently in an open visit at the hospital.</p>
        <Link href="/portal/appointments/create"
              class="inline-block mt-4 px-4 py-2 text-sm font-semibold bg-neutral-900 text-white rounded-lg">
          Request appointment
        </Link>
      </div>
    </template>
  </PortalLayout>
</template>
