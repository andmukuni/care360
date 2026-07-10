<script setup lang="ts">
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
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">My Profile</h1></template>

    <ProfileView
      :user="props.user"
      :stats="props.stats"
      :timeline="props.timeline"
      :recent-encounters="props.recentEncounters"
      :recent-prescriptions="props.recentPrescriptions"
      :recent-lab-results="props.recentLabResults"
      :recent-dispenses="props.recentDispenses"
      edit-href="/profile/edit"
    />
  </StaffLayout>
</template>
