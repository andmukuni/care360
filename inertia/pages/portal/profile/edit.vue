<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  patient: Record<string, any>
}>()

const contactForm = useForm({
  email: props.patient.email ?? '',
  phone_number: props.patient.phoneNumber ?? '',
  other_cellphone: props.patient.otherCellphone ?? '',
  landline: props.patient.landline ?? '',
  house_number: props.patient.houseNumber ?? '',
  road_street: props.patient.roadStreet ?? '',
  area: props.patient.area ?? '',
  city_town_village: props.patient.cityTownVillage ?? '',
  landmarks: props.patient.landmarks ?? '',
})

const nextOfKinForm = useForm({
  next_of_kin_name: props.patient.nextOfKinName ?? '',
  next_of_kin_phone: props.patient.nextOfKinPhone ?? '',
  next_of_kin_relationship: props.patient.nextOfKinRelationship ?? '',
})

const passwordForm = useForm({
  current_password: '',
  password: '',
  password_confirmation: '',
})

const inputClass =
  'theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-xs font-semibold text-neutral-500 mb-1'

function submitContact() {
  contactForm.put('/portal/profile')
}
function submitNextOfKin() {
  nextOfKinForm.put('/portal/profile/next-of-kin')
}
function submitPassword() {
  passwordForm.put('/portal/profile/password', {
    onSuccess: () => passwordForm.reset(),
  })
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Edit profile</h1>

    <!-- Contact -->
    <form class="space-y-4 mb-8" @submit.prevent="submitContact">
      <div class="rounded-xl theme-surface p-4 space-y-4">
        <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500">Contact details</h2>
        <div>
          <label :class="labelClass">Email</label>
          <input v-model="contactForm.email" type="email" required :class="inputClass" />
          <p v-if="contactForm.errors.email" class="text-xs text-red-600 mt-1">{{ contactForm.errors.email }}</p>
        </div>
        <div>
          <label :class="labelClass">Phone</label>
          <input v-model="contactForm.phone_number" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Other cellphone</label>
          <input v-model="contactForm.other_cellphone" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Landline</label>
          <input v-model="contactForm.landline" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">House number</label>
          <input v-model="contactForm.house_number" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Road / street</label>
          <input v-model="contactForm.road_street" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Area</label>
          <input v-model="contactForm.area" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">City / town / village</label>
          <input v-model="contactForm.city_town_village" type="text" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Landmarks</label>
          <textarea v-model="contactForm.landmarks" rows="2" :class="inputClass" />
        </div>
      </div>
      <div class="flex gap-3">
        <ActionButton type="submit" variant="primary" :loading="contactForm.processing" loading-text="Saving…">Save contact</ActionButton>
        <Link href="/portal/profile" class="px-5 py-2.5 text-sm font-semibold text-neutral-600">Cancel</Link>
      </div>
    </form>

    <!-- Next of kin -->
    <form class="space-y-4 mb-8" @submit.prevent="submitNextOfKin">
      <div class="rounded-xl theme-surface p-4 space-y-4">
        <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500">Next of kin</h2>
        <div>
          <label :class="labelClass">Name</label>
          <input v-model="nextOfKinForm.next_of_kin_name" type="text" maxlength="150" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Phone</label>
          <input v-model="nextOfKinForm.next_of_kin_phone" type="text" maxlength="30" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Relationship</label>
          <input v-model="nextOfKinForm.next_of_kin_relationship" type="text" maxlength="50"
                 placeholder="e.g. Spouse, Parent, Sibling" :class="inputClass" />
        </div>
      </div>
      <ActionButton type="submit" variant="primary" :loading="nextOfKinForm.processing" loading-text="Saving…">Save next of kin</ActionButton>
    </form>

    <!-- Password -->
    <form class="space-y-4" @submit.prevent="submitPassword">
      <div class="rounded-xl theme-surface p-4 space-y-4">
        <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500">Change password</h2>
        <div>
          <label :class="labelClass">Current password</label>
          <input v-model="passwordForm.current_password" type="password" required autocomplete="current-password" :class="inputClass" />
          <p v-if="passwordForm.errors.current_password" class="text-xs text-red-600 mt-1">{{ passwordForm.errors.current_password }}</p>
        </div>
        <div>
          <label :class="labelClass">New password</label>
          <input v-model="passwordForm.password" type="password" required minlength="8" autocomplete="new-password" :class="inputClass" />
          <p v-if="passwordForm.errors.password" class="text-xs text-red-600 mt-1">{{ passwordForm.errors.password }}</p>
        </div>
        <div>
          <label :class="labelClass">Confirm new password</label>
          <input v-model="passwordForm.password_confirmation" type="password" required autocomplete="new-password" :class="inputClass" />
        </div>
      </div>
      <ActionButton type="submit" variant="outline" :loading="passwordForm.processing" loading-text="Saving…">Update password</ActionButton>
    </form>
  </PortalLayout>
</template>
