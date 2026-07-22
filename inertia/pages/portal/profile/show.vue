<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import { confirmDialog } from '~/composables/useConfirm'

const props = defineProps<{
  patient: Record<string, any>
  stats: { visits: number; appointments: number; labResults: number; lastVisit: string | null }
  isOwnProfile: boolean
}>()

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

const age = computed<number | null>(() => {
  if (!props.patient.dateOfBirth) return null
  const dob = new Date(props.patient.dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const diff = Date.now() - dob.getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
})

const photoUrl = computed<string | null>(() =>
  props.patient.profilePhotoPath ? `/storage/${props.patient.profilePhotoPath}` : null
)

const initials = computed(() => {
  const words = String(props.patient.fullName ?? '').split(' ').filter(Boolean)
  return words.slice(0, 2).map((w: string) => w[0].toUpperCase()).join('') || 'PT'
})

const address = computed(() =>
  [props.patient.houseNumber, props.patient.roadStreet, props.patient.area, props.patient.cityTownVillage]
    .filter(Boolean)
    .join(', ') || '—'
)

const hasAllergies = computed(() => {
  const a = String(props.patient.allergies ?? '').trim().toLowerCase()
  return a !== '' && a !== 'none'
})

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'medical', label: 'Medical' },
  { id: 'nextofkin', label: 'Next of Kin' },
]
const activeTab = ref('overview')

// Photo upload
const photoForm = useForm<{ profile_photo: File | null }>({ profile_photo: null })
function onPhotoChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    photoForm.profile_photo = target.files[0]
    photoForm.post('/portal/profile/photo', { forceFormData: true })
  }
}
async function removePhoto() {
  if (!(await confirmDialog('Remove your profile photo?'))) return
  router.delete('/portal/profile/photo')
}
</script>

