<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ProfileView from '~/components/staff/users/ProfileView.vue'

const props = defineProps<{
  user: any
  stats: any
  timeline: any[]
}>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">My Profile</h1></template>

    <div class="mb-4 flex justify-end">
      <Link href="/profile/edit" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Edit Profile</Link>
    </div>

    <ProfileView :user="props.user" :stats="props.stats" :timeline="props.timeline" />
  </StaffLayout>
</template>
