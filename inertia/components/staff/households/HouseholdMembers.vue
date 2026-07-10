<script setup lang="ts">
import { ref, watch } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'

interface Member {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  phoneNumber: string
  nrcNumber: string
  relationshipToHead: string
}

const props = defineProps<{
  householdId: string
  members: Member[]
}>()

type ModalMode = 'closed' | 'add' | 'link' | 'edit' | 'transfer'
const mode = ref<ModalMode>('closed')

const memberForm = useForm({
  full_name: '',
  gender: '',
  date_of_birth: '',
  phone_number: '',
  nrc_number: '',
  relationship_to_head: 'Member',
})

const linkForm = useForm({
  existing_patient_ref: '',
  relationship_to_head: 'Member',
})

const transferForm = useForm({
  target_household_id: '',
  transfer_as_head: false,
})

const editingRef = ref('')

// select2-style search state
const patientQuery = ref('')
const patientResults = ref<{ id: string; text: string; disabled?: boolean }[]>([])
const householdQuery = ref('')
const householdResults = ref<{ id: string; text: string }[]>([])

function openAdd() {
  memberForm.reset()
  mode.value = 'add'
}
function openLink() {
  linkForm.reset()
  patientQuery.value = ''
  patientResults.value = []
  mode.value = 'link'
}
function openEdit(m: Member) {
  editingRef.value = m.patientId
  memberForm.full_name = m.fullName
  memberForm.gender = m.gender
  memberForm.date_of_birth = m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : ''
  memberForm.phone_number = m.phoneNumber
  memberForm.nrc_number = m.nrcNumber
  memberForm.relationship_to_head = m.relationshipToHead || 'Member'
  mode.value = 'edit'
}
function openTransfer(m: Member) {
  editingRef.value = m.patientId
  transferForm.reset()
  householdQuery.value = ''
  householdResults.value = []
  mode.value = 'transfer'
}
function close() {
  mode.value = 'closed'
}

function submitAdd() {
  memberForm.post(`/households/${props.householdId}/members`, {
    preserveScroll: true,
    onSuccess: close,
  })
}
function submitLink() {
  linkForm.post(`/households/${props.householdId}/members`, {
    preserveScroll: true,
    onSuccess: close,
  })
}
function submitEdit() {
  memberForm.put(`/households/${props.householdId}/members/${editingRef.value}`, {
    preserveScroll: true,
    onSuccess: close,
  })
}
function submitTransfer() {
  transferForm.post(`/households/${props.householdId}/members/${editingRef.value}/transfer`, {
    preserveScroll: true,
    onSuccess: close,
  })
}

function setHead(m: Member) {
  if (confirm(`Set ${m.fullName} as head of house?`)) {
    router.post(`/households/${props.householdId}/members/${m.patientId}/set-head`, {}, { preserveScroll: true })
  }
}
function removeMember(m: Member) {
  if (confirm(`Remove ${m.fullName} from this household?`)) {
    router.delete(`/households/${props.householdId}/members/${m.patientId}`, { preserveScroll: true })
  }
}

async function runPatientSearch() {
  const q = patientQuery.value.trim()
  if (q === '') {
    patientResults.value = []
    return
  }
  const res = await fetch(`/households/${props.householdId}/patients/search?q=${encodeURIComponent(q)}`, {
    headers: { Accept: 'application/json' },
  })
  const json = await res.json()
  patientResults.value = json.results ?? []
}

async function runHouseholdSearch() {
  const res = await fetch(
    `/households/${props.householdId}/transfer-households/search?q=${encodeURIComponent(householdQuery.value.trim())}`,
    { headers: { Accept: 'application/json' } }
  )
  const json = await res.json()
  householdResults.value = json.results ?? []
}

let patientDebounce: ReturnType<typeof setTimeout>
watch(patientQuery, () => {
  clearTimeout(patientDebounce)
  patientDebounce = setTimeout(runPatientSearch, 250)
})
let householdDebounce: ReturnType<typeof setTimeout>
watch(householdQuery, () => {
  clearTimeout(householdDebounce)
  householdDebounce = setTimeout(runHouseholdSearch, 250)
})

function pickPatient(r: { id: string; disabled?: boolean }) {
  if (r.disabled) return
  linkForm.existing_patient_ref = r.id
}
function pickHousehold(r: { id: string }) {
  transferForm.target_household_id = r.id
}
</script>

