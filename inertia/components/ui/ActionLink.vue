<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Spinner from '~/components/ui/Spinner.vue'
import { useNavigationLoading } from '~/composables/useNavigationLoading'

const props = withDefaults(
  defineProps<{
    href: string
    variant?: 'primary' | 'secondary'
    class?: string
  }>(),
  {
    variant: 'secondary',
  }
)

const { isNavigatingTo, markPending } = useNavigationLoading()
const loading = computed(() => isNavigatingTo(props.href))

const variantClass = computed(() => (props.variant === 'primary' ? 'btn-primary' : 'btn-secondary'))
</script>

<template>
  <Link
    :href="href"
    :class="[variantClass, 'inline-flex items-center justify-center gap-2', props.class]"
    :aria-busy="loading"
    @click="markPending(href)"
  >
    <Spinner v-if="loading" size="sm" />
    <slot v-else name="icon" />
    <slot />
  </Link>
</template>
