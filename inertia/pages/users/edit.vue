<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import EditForm from '~/components/staff/users/EditForm.vue'

const props = defineProps<{ user: any }>()
</script>

<template>
  <StaffLayout>
    <template #header>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-sand-11">Staff Management</p>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">Edit {{ props.user.name }}</h1>
          <p class="mt-0.5 text-sm text-sand-11">Update profile details, credentials, and patient portal visibility.</p>
        </div>
        <div class="flex items-center gap-2">
          <Link href="/users" class="theme-icon-btn rounded px-3 py-1.5 text-sm">All staff</Link>
          <Link :href="`/users/${props.user.id}`" class="theme-icon-btn rounded px-3 py-1.5 text-sm">View profile</Link>
        </div>
      </div>
    </template>

    <EditForm
      :user="props.user"
      :action="`/users/${props.user.id}`"
      :show-portal-toggle="true"
      :signature-invite-endpoint="`/users/${props.user.id}/signature-invite`"
    >
      <template #cancel>
        <Link :href="`/users/${props.user.id}`" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </template>
    </EditForm>
  </StaffLayout>
</template>
