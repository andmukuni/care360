<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import ThemeToggle from '~/components/ui/ThemeToggle.vue'

const LOGIN_HERO = '/images/auth/login-hero.webp'
const LOGIN_HERO_SM = '/images/auth/login-hero-sm.webp'

const props = withDefaults(
  defineProps<{
    brandTitle: string
    brandTagline: string
    wide?: boolean
    backgroundImage?: string
  }>(),
  {
    wide: false,
    backgroundImage: LOGIN_HERO,
  }
)

const usesDefaultHero = props.backgroundImage === LOGIN_HERO
const mobileHero = usesDefaultHero ? LOGIN_HERO_SM : props.backgroundImage
</script>

<template>
  <div class="auth-layout min-h-screen lg:flex">
    <Head>
      <link
        v-if="usesDefaultHero"
        rel="preload"
        as="image"
        type="image/webp"
        :href="LOGIN_HERO"
        media="(min-width: 1024px)"
      />
      <link
        v-if="usesDefaultHero"
        rel="preload"
        as="image"
        type="image/webp"
        :href="LOGIN_HERO_SM"
        media="(max-width: 1023px)"
      />
      <link v-else rel="preload" as="image" :href="props.backgroundImage" />
    </Head>

    <!-- Brand panel (desktop) -->
    <aside class="relative hidden min-h-screen overflow-hidden lg:flex lg:w-1/2">
      <div class="absolute inset-0 bg-slate-950" aria-hidden="true" />
      <div
        class="absolute inset-0 opacity-30"
        :style="{
          backgroundImage: `url(${props.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }"
        aria-hidden="true"
      />
      <div class="absolute inset-0 bg-slate-950/50" aria-hidden="true" />
      <div class="relative flex w-full flex-col items-center justify-center p-10 xl:p-12">
        <div class="text-center">
          <h1 class="font-sans text-3xl font-bold tracking-tight text-white xl:text-4xl">{{ brandTitle }}</h1>
          <p class="mt-2 text-sm font-medium uppercase tracking-widest text-white/75">
            {{ brandTagline }}
          </p>
        </div>
      </div>
    </aside>

    <!-- Form panel -->
    <main
      class="auth-layout__form-panel relative flex min-h-screen flex-1 flex-col justify-center bg-[#fafaf9] px-6 py-10 dark:bg-neutral-950 sm:px-8 lg:w-1/2 lg:px-12 xl:px-16"
    >
      <div class="absolute right-4 top-4 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>
      <!-- Brand panel (mobile) -->
      <div class="relative mb-10 overflow-hidden rounded-2xl lg:hidden">
        <div class="absolute inset-0 bg-slate-950" aria-hidden="true" />
        <div
          class="absolute inset-0 opacity-30"
          :style="{
            backgroundImage: `url(${mobileHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }"
          aria-hidden="true"
        />
        <div class="absolute inset-0 bg-slate-950/50" aria-hidden="true" />
        <div class="relative flex flex-col items-center justify-center p-6">
          <div class="text-center">
            <h1 class="font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">{{ brandTitle }}</h1>
            <p class="mt-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-white/75">
              {{ brandTagline }}
            </p>
          </div>
        </div>
      </div>

      <div :class="['mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-sm']">
        <slot />
      </div>
    </main>
  </div>
</template>
