<script setup lang="ts">
import { ref, computed } from 'vue'
import { Link, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{ today: string }>()

const step = ref(1)
const steps = ['Personal Information', 'Marital, Birth & Education', 'Biometrics']

const form = useForm({
  first_name: '',
  surname: '',
  date_of_birth: '',
  gender: '',
  no_nrc: false,
  nrc_number: '',
  country: 'ZM',
  no_cellphone: false,
  phone_code: '+260',
  cellphone: '',
  other_phone_code: '',
  other_cellphone: '',
  landline_code: '',
  landline: '',
  email: '',
  house_number: '',
  road_street: '',
  area: '',
  city_town_village: '',
  landmarks: '',
  marital_status: '',
  spouse_first_name: '',
  spouse_surname: '',
  home_language: '',
  born_in_zambia: 'Yes',
  province_of_birth: '',
  district_of_birth: '',
  place_of_birth: '',
  occupation: '',
  art_number: '',
  nupn: '',
  blood_group: '',
  allergies: '',
  registration_date: props.today,
})

const provinces = ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western']
const languages = ['Bemba', 'Nyanja', 'Tonga', 'Lozi', 'Kaonde', 'Lunda', 'Luvale', 'English', 'Chewa', 'Other']
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const hasErrors = computed(() => Object.keys(form.errors).length > 0)

function submit() {
  form.post('/patients')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Register New Patient</h1></template>

    <div class="max-w-4xl">
      <div v-if="hasErrors" class="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p class="font-semibold mb-1">Please fix the following before submitting:</p>
        <ul class="list-disc pl-5">
          <li v-for="(msg, key) in form.errors" :key="key">{{ msg }}</li>
        </ul>
      </div>

      <div class="mb-4 flex gap-2 rounded-lg bg-sand-3 p-2">
        <button
          v-for="(label, i) in steps"
          :key="i"
          type="button"
          class="flex-1 rounded px-3 py-2 text-sm font-medium"
          :class="step === i + 1 ? 'bg-white shadow text-sand-12' : 'text-sand-11'"
          @click="step = i + 1"
        >
          {{ i + 1 }}. {{ label }}
        </button>
      </div>

      <form class="theme-panel rounded-lg p-6" @submit.prevent="submit">
        <!-- Step 1 -->
        <div v-show="step === 1" class="space-y-5">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">First Name *</label>
              <input v-model="form.first_name" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.first_name" class="mt-1 text-xs text-red-600">{{ form.errors.first_name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Surname *</label>
              <input v-model="form.surname" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.surname" class="mt-1 text-xs text-red-600">{{ form.errors.surname }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Date of Birth *</label>
              <input v-model="form.date_of_birth" type="date" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.date_of_birth" class="mt-1 text-xs text-red-600">{{ form.errors.date_of_birth }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Sex *</label>
              <select v-model="form.gender" class="theme-field w-full rounded px-3 py-2">
                <option value="">-- Select --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <p v-if="form.errors.gender" class="mt-1 text-xs text-red-600">{{ form.errors.gender }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">NRC</label>
              <input v-model="form.nrc_number" :disabled="form.no_nrc" class="w-full rounded border border-sand-6 px-3 py-2 disabled:bg-sand-3" />
              <label class="mt-1 flex items-center gap-2 text-xs text-sand-11">
                <input v-model="form.no_nrc" type="checkbox" /> Client does not have NRC
              </label>
              <p v-if="form.errors.nrc_number" class="mt-1 text-xs text-red-600">{{ form.errors.nrc_number }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Country *</label>
              <select v-model="form.country" class="theme-field w-full rounded px-3 py-2">
                <option value="ZM">Zambia</option>
                <option value="MW">Malawi</option>
                <option value="MZ">Mozambique</option>
                <option value="TZ">Tanzania</option>
                <option value="ZW">Zimbabwe</option>
                <option value="CD">DR Congo</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Registration Date *</label>
              <input v-model="form.registration_date" type="date" class="theme-field w-full rounded px-3 py-2" />
            </div>
          </div>

          <h3 class="pt-4 text-sm font-semibold text-sand-11">Contact Information</h3>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">Cellphone</label>
              <div class="flex gap-2">
                <input v-model="form.phone_code" :disabled="form.no_cellphone" class="w-24 rounded border border-sand-6 px-2 py-2 disabled:bg-sand-3" />
                <input v-model="form.cellphone" :disabled="form.no_cellphone" class="w-full rounded border border-sand-6 px-3 py-2 disabled:bg-sand-3" />
              </div>
              <label class="mt-1 flex items-center gap-2 text-xs text-sand-11">
                <input v-model="form.no_cellphone" type="checkbox" /> No cellphone number
              </label>
              <p v-if="form.errors.cellphone" class="mt-1 text-xs text-red-600">{{ form.errors.cellphone }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Other Cellphone</label>
              <div class="flex gap-2">
                <input v-model="form.other_phone_code" class="w-24 rounded border border-sand-6 px-2 py-2" placeholder="+260" />
                <input v-model="form.other_cellphone" class="theme-field w-full rounded px-3 py-2" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Email</label>
              <input v-model="form.email" type="email" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.email" class="mt-1 text-xs text-red-600">{{ form.errors.email }}</p>
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
              <label class="mb-1 block text-sm font-medium">Landmarks & Directions</label>
              <textarea v-model="form.landmarks" class="theme-field w-full rounded px-3 py-2"></textarea>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div v-show="step === 2" class="space-y-5">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">Marital Status</label>
              <select v-model="form.marital_status" class="theme-field w-full rounded px-3 py-2">
                <option value="">-- Select --</option>
                <option>Single</option>
                <option>Married</option>
                <option>Divorced</option>
                <option>Widowed</option>
                <option>Separated</option>
              </select>
            </div>
            <div></div>
            <div>
              <label class="mb-1 block text-sm font-medium">Spouse First Name</label>
              <input v-model="form.spouse_first_name" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Spouse Surname</label>
              <input v-model="form.spouse_surname" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Home Language *</label>
              <select v-model="form.home_language" class="theme-field w-full rounded px-3 py-2">
                <option value="">-- Select --</option>
                <option v-for="l in languages" :key="l">{{ l }}</option>
              </select>
              <p v-if="form.errors.home_language" class="mt-1 text-xs text-red-600">{{ form.errors.home_language }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Born in Zambia *</label>
              <select v-model="form.born_in_zambia" class="theme-field w-full rounded px-3 py-2">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Province of Birth *</label>
              <select v-model="form.province_of_birth" class="theme-field w-full rounded px-3 py-2">
                <option value="">-- Select --</option>
                <option v-for="p in provinces" :key="p">{{ p }}</option>
              </select>
              <p v-if="form.errors.province_of_birth" class="mt-1 text-xs text-red-600">{{ form.errors.province_of_birth }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">District of Birth *</label>
              <input v-model="form.district_of_birth" class="theme-field w-full rounded px-3 py-2" />
              <p v-if="form.errors.district_of_birth" class="mt-1 text-xs text-red-600">{{ form.errors.district_of_birth }}</p>
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

        <!-- Step 3 -->
        <div v-show="step === 3" class="space-y-5">
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
              <select v-model="form.blood_group" class="theme-field w-full rounded px-3 py-2">
                <option value="">-- Select --</option>
                <option v-for="g in bloodGroups" :key="g">{{ g }}</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="mb-1 block text-sm font-medium">Allergies</label>
              <textarea v-model="form.allergies" class="theme-field w-full rounded px-3 py-2"></textarea>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between border-t border-sand-4 pt-4">
          <Link href="/patients" class="theme-icon-btn rounded px-4 py-2 text-sm">Cancel</Link>
          <div class="flex gap-2">
            <button v-if="step > 1" type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="step--">
              Previous
            </button>
            <button v-if="step < 3" type="button" class="rounded bg-sand-12 px-4 py-2 text-sm text-white" @click="step++">
              Next
            </button>
            <ActionButton v-else type="submit" variant="blue" :loading="form.processing" loading-text="Submitting…">Register Patient</ActionButton>
          </div>
        </div>
      </form>
    </div>
  </StaffLayout>
</template>
