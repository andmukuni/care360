<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  patient: Record<string, any>
  isRegistrationClerk: boolean
}>()

const toDate = (v: any): string => (v ? String(v).slice(0, 10) : '')

const p = props.patient
const form = useForm({
  full_name: p.full_name ?? '',
  date_of_birth: toDate(p.date_of_birth),
  gender: p.gender ?? 'Male',
  nrc_number: p.nrc_number ?? '',
  country: p.country ?? '',
  phone_number: p.phone_number ?? '',
  email: p.email ?? '',
  other_cellphone: p.other_cellphone ?? '',
  landline: p.landline ?? '',
  house_number: p.house_number ?? '',
  road_street: p.road_street ?? '',
  area: p.area ?? '',
  city_town_village: p.city_town_village ?? '',
  landmarks: p.landmarks ?? '',
  marital_status: p.marital_status ?? '',
  spouse_first_name: p.spouse_first_name ?? '',
  spouse_surname: p.spouse_surname ?? '',
  home_language: p.home_language ?? '',
  born_in_zambia: p.born_in_zambia ?? 'Yes',
  province_of_birth: p.province_of_birth ?? '',
  district_of_birth: p.district_of_birth ?? '',
  place_of_birth: p.place_of_birth ?? '',
  occupation: p.occupation ?? '',
  art_number: p.art_number ?? '',
  nupn: p.nupn ?? '',
  blood_group: p.blood_group ?? '',
  allergies: p.allergies ?? '',
  status: p.status ?? 'active',
  is_deceased: Boolean(p.is_deceased),
  deceased_at: toDate(p.deceased_at),
  deceased_notes: p.deceased_notes ?? '',
  portal_enabled: Boolean(p.portal_enabled),
})

function submit() {
  form.put(`/patients/${p.patient_id}`)
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Edit Patient — {{ p.full_name }}</h1></template>

    <form class="max-w-4xl space-y-6" @submit.prevent="submit">
      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Personal</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Full Name *</label>
            <input v-model="form.full_name" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.full_name" class="mt-1 text-xs text-red-600">{{ form.errors.full_name }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Date of Birth *</label>
            <input v-model="form.date_of_birth" type="date" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.date_of_birth" class="mt-1 text-xs text-red-600">{{ form.errors.date_of_birth }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Gender *</label>
            <select v-model="form.gender" class="theme-field w-full rounded px-3 py-2">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">NRC Number</label>
            <input v-model="form.nrc_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Country</label>
            <input v-model="form.country" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Marital Status</label>
            <input v-model="form.marital_status" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Spouse First Name</label>
            <input v-model="form.spouse_first_name" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Spouse Surname</label>
            <input v-model="form.spouse_surname" class="theme-field w-full rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Contact & Address</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Phone Number</label>
            <input v-model="form.phone_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Email</label>
            <input v-model="form.email" type="email" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.email" class="mt-1 text-xs text-red-600">{{ form.errors.email }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Other Cellphone</label>
            <input v-model="form.other_cellphone" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Landline</label>
            <input v-model="form.landline" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">House Number</label>
            <input v-model="form.house_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Road / Street</label>
            <input v-model="form.road_street" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Area</label>
            <input v-model="form.area" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">City / Town / Village</label>
            <input v-model="form.city_town_village" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">Landmarks</label>
            <textarea v-model="form.landmarks" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
        </div>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Birth & Language</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Home Language</label>
            <input v-model="form.home_language" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Born in Zambia</label>
            <select v-model="form.born_in_zambia" class="theme-field w-full rounded px-3 py-2">
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Province of Birth</label>
            <input v-model="form.province_of_birth" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">District of Birth</label>
            <input v-model="form.district_of_birth" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Place of Birth</label>
            <input v-model="form.place_of_birth" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Occupation</label>
            <input v-model="form.occupation" class="theme-field w-full rounded px-3 py-2" />
          </div>
        </div>
      </div>

      <div v-if="!isRegistrationClerk" class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Clinical</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">ART Number</label>
            <input v-model="form.art_number" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">NUPN</label>
            <input v-model="form.nupn" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Blood Group</label>
            <input v-model="form.blood_group" class="theme-field w-full rounded px-3 py-2" />
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">Allergies</label>
            <textarea v-model="form.allergies" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
        </div>
      </div>

      <div class="theme-panel rounded-lg p-6">
        <h2 class="mb-4 text-sm font-semibold text-sand-11">Status</h2>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">Status *</label>
            <select v-model="form.status" class="theme-field w-full rounded px-3 py-2">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div class="flex items-center gap-2 pt-6">
            <input v-model="form.portal_enabled" type="checkbox" id="portal_enabled" />
            <label for="portal_enabled" class="text-sm">Portal enabled</label>
          </div>
          <div class="flex items-center gap-2">
            <input v-model="form.is_deceased" type="checkbox" id="is_deceased" />
            <label for="is_deceased" class="text-sm">Patient is deceased</label>
          </div>
          <div v-if="form.is_deceased">
            <label class="mb-1 block text-sm font-medium">Deceased Date</label>
            <input v-model="form.deceased_at" type="date" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="form.errors.deceased_at" class="mt-1 text-xs text-red-600">{{ form.errors.deceased_at }}</p>
          </div>
          <div v-if="form.is_deceased" class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">Deceased Notes</label>
            <textarea v-model="form.deceased_notes" class="theme-field w-full rounded px-3 py-2"></textarea>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <ActionButton type="submit" variant="blue" :loading="form.processing" loading-text="Saving…">Save Changes</ActionButton>
        <Link :href="`/patients/${p.patient_id}`" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
      </div>
    </form>
  </StaffLayout>
</template>
