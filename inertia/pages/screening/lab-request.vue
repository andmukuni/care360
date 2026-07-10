<script setup lang="ts">
import { onMounted } from 'vue'
import { router } from '@inertiajs/vue3'

const props = defineProps<{
  encounter: { id: number }
}>()

onMounted(() => {
  router.visit(`/screening/${props.encounter.id}?tab=lab`, { replace: true })
})
</script>

<template>
  <div class="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
    Redirecting to lab request…
  </div>
</template>
