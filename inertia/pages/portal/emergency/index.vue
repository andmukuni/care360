<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface Service {
  id: number
  name: string
  description: string | null
  instructions: string | null
  phone_number: string
  secondary_phone: string | null
  is247: boolean
  category_label: string
}

defineProps<{
  services: Service[]
}>()

function call(service: Service) {
  router.post(`/portal/emergency/${service.id}/call`)
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-2">Emergency services</h1>
    <p class="text-sm text-neutral-500 mb-6">Tap a service to call immediately. For life-threatening emergencies, use the hospital emergency line first.</p>

    <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
      <p class="text-sm font-semibold text-red-800">If someone is unconscious, not breathing, or bleeding heavily — call now.</p>
      <p class="text-xs text-red-700/80 mt-1">Stay calm, share your location, and keep the line open.</p>
    </div>

    <div class="space-y-3">
      <div v-for="service in services" :key="service.id" class="theme-surface rounded-xl overflow-hidden">
        <div class="px-4 py-3 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{{ service.category_label }}</p>
            <p class="text-base font-bold">{{ service.name }}</p>
            <p class="text-sm text-neutral-500 mt-1">{{ service.description }}</p>
            <p v-if="service.instructions" class="text-xs text-neutral-400 mt-2">{{ service.instructions }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span class="font-semibold text-red-700">{{ service.phone_number }}</span>
              <span v-if="service.secondary_phone">· Alt {{ service.secondary_phone }}</span>
              <span v-if="service.is247" class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">24/7</span>
            </div>
          </div>
          <button type="button" @click="call(service)"
                  class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">
            Call
          </button>
        </div>
      </div>
      <div v-if="!services.length" class="theme-surface rounded-xl px-4 py-8 text-center">
        <p class="text-sm font-semibold">No emergency numbers configured</p>
        <p class="text-xs text-neutral-500 mt-1">Please contact the hospital reception.</p>
      </div>
    </div>
  </PortalLayout>
</template>
