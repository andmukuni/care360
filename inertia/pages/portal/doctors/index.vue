<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface Doctor {
  id: number
  name: string
  headline: string | null
  photo_url: string | null
  rating: number | null
}

defineProps<{
  patient: Record<string, any>
  doctors: Doctor[]
}>()

function ratingText(rating: number | null): string {
  return (rating ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-neutral-900">Our doctors</h1>
      <p class="text-sm text-neutral-500 mt-1">Browse our clinical team and their specializations.</p>
    </div>

    <div v-if="doctors.length" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Link v-for="doctor in doctors" :key="doctor.id" :href="`/portal/doctors/${doctor.id}`"
            class="flex items-center gap-4 p-4 rounded-xl theme-surface hover:border-neutral-400 transition">
        <div class="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
          <img v-if="doctor.photo_url" :src="doctor.photo_url" :alt="doctor.name" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-base font-bold text-neutral-900 truncate">{{ doctor.name }}</p>
          <p v-if="doctor.headline" class="text-sm text-blue-600 mt-0.5">{{ doctor.headline }}</p>
          <div class="flex items-center gap-1 mt-1.5">
            <svg v-for="i in 5" :key="i" class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span class="text-xs text-neutral-500 ml-0.5">{{ ratingText(doctor.rating) }}</span>
          </div>
        </div>
      </Link>
    </div>
    <div v-else class="theme-surface rounded-xl p-10 text-center">
      <p class="text-sm font-semibold text-neutral-700">No doctors listed</p>
      <p class="text-xs text-neutral-500 mt-1">Our doctor directory will appear here soon.</p>
    </div>
  </PortalLayout>
</template>
