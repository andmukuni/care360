<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

defineProps<{
  meta: { current_page: number; last_page: number }
  previousHref?: string | null
  nextHref?: string | null
}>()
</script>

<template>
  <nav
    v-if="meta.last_page > 1"
    class="queue-pagination"
    aria-label="Queue pagination"
  >
    <Link
      v-if="previousHref"
      :href="previousHref"
      class="queue-pagination-btn"
      preserve-scroll
    >
      Previous
    </Link>
    <span class="queue-pagination-label">Page {{ meta.current_page }} of {{ meta.last_page }}</span>
    <Link
      v-if="nextHref"
      :href="nextHref"
      class="queue-pagination-btn"
      preserve-scroll
    >
      Next
    </Link>
  </nav>
</template>
