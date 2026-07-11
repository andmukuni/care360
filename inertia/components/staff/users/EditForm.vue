<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import UserAvatar from '~/components/staff/users/UserAvatar.vue'
import SignatureSigningPanel from '~/components/staff/users/SignatureSigningPanel.vue'

interface PendingSignatureInvite {
  url: string
  expires_at: string
}

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
  signature_signed_at?: string | null
  pending_signature_invite?: PendingSignatureInvite | null
}

const props = defineProps<{
  user: EditUser
  action: string
  showPortalToggle?: boolean
  signatureInviteEndpoint: string
}>()

const fieldClass =
  'theme-field users-edit__field w-full rounded px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const form = useForm({
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
  remove_signature: false,
})

const photoPreview = ref<string | null>(null)

const displayPhotoUrl = computed(() => {
  if (form.remove_profile_photo) return null
  if (photoPreview.value) return photoPreview.value
  return props.user.profile_photo_url
})

const displaySignatureUrl = computed(() => {
  if (form.remove_signature) return null
  return props.user.signature_url
})

const profileHeadline = computed(() => {
  const title = form.title.trim()
  const specialty = form.specialty.trim()
  if (title && specialty) return `${title} · ${specialty}`
  return title || specialty || form.email
})

function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  form.profile_photo = file
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = file ? URL.createObjectURL(file) : null
  if (file) form.remove_profile_photo = false
}

function clearPhotoSelection() {
  form.profile_photo = null
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = null
}

function submit() {
  form.put(props.action, { forceFormData: true })
}

onBeforeUnmount(() => {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
})
</script>

