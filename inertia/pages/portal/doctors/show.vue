<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  doctor: Record<string, any>
}>()

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

function ratingText(rating: number | null): string {
  return (rating ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const hasStats = computed(
  () => Boolean(props.doctor.patients_count) || Boolean(props.doctor.years_experience) || props.doctor.rating != null
)

const bio = computed(
  () =>
    props.doctor.bio ||
    `This staff member is part of the ${clinicName.value} team. Hospital staff can add a bio in Staff Management to show more detail here.`
)
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <Link href="/portal/doctors" class="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900 mb-4">
        ← All doctors
      </Link>

      <div class="theme-surface rounded-2xl p-5 sm:p-6">
        <div class="flex gap-4 sm:gap-5">
          <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-neutral-100 flex-shrink-0">
            <img v-if="doctor.photo_url" :src="doctor.photo_url" :alt="doctor.name" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl sm:text-2xl font-bold text-neutral-900">{{ doctor.name }}</h1>
            <p v-if="doctor.headline" class="text-sm sm:text-base font-semibold text-blue-600 mt-1">{{ doctor.headline }}</p>
            <p v-if="doctor.session_fee" class="text-sm mt-2">
              <span class="font-bold text-blue-600">K{{ Number(doctor.session_fee).toFixed(0) }}</span>
              <span class="text-neutral-500"> per session</span>
            </p>
            <div class="flex flex-wrap gap-2 mt-4">
              <Link href="/portal/messages"
                    class="inline-flex flex-1 min-w-[120px] items-center justify-center px-4 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-semibold text-neutral-800 hover:opacity-90 transition">
                Message
              </Link>
              <Link :href="`/portal/appointments/create?reception=online&doctor=${doctor.id}`"
                    class="inline-flex flex-1 min-w-[120px] items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:opacity-90 transition">
                Video call
              </Link>
            </div>
          </div>
        </div>

        <div v-if="hasStats" class="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
          <div v-if="doctor.patients_count" class="rounded-xl bg-neutral-50 px-3 py-3 text-center">
            <p class="text-xs text-neutral-500">Patients</p>
            <p class="text-sm sm:text-base font-bold text-neutral-900 mt-1">{{ Number(doctor.patients_count).toLocaleString() }}+</p>
          </div>
          <div v-if="doctor.years_experience" class="rounded-xl bg-neutral-50 px-3 py-3 text-center">
            <p class="text-xs text-neutral-500">Experience</p>
            <p class="text-sm sm:text-base font-bold text-neutral-900 mt-1">
              {{ Number(doctor.years_experience) }} yr{{ Number(doctor.years_experience) === 1 ? '' : 's' }}+
            </p>
          </div>
          <div class="rounded-xl bg-neutral-50 px-3 py-3 text-center">
            <p class="text-xs text-neutral-500">Rating</p>
            <div class="flex items-center justify-center gap-1 mt-1">
              <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span class="text-sm sm:text-base font-bold text-neutral-900">{{ ratingText(doctor.rating) }}</span>
            </div>
            <p v-if="doctor.review_count" class="text-xs text-neutral-500 mt-1">{{ Number(doctor.review_count).toLocaleString() }}+ reviews</p>
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-neutral-100 space-y-4">
          <h2 class="text-sm font-bold text-neutral-900">Staff profile</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div v-if="doctor.title" class="rounded-xl bg-neutral-50 px-4 py-3">
              <dt class="text-xs text-neutral-500">Title</dt>
              <dd class="font-semibold text-neutral-900 mt-1">{{ doctor.title }}</dd>
            </div>
            <div v-if="doctor.specialty" class="rounded-xl bg-neutral-50 px-4 py-3">
              <dt class="text-xs text-neutral-500">Specialty</dt>
              <dd class="font-semibold text-neutral-900 mt-1">{{ doctor.specialty }}</dd>
            </div>
          </dl>
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">About</h3>
            <p class="text-sm text-neutral-600 leading-relaxed">{{ bio }}</p>
          </div>
        </div>

        <div class="mt-6">
          <Link :href="`/portal/appointments/create?doctor=${doctor.id}`"
                class="inline-flex w-full sm:w-auto items-center justify-center px-5 py-3 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:opacity-90 transition">
            Book appointment
          </Link>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
