<script setup lang="ts">
import { provide, ref } from 'vue'
import StaffNavbar from '~/components/staff/StaffNavbar.vue'
import StaffSidebar from '~/components/staff/StaffSidebar.vue'
import { STAFF_MAIN_SCROLL_KEY } from '~/composables/useOffscreenVisibility'

defineProps<{
  breadcrumbs?: boolean
}>()

const sidebarOpen = ref(false)
const mainScrollEl = ref<HTMLElement | null>(null)

provide(STAFF_MAIN_SCROLL_KEY, mainScrollEl)

function closeSidebar() {
  sidebarOpen.value = false
}

function openSidebar() {
  sidebarOpen.value = true
}
</script>

<template>
  <div class="staff-shell flex h-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 antialiased">
    <StaffSidebar :open="sidebarOpen" @close="closeSidebar" />

    <div id="mainPanel" class="flex flex-col flex-1 overflow-hidden relative">
      <StaffNavbar @open-sidebar="openSidebar">
        <template v-if="breadcrumbs" #breadcrumbs>
          <slot name="breadcrumbs" />
        </template>
      </StaffNavbar>

      <div
        v-if="$slots['navbar-extras']"
        class="navbar-extras-anchor relative z-[998] flex w-full shrink-0 justify-center pointer-events-none"
      >
        <slot name="navbar-extras" />
      </div>

      <main ref="mainScrollEl" class="relative flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
        <slot name="header" />
        <slot />
      </main>
    </div>

    <div
      class="fixed inset-0 bg-black/50 z-20 lg:hidden"
      :class="sidebarOpen ? '' : 'hidden'"
      @click="closeSidebar"
    />
  </div>
</template>
