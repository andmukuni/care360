<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import EditForm from '~/components/staff/users/EditForm.vue'

const props = defineProps<{ user: any }>()
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Edit My Profile</h1></template>

    <EditForm :user="props.user" action="/profile" :show-portal-toggle="false">
      <template #cancel>
        <Link href="/profile" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </template>
    </EditForm>
  </StaffLayout>
</template>
