<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, useForm, usePage } from '@inertiajs/vue3'
import AuthLayout from '~/layouts/AuthLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)
const showPassword = ref(false)

const form = useForm({
  email: '',
  password: '',
  remember: false,
})

const fieldClass =
  'theme-field h-12 w-full rounded-lg px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-[#5A45FF33] dark:placeholder:text-neutral-500 dark:focus:ring-0'

function submit() {
  form.post('/portal/login')
}
</script>

<template>
  <AuthLayout :brand-title="clinicName" brand-tagline="Patient Portal">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">Patient portal</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          Sign in to view appointments, medical records, billing, and messages.
        </p>
      </div>

      <div v-if="errors.login" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        {{ errors.login }}
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

        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">Password</label>
          <div class="relative">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              :class="[
                fieldClass,
                'pr-12',
                form.errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : '',
              ]"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.092 1.093a4 4 0 0 0-5.558-5.558Z"
                  clip-rule="evenodd"
                />
                <path
                  d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path
                  fill-rule="evenodd"
                  d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
          <p v-if="form.errors.password" class="text-sm text-red-600">{{ form.errors.password }}</p>
        </div>

        <button
          type="submit"
          :disabled="form.processing"
          :aria-busy="form.processing"
          class="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary text-base font-semibold text-white shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-wait disabled:opacity-90"
        >
          <svg
            v-if="form.processing"
            class="h-5 w-5 animate-spin text-white/90"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{{ form.processing ? 'Signing in…' : 'Sign in' }}</span>
        </button>
      </form>

      <p class="text-center text-sm text-slate-500">
        <Link href="/portal/forgot-password" class="font-medium text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>
    </div>
  </AuthLayout>
</template>