<template>
  <section class="theme-panel rounded-lg p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-sand-11">Members ({{ members.length }})</h2>
      <div class="flex gap-2">
        <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="openLink">Link Existing</button>
        <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="openAdd">Add Member</button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-sand-11">
          <tr class="border-b border-sand-6">
            <th class="py-2 pr-3">Patient ID</th>
            <th class="py-2 pr-3">Name</th>
            <th class="py-2 pr-3">Relationship</th>
            <th class="py-2 pr-3">Phone</th>
            <th class="py-2 pr-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.patientId" class="border-b border-sand-4">
            <td class="py-2 pr-3 font-mono">
              <a :href="`/patients/${m.patientId}`" class="text-blue-600 hover:underline">{{ m.patientId }}</a>
            </td>
            <td class="py-2 pr-3">{{ m.fullName }}</td>
            <td class="py-2 pr-3">
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="m.relationshipToHead === 'Head' ? 'bg-blue-100 text-blue-800' : 'bg-sand-3 text-sand-11'"
              >{{ m.relationshipToHead || 'Member' }}</span>
            </td>
            <td class="py-2 pr-3">{{ m.phoneNumber || '—' }}</td>
            <td class="py-2 pr-3 text-right text-xs">
              <button type="button" class="text-blue-600 hover:underline" @click="openEdit(m)">Edit</button>
              <button v-if="m.relationshipToHead !== 'Head'" type="button" class="ml-2 text-blue-600 hover:underline" @click="setHead(m)">Set Head</button>
              <button type="button" class="ml-2 text-blue-600 hover:underline" @click="openTransfer(m)">Transfer</button>
              <button type="button" class="ml-2 text-red-600 hover:underline" @click="removeMember(m)">Remove</button>
            </td>
          </tr>
          <tr v-if="!members.length">
            <td colspan="5" class="py-6 text-center text-sand-11">No members in this household.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="mode !== 'closed'" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="close">
      <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <!-- Add / Edit -->
        <form v-if="mode === 'add' || mode === 'edit'" class="space-y-4" @submit.prevent="mode === 'add' ? submitAdd() : submitEdit()">
          <h3 class="text-base font-semibold">{{ mode === 'add' ? 'Add Member' : 'Edit Member' }}</h3>
          <div>
            <label class="mb-1 block text-sm font-medium">Full Name *</label>
            <input v-model="memberForm.full_name" class="theme-field w-full rounded px-3 py-2" />
            <p v-if="memberForm.errors.full_name" class="mt-1 text-xs text-red-600">{{ memberForm.errors.full_name }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Gender</label>
              <select v-model="memberForm.gender" class="theme-field w-full rounded px-3 py-2">
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Date of Birth</label>
              <input v-model="memberForm.date_of_birth" type="date" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Phone</label>
              <input v-model="memberForm.phone_number" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">NRC</label>
              <input v-model="memberForm.nrc_number" class="theme-field w-full rounded px-3 py-2" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Relationship</label>
              <select v-model="memberForm.relationship_to_head" class="theme-field w-full rounded px-3 py-2">
                <option value="Member">Member</option>
                <option value="Head">Head</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="close">Cancel</button>
            <ActionButton type="submit" variant="blue" :loading="memberForm.processing" loading-text="Saving…">Save</ActionButton>
          </div>
        </form>

        <!-- Link existing -->
        <form v-else-if="mode === 'link'" class="space-y-4" @submit.prevent="submitLink">
          <h3 class="text-base font-semibold">Link Existing Patient</h3>
          <div>
            <label class="mb-1 block text-sm font-medium">Search patient</label>
            <input v-model="patientQuery" class="theme-field w-full rounded px-3 py-2" placeholder="Name, ID, phone…" />
            <ul v-if="patientResults.length" class="theme-surface mt-2 max-h-48 overflow-y-auto rounded">
              <li
                v-for="r in patientResults"
                :key="r.id"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-sand-3"
                :class="{ 'opacity-50': r.disabled, 'bg-blue-50': linkForm.existing_patient_ref === r.id }"
                @click="pickPatient(r)"
              >{{ r.text }}</li>
            </ul>
            <p v-if="linkForm.existing_patient_ref" class="mt-1 text-xs text-sand-11">Selected: {{ linkForm.existing_patient_ref }}</p>
            <p v-if="linkForm.errors.existing_patient_ref" class="mt-1 text-xs text-red-600">{{ linkForm.errors.existing_patient_ref }}</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Relationship</label>
            <select v-model="linkForm.relationship_to_head" class="theme-field w-full rounded px-3 py-2">
              <option value="Member">Member</option>
              <option value="Head">Head</option>
            </select>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="close">Cancel</button>
            <ActionButton type="submit" variant="blue" :loading="linkForm.processing" loading-text="Linking…" :disabled="!linkForm.existing_patient_ref">Link</ActionButton>
          </div>
        </form>

        <!-- Transfer -->
        <form v-else-if="mode === 'transfer'" class="space-y-4" @submit.prevent="submitTransfer">
          <h3 class="text-base font-semibold">Transfer Member</h3>
          <div>
            <label class="mb-1 block text-sm font-medium">Target household</label>
            <input v-model="householdQuery" class="theme-field w-full rounded px-3 py-2" placeholder="Household ID or head…" />
            <ul v-if="householdResults.length" class="theme-surface mt-2 max-h-48 overflow-y-auto rounded">
              <li
                v-for="r in householdResults"
                :key="r.id"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-sand-3"
                :class="{ 'bg-blue-50': transferForm.target_household_id === r.id }"
                @click="pickHousehold(r)"
              >{{ r.text }}</li>
            </ul>
            <p v-if="transferForm.target_household_id" class="mt-1 text-xs text-sand-11">Selected: {{ transferForm.target_household_id }}</p>
            <p v-if="transferForm.errors.target_household_id" class="mt-1 text-xs text-red-600">{{ transferForm.errors.target_household_id }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="transferForm.transfer_as_head" type="checkbox" /> Transfer as head of target household
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" class="theme-icon-btn rounded px-4 py-2 text-sm" @click="close">Cancel</button>
            <ActionButton type="submit" variant="blue" :loading="transferForm.processing" loading-text="Transferring…" :disabled="!transferForm.target_household_id">Transfer</ActionButton>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