<template>
  <PortalLayout>
    <div v-if="hasAllergies" class="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-300 border-l-4 border-l-red-500 rounded-lg">
      <div>
        <p class="text-sm font-bold text-red-700">Known allergies</p>
        <p class="text-sm text-red-600 mt-0.5">{{ patient.allergies }}</p>
      </div>
    </div>

    <!-- Hero -->
    <div class="theme-surface rounded-xl overflow-hidden mb-5">
      <div class="flex items-center gap-5 p-6 flex-wrap">
        <div class="flex-shrink-0">
          <img v-if="photoUrl" :src="photoUrl" :alt="patient.fullName" class="w-[72px] h-[72px] rounded-full object-cover border-2 border-white shadow-sm" />
          <div v-else class="w-[72px] h-[72px] rounded-full bg-neutral-800 text-white flex items-center justify-center text-2xl font-bold">
            {{ initials }}
          </div>
          <template v-if="isOwnProfile">
            <label class="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 cursor-pointer hover:text-neutral-900">
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="onPhotoChange" />
              Change photo
            </label>
            <button v-if="patient.profilePhotoPath" type="button" @click="removePhoto"
                    class="block text-[10px] font-semibold text-red-600 hover:underline mt-1">Remove</button>
          </template>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="text-xl font-extrabold text-neutral-900">{{ patient.fullName }}</div>
            <span v-if="!isOwnProfile" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Dependent</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-3">
            <span>{{ patient.patientId }}</span>
            <span>{{ humanize(patient.gender) }}</span>
            <span>{{ fmtDate(patient.dateOfBirth) }}<template v-if="age !== null"> · {{ age }} yrs</template></span>
            <span v-if="patient.phoneNumber">{{ patient.phoneNumber }}</span>
          </div>
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-white">{{ patient.patientId }}</span>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  :class="String(patient.status).toLowerCase() === 'inactive' ? 'bg-neutral-100 text-neutral-600' : 'bg-emerald-50 text-emerald-700'">
              {{ humanize(patient.status || 'active') }}
            </span>
            <span v-if="patient.bloodGroup" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">🩸 {{ patient.bloodGroup }}</span>
            <span v-if="hasAllergies" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">⚠ Allergies</span>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 border-t border-neutral-200">
        <div class="p-4 text-center border-r border-neutral-200">
          <p class="text-xl font-extrabold text-neutral-900">{{ stats.visits }}</p>
          <p class="text-[10px] font-semibold uppercase text-neutral-500 mt-1">Total Visits</p>
        </div>
        <div class="p-4 text-center border-r border-neutral-200">
          <p class="text-xl font-extrabold text-neutral-900">{{ stats.appointments }}</p>
          <p class="text-[10px] font-semibold uppercase text-neutral-500 mt-1">Appointments</p>
        </div>
        <div class="p-4 text-center border-r border-neutral-200">
          <p class="text-xl font-extrabold text-neutral-900">{{ stats.labResults }}</p>
          <p class="text-[10px] font-semibold uppercase text-neutral-500 mt-1">Lab Results</p>
        </div>
        <div class="p-4 text-center">
          <p class="text-sm font-semibold text-neutral-900">{{ fmtDate(stats.lastVisit) }}</p>
          <p class="text-[10px] font-semibold uppercase text-neutral-500 mt-1">Last Visit</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 p-4 border-t border-neutral-200 bg-neutral-50">
        <Link v-if="isOwnProfile" href="/portal/profile/edit"
              class="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold bg-neutral-900 text-white rounded">Edit Profile</Link>
        <Link href="/portal/appointments/create"
              class="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold theme-surface text-neutral-700 rounded">Request Appointment</Link>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-neutral-900 rounded-lg p-1 overflow-x-auto mb-4">
      <button v-for="tb in tabs" :key="tb.id" type="button" @click="activeTab = tb.id"
              class="flex-1 min-w-max px-4 py-2 text-xs font-bold rounded transition"
              :class="activeTab === tb.id ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'">
        {{ tb.label }}
      </button>
    </div>

    <!-- Overview -->
    <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="theme-surface rounded-lg p-5">
        <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">Identity</h2>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Patient ID</dt><dd class="font-mono font-semibold">{{ patient.patientId }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Full Name</dt><dd class="font-semibold">{{ patient.fullName }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Gender</dt><dd>{{ humanize(patient.gender) }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Date of Birth</dt><dd>{{ fmtDate(patient.dateOfBirth) }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">NRC Number</dt><dd class="font-mono">{{ patient.nrcNumber || '—' }}</dd></div>
        </dl>
      </div>
      <div class="theme-surface rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Contact</h2>
          <Link v-if="isOwnProfile" href="/portal/profile/edit" class="text-[11px] font-bold text-neutral-500 hover:text-neutral-900">Edit</Link>
        </div>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Phone</dt><dd>{{ patient.phoneNumber || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Email</dt><dd>{{ patient.email || '—' }}</dd></div>
          <div class="col-span-2"><dt class="text-[10px] font-bold uppercase text-neutral-500">Address</dt><dd>{{ address }}</dd></div>
        </dl>
      </div>
    </div>

    <!-- Demographics -->
    <div v-show="activeTab === 'demographics'" class="space-y-4">
      <div class="theme-surface rounded-lg p-5">
        <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">Personal Information</h2>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Marital Status</dt><dd>{{ humanize(patient.maritalStatus) }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Occupation</dt><dd>{{ patient.occupation || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Home Language</dt><dd>{{ patient.homeLanguage || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Country</dt><dd>{{ patient.country || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">NRC Number</dt><dd class="font-mono">{{ patient.nrcNumber || '—' }}</dd></div>
        </dl>
      </div>
      <div class="theme-surface rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Contact Information</h2>
          <Link v-if="isOwnProfile" href="/portal/profile/edit" class="text-[11px] font-bold text-neutral-500 hover:text-neutral-900">Edit</Link>
        </div>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Cellphone</dt><dd>{{ patient.phoneNumber || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Other Cellphone</dt><dd>{{ patient.otherCellphone || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Landline</dt><dd>{{ patient.landline || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Email</dt><dd>{{ patient.email || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">House Number</dt><dd>{{ patient.houseNumber || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Road / Street</dt><dd>{{ patient.roadStreet || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Area</dt><dd>{{ patient.area || '—' }}</dd></div>
          <div><dt class="text-[10px] font-bold uppercase text-neutral-500">City / Town / Village</dt><dd>{{ patient.cityTownVillage || '—' }}</dd></div>
          <div v-if="patient.landmarks" class="col-span-2 sm:col-span-3"><dt class="text-[10px] font-bold uppercase text-neutral-500">Landmarks</dt><dd>{{ patient.landmarks }}</dd></div>
        </dl>
      </div>
    </div>

    <!-- Medical -->
    <div v-show="activeTab === 'medical'" class="theme-surface rounded-lg p-5">
      <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">Medical Identifiers</h2>
      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Blood Group</dt><dd>{{ patient.bloodGroup || '—' }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">ART Number</dt><dd class="font-mono">{{ patient.artNumber || '—' }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">NUPN</dt><dd class="font-mono">{{ patient.nupn || '—' }}</dd></div>
        <div class="col-span-2 sm:col-span-3"><dt class="text-[10px] font-bold uppercase text-neutral-500">Allergies</dt><dd>{{ patient.allergies || 'None recorded' }}</dd></div>
      </dl>
    </div>

    <!-- Next of kin -->
    <div v-show="activeTab === 'nextofkin'" class="theme-surface rounded-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Next of Kin</h2>
        <Link v-if="isOwnProfile" href="/portal/profile/edit" class="text-[11px] font-bold text-neutral-500 hover:text-neutral-900">Edit</Link>
      </div>
      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Name</dt><dd>{{ patient.nextOfKinName || '—' }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Phone</dt><dd>{{ patient.nextOfKinPhone || '—' }}</dd></div>
        <div><dt class="text-[10px] font-bold uppercase text-neutral-500">Relationship</dt><dd>{{ patient.nextOfKinRelationship || '—' }}</dd></div>
      </dl>
    </div>
  </PortalLayout>
</template>
