<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import ThemeToggle from '~/components/ui/ThemeToggle.vue'

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'Patient Portal'
)

const nav = [
  { label: 'Home', href: '/portal' },
  { label: 'Visits', href: '/portal/visits' },
  { label: 'Records', href: '/portal/records' },
  { label: 'Appointments', href: '/portal/appointments' },
  { label: 'Billing', href: '/portal/billing' },
  { label: 'Membership', href: '/portal/memberships' },
  { label: 'Documents', href: '/portal/documents' },
]
</script>

<template>
  <div class="portal-shell min-h-screen bg-sand-2 text-sand-12 dark:bg-neutral-950 dark:text-neutral-100">
    <header
      class="portal-shell__header flex h-14 items-center gap-4 border-b bg-white px-4 dark:bg-neutral-900"
    >
      <span class="truncate font-semibold text-neutral-900 dark:text-neutral-100">{{ clinicName }}</span>
      <nav class="flex flex-1 gap-3 overflow-x-auto text-sm text-neutral-600 dark:text-neutral-300">
        <Link
          v-for="item in nav"
          :key="item.href"
          :href="item.href"
          class="whitespace-nowrap transition hover:text-primary dark:hover:text-sky-300"
        >
          {{ item.label }}
        </Link>
      </nav>
      <ThemeToggle />
    </header>
    <main class="mx-auto max-w-4xl p-6">
      <slot />
    </main>
  </div>
</template>
