<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm, usePage } from '@inertiajs/vue3'
import AuthLayout from '~/layouts/AuthLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

defineProps<{
  userName?: string | null
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

const mode = ref<'choose' | 'change'>('choose')
const showPassword = ref(false)
const showConfirm = ref(false)

const changeForm = useForm({
  password: '',
  password_confirmation: '',
})

const keepForm = useForm({})

function keepPassword() {
  keepForm.post('/password/welcome/keep')
}

function submitChange() {
  changeForm.post('/password/welcome/change')
}

const fieldClass =
  'theme-field h-10 w-full rounded-lg px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-[#5A45FF33] dark:placeholder:text-neutral-500 dark:focus:ring-0'
</script>

<template>
  <AuthLayout :brand-title="clinicName" brand-tagline="Hospital Management System">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">
          {{ mode === 'choose' ? 'Update your password?' : 'Choose a new password' }}
        </h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          <template v-if="mode === 'choose'">
            Your account was reset to the default password
            <span class="font-semibold text-slate-700 dark:text-neutral-200">123456</span>.
            You can change it now, or keep using it.
          </template>
          <template v-else>
            Pick a new password for
            <span class="font-medium text-slate-700 dark:text-neutral-200">{{ userName || 'your account' }}</span>.
          </template>
        </p>
      </div>

      <div
        v-if="errors.password"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      >
        {{ Array.isArray(errors.password) ? errors.password[0] : errors.password }}
      </div>

      <div v-if="mode === 'choose'" class="space-y-3">
        <ActionButton type="button" variant="blue" class="w-full justify-center" @click="mode = 'change'">
          Change password
        </ActionButton>
        <button
          type="button"
          class="flex h-10 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          :disabled="keepForm.processing"
          @click="keepPassword"
        >
          {{ keepForm.processing ? 'Saving…' : 'Keep using 123456' }}
        </button>
        <p class="text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
          Keeping the default is allowed, but changing it is recommended for security.
        </p>
      </div>

      <form v-else class="space-y-4" @submit.prevent="submitChange">
        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">
            New password
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="changeForm.password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="6"
              autocomplete="new-password"
              :class="[fieldClass, 'pr-10']"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-xs text-slate-500"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
          <p v-if="changeForm.errors.password" class="text-sm text-red-600">{{ changeForm.errors.password }}</p>
        </div>

        <div class="space-y-1.5">
          <label for="password_confirmation" class="block text-sm font-medium text-slate-600 dark:text-neutral-300">
            Confirm password
          </label>
          <div class="relative">
            <input
              id="password_confirmation"
              v-model="changeForm.password_confirmation"
              :type="showConfirm ? 'text' : 'password'"
              required
              minlength="6"
              autocomplete="new-password"
              :class="[fieldClass, 'pr-10']"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-xs text-slate-500"
              @click="showConfirm = !showConfirm"
            >
              {{ showConfirm ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row">
          <ActionButton
            type="submit"
            variant="blue"
            class="w-full justify-center sm:flex-1"
            :loading="changeForm.processing"
            loading-text="Saving…"
          >
            Save new password
          </ActionButton>
          <button
            type="button"
            class="flex h-10 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:flex-1"
            @click="mode = 'choose'"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  </AuthLayout>
</template>
