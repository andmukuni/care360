<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'

interface EditUser {
  id: number
  name: string
  title: string | null
  specialty: string | null
  bio: string | null
  email: string
  is_portal_bookable: boolean
  profile_photo_url: string | null
  signature_url: string | null
}

const props = defineProps<{
  user: EditUser
  action: string
  showPortalToggle?: boolean
}>()

const form = useForm({
  _method: 'put',
  name: props.user.name,
  title: props.user.title ?? '',
  specialty: props.user.specialty ?? '',
  bio: props.user.bio ?? '',
  email: props.user.email,
  password: '',
  password_confirmation: '',
  is_portal_bookable: props.user.is_portal_bookable,
  profile_photo: null as File | null,
  remove_profile_photo: false,
  signature: null as File | null,
  remove_signature: false,
})

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  form.profile_photo = target.files?.[0] ?? null
}

function onSignatureFile(event: Event) {
  const target = event.target as HTMLInputElement
  form.signature = target.files?.[0] ?? null
}

function submit() {
  form.post(props.action, { forceFormData: true })
}
</script>

<template>
  <form class="theme-panel max-w-2xl space-y-4 rounded-lg p-6" @submit.prevent="submit">
    <div class="flex items-center gap-4">
      <div class="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-sand-3">
        <img v-if="props.user.profile_photo_url" :src="props.user.profile_photo_url" alt="" class="h-full w-full object-cover" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Profile Photo</label>
        <input type="file" accept="image/*" @change="onFile" />
        <p v-if="form.errors.profile_photo" class="mt-1 text-sm text-red-600">{{ form.errors.profile_photo }}</p>
        <label v-if="props.user.profile_photo_url" class="mt-1 flex items-center gap-2 text-sm text-sand-11">
          <input v-model="form.remove_profile_photo" type="checkbox" /> Remove current photo
        </label>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Signature</label>
      <p class="mb-2 text-xs text-sand-11">
        Upload a signature image for prescriptions and official documents.
      </p>
      <div v-if="props.user.signature_url" class="theme-surface mb-2 rounded p-3">
        <img
          :src="props.user.signature_url"
          alt="Current signature"
          class="max-h-16 max-w-xs object-contain"
        />
      </div>
      <input type="file" accept="image/*" @change="onSignatureFile" />
      <p v-if="form.errors.signature" class="mt-1 text-sm text-red-600">{{ form.errors.signature }}</p>
      <label v-if="props.user.signature_url" class="mt-1 flex items-center gap-2 text-sm text-sand-11">
        <input v-model="form.remove_signature" type="checkbox" /> Remove current signature
      </label>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.name" class="mt-1 text-sm text-red-600">{{ form.errors.name }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Title</label>
        <input v-model="form.title" type="text" class="theme-field w-full rounded px-3 py-2" placeholder="Dr., Nurse…" />
        <p v-if="form.errors.title" class="mt-1 text-sm text-red-600">{{ form.errors.title }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Specialty</label>
        <input v-model="form.specialty" type="text" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.specialty" class="mt-1 text-sm text-red-600">{{ form.errors.specialty }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input v-model="form.email" type="email" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.email" class="mt-1 text-sm text-red-600">{{ form.errors.email }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Bio</label>
      <textarea v-model="form.bio" rows="4" class="theme-field w-full rounded px-3 py-2"></textarea>
      <p v-if="form.errors.bio" class="mt-1 text-sm text-red-600">{{ form.errors.bio }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="block text-sm font-medium mb-1">New Password</label>
        <input v-model="form.password" type="password" class="theme-field w-full rounded px-3 py-2" />
        <p v-if="form.errors.password" class="mt-1 text-sm text-red-600">{{ form.errors.password }}</p>
        <p class="mt-1 text-xs text-sand-11">Leave blank to keep the current password.</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Confirm Password</label>
        <input v-model="form.password_confirmation" type="password" class="theme-field w-full rounded px-3 py-2" />
      </div>
    </div>

    <label v-if="props.showPortalToggle" class="flex items-center gap-2 text-sm">
      <input v-model="form.is_portal_bookable" type="checkbox" /> Visible on patient portal (bookable)
    </label>

    <div class="flex gap-2 pt-2">
      <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save Changes</ActionButton>
      <slot name="cancel" />
    </div>
  </form>
</template>
