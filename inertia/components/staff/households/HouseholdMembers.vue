<script setup lang="ts">
import { ref, watch } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface Member {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  phoneNumber: string
  nrcNumber: string
  relationshipToHead: string
}

const props = withDefaults(
  defineProps<{
    householdId: string
    members: Member[]
    embedded?: boolean
  }>(),
  { embedded: false }
)

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

async function setHead(m: Member) {
  if (!(await confirmDialog(`Set ${m.fullName} as head of house?`))) return
  router.post(`/households/${props.householdId}/members/${m.patientId}/set-head`, {}, { preserveScroll: true })
}
async function removeMember(m: Member) {
  if (!(await confirmDialog(`Remove ${m.fullName} from this household?`))) return
  router.delete(`/households/${props.householdId}/members/${m.patientId}`, { preserveScroll: true })
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

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}
</script>

<template>
  <div :class="embedded ? '' : 'theme-panel rounded-lg p-6'">
    <div class="sc">
      <div class="sc-hd">
        <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="sc-title">Household Members</span>
        <span class="ml-auto badge b-gray">{{ members.length }}</span>
        <button type="button" class="patient-action-btn text-xs" @click="openLink">Link Existing</button>
        <button type="button" class="patient-action-btn patient-action-btn--primary text-xs" @click="openAdd">Add Member</button>
      </div>

      <div v-if="members.length" class="overflow-x-auto">
        <table class="enc-table min-w-[760px]">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Relationship</th>
              <th>Phone</th>
              <th>NRC</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.patientId">
              <td>
                <div class="flex items-center gap-3">
                  <div class="hero-avatar !h-8 !w-8 !text-[10px] hero-avatar--household">
                    {{ memberInitials(m.fullName) }}
                  </div>
                  <div class="min-w-0">
                    <Link :href="`/patients/${m.patientId}`" class="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                      {{ m.fullName }}
                    </Link>
                    <p class="font-mono text-[11px] text-neutral-400">{{ m.patientId }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge" :class="m.relationshipToHead === 'Head' ? 'b-blue' : 'b-gray'">
                  {{ m.relationshipToHead || 'Member' }}
                </span>
              </td>
              <td>{{ m.phoneNumber || '—' }}</td>
              <td class="font-mono text-xs">{{ m.nrcNumber || '—' }}</td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2 text-xs">
                  <button type="button" class="text-blue-600 hover:underline" @click="openEdit(m)">Edit</button>
                  <button
                    v-if="m.relationshipToHead !== 'Head'"
                    type="button"
                    class="text-blue-600 hover:underline"
                    @click="setHead(m)"
                  >
                    Set Head
                  </button>
                  <button type="button" class="text-blue-600 hover:underline" @click="openTransfer(m)">Transfer</button>
                  <button type="button" class="text-red-600 hover:underline" @click="removeMember(m)">Remove</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="sc-bd">
        <div class="empty-state">
          <p>No members linked to this household yet.</p>
        </div>
      </div>
    </div>

    <div
      v-if="mode !== 'closed'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="close"
    >
      <div class="modal-panel w-full max-w-lg rounded-lg shadow-xl">
        <form v-if="mode === 'add' || mode === 'edit'" class="space-y-4 px-5 py-4" @submit.prevent="mode === 'add' ? submitAdd() : submitEdit()">
          <div class="theme-card-header -mx-5 -mt-4 mb-2 px-5 py-4">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {{ mode === 'add' ? 'Add Member' : 'Edit Member' }}
            </h3>
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Full Name *</label>
            <input v-model="memberForm.full_name" class="theme-field w-full rounded px-3 py-2 text-sm" />
            <p v-if="memberForm.errors.full_name" class="mt-1 text-xs text-red-600">{{ memberForm.errors.full_name }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Gender</label>
              <select v-model="memberForm.gender" class="theme-field w-full rounded px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Date of Birth</label>
              <input v-model="memberForm.date_of_birth" type="date" class="theme-field w-full rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Phone</label>
              <input v-model="memberForm.phone_number" class="theme-field w-full rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">NRC</label>
              <input v-model="memberForm.nrc_number" class="theme-field w-full rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Relationship</label>
              <select v-model="memberForm.relationship_to_head" class="theme-field w-full rounded px-3 py-2 text-sm">
                <option value="Member">Member</option>
                <option value="Head">Head</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="patient-action-btn" @click="close">Cancel</button>
            <ActionButton type="submit" variant="primary" :loading="memberForm.processing" loading-text="Saving…">Save</ActionButton>
          </div>
        </form>

        <form v-else-if="mode === 'link'" class="space-y-4 px-5 py-4" @submit.prevent="submitLink">
          <div class="theme-card-header -mx-5 -mt-4 mb-2 px-5 py-4">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">Link Existing Patient</h3>
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Search patient</label>
            <input v-model="patientQuery" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Name, ID, phone…" />
            <ul v-if="patientResults.length" class="theme-surface mt-2 max-h-48 overflow-y-auto rounded border border-neutral-200">
              <li
                v-for="r in patientResults"
                :key="r.id"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-neutral-50"
                :class="{ 'opacity-50': r.disabled, 'bg-blue-50': linkForm.existing_patient_ref === r.id }"
                @click="pickPatient(r)"
              >
                {{ r.text }}
              </li>
            </ul>
            <p v-if="linkForm.existing_patient_ref" class="mt-1 text-xs text-neutral-500">Selected: {{ linkForm.existing_patient_ref }}</p>
            <p v-if="linkForm.errors.existing_patient_ref" class="mt-1 text-xs text-red-600">{{ linkForm.errors.existing_patient_ref }}</p>
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Relationship</label>
            <select v-model="linkForm.relationship_to_head" class="theme-field w-full rounded px-3 py-2 text-sm">
              <option value="Member">Member</option>
              <option value="Head">Head</option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="patient-action-btn" @click="close">Cancel</button>
            <ActionButton type="submit" variant="primary" :loading="linkForm.processing" loading-text="Linking…" :disabled="!linkForm.existing_patient_ref">
              Link
            </ActionButton>
          </div>
        </form>

        <form v-else-if="mode === 'transfer'" class="space-y-4 px-5 py-4" @submit.prevent="submitTransfer">
          <div class="theme-card-header -mx-5 -mt-4 mb-2 px-5 py-4">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">Transfer Member</h3>
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Target household</label>
            <input v-model="householdQuery" class="theme-field w-full rounded px-3 py-2 text-sm" placeholder="Household ID or head…" />
            <ul v-if="householdResults.length" class="theme-surface mt-2 max-h-48 overflow-y-auto rounded border border-neutral-200">
              <li
                v-for="r in householdResults"
                :key="r.id"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-neutral-50"
                :class="{ 'bg-blue-50': transferForm.target_household_id === r.id }"
                @click="pickHousehold(r)"
              >
                {{ r.text }}
              </li>
            </ul>
            <p v-if="transferForm.target_household_id" class="mt-1 text-xs text-neutral-500">Selected: {{ transferForm.target_household_id }}</p>
            <p v-if="transferForm.errors.target_household_id" class="mt-1 text-xs text-red-600">{{ transferForm.errors.target_household_id }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="transferForm.transfer_as_head" type="checkbox" />
            Transfer as head of target household
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="patient-action-btn" @click="close">Cancel</button>
            <ActionButton type="submit" variant="primary" :loading="transferForm.processing" loading-text="Transferring…" :disabled="!transferForm.target_household_id">
              Transfer
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
