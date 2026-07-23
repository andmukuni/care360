<script setup lang="ts">
import { computed } from 'vue'
import { Link, useForm, usePage } from '@inertiajs/vue3'
import AuthLayout from '~/layouts/AuthLayout.vue'

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

const form = useForm({
  email: '',
})

const fieldClass =
  'theme-field h-12 w-full rounded-lg px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-[#5A45FF33] dark:placeholder:text-neutral-500 dark:focus:ring-0'

function submit() {
  form.post('/portal/forgot-password')
}
</script>

<template>
  <AuthLayout :brand-title="clinicName" brand-tagline="Patient Portal">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">Reset your password</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <form @submit.prevent="submit" class="space-y-5">
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">Email address</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            name="email"
            autocomplete="username"
            placeholder="you@example.com"
            required
            :class="[fieldClass, form.errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : '']"
          />
          <p v-if="form.errors.email" class="text-sm text-red-600">{{ form.errors.email }}</p>
        </div>

        <button
          type="submit"
          :disabled="form.processing"
          :aria-busy="form.processing"
          class="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary text-base font-semibold text-white shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-wait disabled:opacity-90"
        >
          <span>{{ form.processing ? 'Submitting…' : 'Email reset link' }}</span>
        </button>
      </form>

      <p class="text-center text-sm text-slate-500 dark:text-neutral-400">
        <Link href="/portal/login" class="font-medium text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  </AuthLayout>
</template>
