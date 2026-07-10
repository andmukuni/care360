<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Link, useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Dependent {
  id: number
  full_name: string
  patient_id: string
}
interface SelectedDoctor {
  id: number
  name: string
  specialty: string | null
}

const props = defineProps<{
  guardian: Record<string, any>
  patient: Record<string, any>
  dependents: Dependent[]
  appointmentTypes: string[]
  appointmentPurposes: string[]
  selectedDoctor: SelectedDoctor | null
  receptionType: string | null
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const step = ref(1)

const form = useForm({
  patient_id: '',
  appointment_type: '',
  appointment_type_other: '',
  appointment_purpose: '',
  preferred_date: '',
  preferred_time: '',
  preferred_provider_id: props.selectedDoctor?.id ?? '',
  reception_type: props.receptionType ?? '',
  alternate_date: '',
  alternate_time: '',
  reason: '',
})

const isOther = computed(() => form.appointment_type === 'Other')
const today = new Date().toISOString().substring(0, 10)

watch(() => form.appointment_type, (val) => {
  if (val !== 'Other') form.appointment_type_other = ''
})

function goNext() {
  if (!form.appointment_type) return
  if (isOther.value && !form.appointment_type_other.trim()) return
  step.value = 2
}

function submit() {
  form.post('/portal/appointments')
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Request appointment</h1>
      <p class="text-sm text-neutral-500 mt-1">Choose a service, then tell us when and with whom.</p>
    </div>

    <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
      <ul class="list-disc list-inside">
        <li v-for="(msg, key) in errors" :key="key">{{ msg }}</li>
      </ul>
    </div>

    <ol class="flex items-center gap-3 mb-6 text-sm">
      <li class="flex items-center gap-2" :class="step >= 1 ? 'font-semibold' : 'text-neutral-400'">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" :class="step >= 1 ? 'bg-neutral-900 text-white' : 'bg-neutral-200'">1</span>
        Type
      </li>
      <span class="h-px w-10 bg-neutral-300"></span>
      <li class="flex items-center gap-2" :class="step >= 2 ? 'font-semibold' : 'text-neutral-400'">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" :class="step >= 2 ? 'bg-neutral-900 text-white' : 'bg-neutral-200'">2</span>
        Details
      </li>
    </ol>

    <form @submit.prevent="submit">
      <!-- Step 1 -->
      <div v-show="step === 1">
        <div class="rounded-xl theme-surface p-4 space-y-4">
          <div v-if="dependents.length">
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Book for</label>
            <select v-model="form.patient_id" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg">
              <option value="">Myself ({{ guardian.full_name }})</option>
              <option v-for="d in dependents" :key="d.id" :value="d.id">{{ d.full_name }}</option>
            </select>
          </div>

          <div>
            <p class="block text-xs font-semibold text-neutral-500 mb-2">Appointment type</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label v-for="type in appointmentTypes" :key="type" class="cursor-pointer">
                <input type="radio" v-model="form.appointment_type" :value="type" class="sr-only peer" />
                <div class="theme-surface h-full rounded-xl p-4 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-200 hover:border-neutral-300">
                  <p class="text-sm font-semibold">{{ type }}</p>
                </div>
              </label>
            </div>
          </div>

          <div v-if="isOther">
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Specify type</label>
            <input type="text" v-model="form.appointment_type_other" maxlength="80" placeholder="e.g. Eye clinic, Physiotherapy"
                   class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button type="button" @click="goNext" class="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800">Next</button>
          <Link href="/portal/appointments" class="px-5 py-2.5 text-sm font-semibold text-neutral-600">Cancel</Link>
        </div>
      </div>

      <!-- Step 2 -->
      <div v-show="step === 2">
        <div class="rounded-xl theme-surface p-4 space-y-4">
          <div class="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <p class="text-xs text-neutral-500">Appointment type: <span class="font-semibold">{{ isOther ? (form.appointment_type_other || 'Other') : (form.appointment_type || '—') }}</span></p>
            <button type="button" @click="step = 1" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">Change</button>
          </div>

          <div>
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Purpose</label>
            <select v-model="form.appointment_purpose" required class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg">
              <option value="" disabled>Select purpose</option>
              <option v-for="p in appointmentPurposes" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">Preferred date</label>
              <input type="date" v-model="form.preferred_date" required :min="today" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">Preferred time</label>
              <input type="time" v-model="form.preferred_time" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
          </div>

          <div v-if="selectedDoctor" class="rounded-lg border border-teal-200 bg-teal-50 p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Doctor</p>
            <p class="text-sm font-semibold mt-0.5">{{ selectedDoctor.name }}</p>
            <p class="text-xs text-neutral-600">{{ selectedDoctor.specialty }}</p>
            <p v-if="receptionType" class="text-xs text-neutral-500 mt-1">Reception: {{ receptionType === 'online' ? 'Online / video' : 'In person' }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">Alternate date</label>
              <input type="date" v-model="form.alternate_date" :min="today" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-neutral-500 mb-1">Alternate time</label>
              <input type="time" v-model="form.alternate_time" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Reason / details (optional)</label>
            <textarea v-model="form.reason" rows="3" maxlength="2000" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg"></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button type="button" @click="step = 1" class="px-5 py-2.5 text-sm font-semibold border border-neutral-300 rounded-lg hover:bg-neutral-50">Back</button>
          <ActionButton type="submit" variant="primary" :loading="form.processing" loading-text="Submitting…">Submit request</ActionButton>
        </div>
      </div>
    </form>
  </PortalLayout>
</template>
