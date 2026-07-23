<script setup lang="ts">
import { computed } from 'vue'
import { Link, useForm, usePage } from '@inertiajs/vue3'
import AuthLayout from '~/layouts/AuthLayout.vue'

const props = defineProps<{
  token: string
  email: string
  isActivation?: boolean
}>()

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

const form = useForm({
  token: props.token,
  email: props.email,
  password: '',
  password_confirmation: '',
})

const fieldClass =
  'theme-field h-12 w-full rounded-lg px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-[#5A45FF33] dark:placeholder:text-neutral-500 dark:focus:ring-0'

function submit() {
  form.post('/portal/reset-password')
}
</script>

<template>
  <AuthLayout :brand-title="clinicName" brand-tagline="Patient Portal">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">
          {{ props.isActivation ? 'Activate your account' : 'Set a new password' }}
        </h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          {{ props.isActivation ? 'Choose a password to activate your patient portal account.' : 'Enter a new password for your account.' }}
        </p>
      </div>

      <form @submit.prevent="submit" class="space-y-5">
        <input v-model="form.token" type="hidden" name="token" />

        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">Email address</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            name="email"
            autocomplete="username"
            required
            :class="[fieldClass, form.errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : '']"
          />
          <p v-if="form.errors.email" class="text-sm text-red-600">{{ form.errors.email }}</p>
        </div>

        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">New password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="new-password"
            required
            :class="[fieldClass, form.errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : '']"
          />
          <p v-if="form.errors.password" class="text-sm text-red-600">{{ form.errors.password }}</p>
        </div>

        <div class="space-y-1.5">
          <label for="password_confirmation" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">Confirm password</label>
          <input
            id="password_confirmation"
            v-model="form.password_confirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            required
            :class="[fieldClass, form.errors.password_confirmation ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : '']"
          />
          <p v-if="form.errors.password_confirmation" class="text-sm text-red-600">{{ form.errors.password_confirmation }}</p>
        </div>

        <button
          type="submit"
          :disabled="form.processing"
          :aria-busy="form.processing"
          class="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary text-base font-semibold text-white shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-wait disabled:opacity-90"
        >
          <span>{{ form.processing ? 'Submitting…' : 'Save password' }}</span>
        </button>
      </form>

      <p class="text-center text-sm text-slate-500 dark:text-neutral-400">
        <Link href="/portal/login" class="font-medium text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  </AuthLayout>
</template>
