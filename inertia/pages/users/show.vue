<script setup lang="ts">
import { ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ProfileView from '~/components/staff/users/ProfileView.vue'

const props = defineProps<{
  user: any
  stats: any
  timeline: {
    items: any[]
    total: number
    per_page: number
    current_page: number
    last_page: number
    from: number
    to: number
  }
  recentEncounters?: any[]
  recentPrescriptions?: any[]
  recentLabResults?: any[]
  recentDispenses?: any[]
}>()

const showDeleteModal = ref(false)

function confirmDelete() {
  router.delete(`/users/${props.user.id}`)
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <Link href="/users" class="hover:text-neutral-700 transition">Users</Link>
      <span class="mx-2">/</span>
      <span class="text-neutral-700 dark:text-neutral-200 font-medium">{{ props.user.name }}</span>
    </template>

    <ProfileView
      :user="props.user"
      :stats="props.stats"
      :timeline="props.timeline"
      :recent-encounters="props.recentEncounters"
      :recent-prescriptions="props.recentPrescriptions"
      :recent-lab-results="props.recentLabResults"
      :recent-dispenses="props.recentDispenses"
      :edit-href="`/users/${props.user.id}/edit`"
      back-href="/users"
      :can-delete="!props.user.is_self"
      @delete="showDeleteModal = true"
    />

    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
    >
      <div class="absolute inset-0 bg-black/40" @click="showDeleteModal = false" />
      <div class="relative z-10 w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <h3 id="delete-user-title" class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Delete User Account
        </h3>
        <p class="mt-2 text-sm text-neutral-500">
          You are about to permanently delete
          <strong class="text-neutral-700 dark:text-neutral-200">{{ props.user.name }}</strong>.
          This action cannot be undone.
        </p>
        <div class="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
            @click="showDeleteModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            @click="confirmDelete"
          >
            Yes, Delete Account
          </button>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