<template>
  <form class="users-edit" @submit.prevent="submit">
    <div class="users-edit__hero">
      <UserAvatar :name="form.name" :photo-url="displayPhotoUrl" size="lg" />
      <div class="min-w-0">
        <h2 class="truncate text-lg font-semibold text-slate-900 dark:text-neutral-100">{{ form.name || 'Staff member' }}</h2>
        <p class="truncate text-sm text-sand-11">{{ profileHeadline }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span
            v-if="props.showPortalToggle"
            class="users-edit__status-pill"
            :class="form.is_portal_bookable ? 'users-edit__status-pill--teal' : 'users-edit__status-pill--muted'"
          >
            {{ form.is_portal_bookable ? 'Visible on patient portal' : 'Hidden from patient portal' }}
          </span>
          <span v-if="displayPhotoUrl" class="users-edit__status-pill users-edit__status-pill--muted">Photo on file</span>
          <span v-if="displaySignatureUrl" class="users-edit__status-pill users-edit__status-pill--muted">Signature on file</span>
        </div>
      </div>
    </div>

    <div class="users-edit__sections">
      <section class="users-edit__section">
        <header class="users-edit__section-head">
          <h3 class="users-edit__section-title">Profile media</h3>
          <p class="users-edit__section-desc">Photo and signature shown on the portal and official documents.</p>
        </header>

        <div class="users-edit__media-grid">
          <div class="users-edit__media-card">
            <div class="users-edit__media-preview users-edit__media-preview--photo">
              <UserAvatar v-if="displayPhotoUrl" :name="form.name" :photo-url="displayPhotoUrl" size="lg" />
              <UserAvatar v-else :name="form.name" size="lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="users-edit__media-label">Profile photo</p>
              <p class="users-edit__media-hint">Used on staff lists, profiles, and the patient portal.</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <label class="users-edit__file-btn">
                  <input type="file" accept="image/*" class="sr-only" @change="onFile" />
                  {{ displayPhotoUrl ? 'Replace photo' : 'Upload photo' }}
                </label>
                <button
                  v-if="form.profile_photo"
                  type="button"
                  class="users-edit__text-btn"
                  @click="clearPhotoSelection"
                >
                  Clear selection
                </button>
                <button
                  v-if="props.user.profile_photo_url && !form.remove_profile_photo"
                  type="button"
                  class="users-edit__text-btn users-edit__text-btn--danger"
                  @click="form.remove_profile_photo = true"
                >
                  Remove current
                </button>
                <button
                  v-if="form.remove_profile_photo"
                  type="button"
                  class="users-edit__text-btn"
                  @click="form.remove_profile_photo = false"
                >
                  Undo remove
                </button>
              </div>
              <p v-if="form.errors.profile_photo" class="users-edit__error">{{ form.errors.profile_photo }}</p>
            </div>
          </div>

          <div class="users-edit__media-card">
            <div class="users-edit__media-preview users-edit__media-preview--signature">
              <img
                v-if="displaySignatureUrl"
                :src="displaySignatureUrl"
                alt="Signature preview"
                class="max-h-full max-w-full object-contain"
              />
              <span v-else class="text-xs text-sand-11">No signature</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="users-edit__media-label">Signature</p>
              <p class="users-edit__media-hint">
                Generate a mobile signing link for staff to draw their signature on a phone or tablet.
              </p>
              <SignatureSigningPanel
                class="mt-3"
                :staff-name="form.name"
                :invite-endpoint="props.signatureInviteEndpoint"
                :signature-url="displaySignatureUrl"
                :signed-at="props.user.signature_signed_at"
                :pending-invite="props.user.pending_signature_invite"
              >
                <template #actions>
                  <button
                    v-if="props.user.signature_url && !form.remove_signature"
                    type="button"
                    class="users-edit__text-btn users-edit__text-btn--danger"
                    @click="form.remove_signature = true"
                  >
                    Remove current
                  </button>
                  <button
                    v-if="form.remove_signature"
                    type="button"
                    class="users-edit__text-btn"
                    @click="form.remove_signature = false"
                  >
                    Undo remove
                  </button>
                </template>
              </SignatureSigningPanel>
              <p v-if="form.errors.signature" class="users-edit__error">{{ form.errors.signature }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="users-edit__section">
        <header class="users-edit__section-head">
          <h3 class="users-edit__section-title">Professional details</h3>
          <p class="users-edit__section-desc">How this staff member appears to colleagues and patients.</p>
        </header>

        <div class="users-edit__field-grid">
          <div>
            <label class="users-edit__label">Name</label>
            <input v-model="form.name" type="text" :class="fieldClass" />
            <p v-if="form.errors.name" class="users-edit__error">{{ form.errors.name }}</p>
          </div>
          <div>
            <label class="users-edit__label">Title</label>
            <input v-model="form.title" type="text" :class="fieldClass" placeholder="Dr., Nurse…" />
            <p v-if="form.errors.title" class="users-edit__error">{{ form.errors.title }}</p>
          </div>
          <div>
            <label class="users-edit__label">Specialty</label>
            <input v-model="form.specialty" type="text" :class="fieldClass" placeholder="e.g. General Practice" />
            <p v-if="form.errors.specialty" class="users-edit__error">{{ form.errors.specialty }}</p>
          </div>
          <div>
            <label class="users-edit__label">Email</label>
            <input v-model="form.email" type="email" :class="fieldClass" />
            <p v-if="form.errors.email" class="users-edit__error">{{ form.errors.email }}</p>
          </div>
          <div class="users-edit__field-span">
            <label class="users-edit__label">Bio</label>
            <textarea v-model="form.bio" rows="4" :class="fieldClass" placeholder="Short professional bio for the patient portal…" />
            <p v-if="form.errors.bio" class="users-edit__error">{{ form.errors.bio }}</p>
          </div>
        </div>
      </section>

      <section class="users-edit__section">
        <header class="users-edit__section-head">
          <h3 class="users-edit__section-title">Account security</h3>
          <p class="users-edit__section-desc">Leave password fields blank to keep the current password.</p>
        </header>

        <div class="users-edit__field-grid users-edit__field-grid--pair">
          <div>
            <label class="users-edit__label">New password</label>
            <input v-model="form.password" type="password" :class="fieldClass" autocomplete="new-password" />
            <p v-if="form.errors.password" class="users-edit__error">{{ form.errors.password }}</p>
          </div>
          <div>
            <label class="users-edit__label">Confirm password</label>
            <input v-model="form.password_confirmation" type="password" :class="fieldClass" autocomplete="new-password" />
          </div>
        </div>
      </section>

      <section v-if="props.showPortalToggle" class="users-edit__section">
        <header class="users-edit__section-head">
          <h3 class="users-edit__section-title">Patient portal</h3>
          <p class="users-edit__section-desc">Control whether patients can find and book this staff member.</p>
        </header>

        <div
          class="users-edit__toggle-card"
          role="button"
          tabindex="0"
          @click="form.is_portal_bookable = !form.is_portal_bookable"
          @keydown.enter.prevent="form.is_portal_bookable = !form.is_portal_bookable"
          @keydown.space.prevent="form.is_portal_bookable = !form.is_portal_bookable"
        >
          <div class="min-w-0">
            <p class="users-edit__toggle-title">Visible on patient portal</p>
            <p class="users-edit__toggle-desc">
              When enabled, patients can see this profile and book appointments if scheduling is available.
            </p>
          </div>
          <div
            class="users-edit__toggle"
            :class="{ 'users-edit__toggle--on': form.is_portal_bookable }"
            role="switch"
            :aria-checked="form.is_portal_bookable"
          >
            <span class="users-edit__toggle-thumb" aria-hidden="true" />
          </div>
        </div>
      </section>
    </div>

    <div class="users-edit__actions">
      <slot name="cancel" />
      <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">
        Save changes
      </ActionButton>
    </div>
  </form>
</template>
