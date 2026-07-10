<script setup lang="ts">
import { computed } from 'vue'
import { router, useForm, usePage } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface HouseholdSummary {
  display_label: string
  location_label: string | null
  role_label: string | null
}
interface Member {
  id: number
  full_name: string
  patient_id: string
  relationship_to_head: string | null
  age: number | null
  household: HouseholdSummary | null
  can_view: boolean
  age_restricted: boolean
  is_viewing: boolean
}
interface DependentLink {
  id: number
  relationship: string | null
  can_view_records: boolean
  dependent: { id: number; full_name: string; patient_id: string }
  household: HouseholdSummary | null
  same_household: boolean
  is_viewing: boolean
}

const props = defineProps<{
  guardian: { id: number; full_name: string; patient_id: string }
  viewingPatient: { id: number; full_name: string }
  guardianHousehold: HouseholdSummary | null
  householdMembers: Member[]
  dependents: DependentLink[]
  isHouseholdHead: boolean
}>()

const page = usePage()
const errors = computed(() => (page.props as any).errors ?? {})

const form = useForm({
  patient_id: '',
  relationship: '',
  verification: '',
})

function submit() {
  form.post('/portal/dependents', { onSuccess: () => form.reset() })
}
function switchTo(id: number) {
  router.post(`/portal/dependents/switch/${id}`)
}
function clearContext() {
  router.post('/portal/dependents/clear')
}

function relLabel(rel: string | null): string {
  if (!rel) return ''
  return rel.toLowerCase() === 'head' ? 'Head of household' : rel.charAt(0).toUpperCase() + rel.slice(1)
}

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Sibling', 'Ward', 'Other']
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Dependents</h1>

    <div v-if="Object.keys(errors).length" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
      <ul class="list-disc list-inside"><li v-for="(msg, key) in errors" :key="key">{{ msg }}</li></ul>
    </div>

    <div v-if="viewingPatient.id !== guardian.id" class="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm">
      <p class="font-semibold text-blue-900">Currently viewing: {{ viewingPatient.full_name }}</p>
      <button type="button" @click="clearContext" class="mt-2 text-xs font-semibold text-blue-800 underline">Switch back to my records</button>
    </div>

    <div v-if="guardianHousehold" class="rounded-xl theme-surface p-4 mb-4">
      <h2 class="text-sm font-semibold mb-2">Your household</h2>
      <p class="text-sm font-semibold text-neutral-800">{{ guardianHousehold.display_label }}</p>
      <p v-if="guardianHousehold.location_label" class="text-xs text-neutral-500 mt-1">{{ guardianHousehold.location_label }}</p>
      <p v-if="isHouseholdHead" class="text-[11px] text-teal-600 mt-2">You are the head of this household and can view records for members aged 16 and under.</p>
      <p v-else class="text-[11px] text-neutral-400 mt-2">Household members registered at the clinic are listed below when you are the head of household.</p>
    </div>

    <div class="rounded-xl theme-surface p-4 mb-6">
      <h2 class="text-sm font-semibold mb-3">Household members</h2>
      <p v-if="!householdMembers.length" class="text-sm text-neutral-500">
        {{ guardianHousehold ? 'No other patients are linked to your household yet.' : 'Your patient profile is not linked to a household. Ask registration to add you to one.' }}
      </p>
      <div v-else class="grid grid-cols-2 gap-3">
        <div v-for="member in householdMembers" :key="member.id" class="theme-surface rounded-xl p-3 flex flex-col min-h-[9rem]">
          <p class="text-sm font-semibold leading-snug">{{ member.full_name }}</p>
          <p class="text-xs text-neutral-500 mt-1">{{ member.patient_id }}<span v-if="member.age !== null"> · {{ member.age }} yrs</span></p>
          <p v-if="member.relationship_to_head" class="text-[11px] text-neutral-400 mt-0.5">{{ relLabel(member.relationship_to_head) }}</p>
          <p v-if="member.household" class="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">{{ member.household.display_label }}</p>
          <div class="mt-auto pt-3">
            <template v-if="isHouseholdHead">
              <template v-if="member.can_view">
                <span v-if="member.is_viewing" class="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Viewing</span>
                <button v-else type="button" @click="switchTo(member.id)" class="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-teal-600 text-teal-700 hover:bg-teal-50 transition">View records</button>
              </template>
              <p v-else-if="member.age_restricted" class="text-[11px] text-amber-700 leading-snug">Health records are private for members over 16.</p>
            </template>
            <span v-else class="text-xs text-neutral-400">Clinic record</span>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-xl theme-surface mb-6 overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Other linked patients</h2></div>
      <div class="divide-y divide-neutral-100">
        <div class="px-4 py-3 flex items-center justify-between gap-3 bg-neutral-50">
          <div>
            <p class="text-sm font-semibold">{{ guardian.full_name }} <span class="text-xs font-normal text-neutral-500">(You)</span></p>
            <p class="text-xs text-neutral-500">{{ guardian.patient_id }}</p>
            <p v-if="guardianHousehold" class="text-[11px] text-neutral-400 mt-0.5">{{ guardianHousehold.role_label ?? 'Household member' }}</p>
          </div>
          <span v-if="viewingPatient.id === guardian.id" class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Active</span>
          <span v-else class="text-xs text-neutral-400">Your account</span>
        </div>

        <div v-for="link in dependents" :key="link.id" class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ link.dependent.full_name }}</p>
            <p class="text-xs text-neutral-500">{{ link.dependent.patient_id }}<span v-if="link.relationship"> · {{ relLabel(link.relationship) }}</span></p>
            <p v-if="link.household" class="text-[11px] text-neutral-400 mt-0.5">
              {{ link.household.display_label }}
              <span v-if="link.same_household" class="text-teal-600">· Same household as you</span>
            </p>
            <p v-else class="text-[11px] text-neutral-400 mt-0.5">No household on file</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="!link.can_view_records" class="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending approval</span>
            <span v-else-if="link.is_viewing" class="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Viewing</span>
            <button v-else type="button" @click="switchTo(link.dependent.id)" class="text-xs font-semibold text-neutral-700 underline">View records</button>
          </div>
        </div>
        <p v-if="!dependents.length" class="px-4 py-8 text-center text-sm text-neutral-500">No other links yet. Use the form below to request access to a patient outside your household.</p>
      </div>
    </div>

    <div class="rounded-xl theme-surface p-4">
      <h2 class="text-sm font-semibold mb-2">Add a dependent</h2>
      <p class="text-xs text-neutral-500 mb-4">
        Enter the dependent's Patient ID and confirm their identity with their NRC or date of birth. Access is granted once the hospital approves your request.
      </p>
      <form @submit.prevent="submit" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Patient ID</label>
            <input type="text" v-model="form.patient_id" required placeholder="e.g. P00TWO9CW" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-neutral-500 mb-1">Relationship</label>
            <select v-model="form.relationship" required class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg">
              <option value="" disabled>Select relationship</option>
              <option v-for="rel in RELATIONSHIPS" :key="rel" :value="rel">{{ rel }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Verify with NRC or date of birth</label>
          <input type="text" v-model="form.verification" required placeholder="NRC number or YYYY-MM-DD" class="theme-field w-full px-3 py-2 text-sm theme-surface rounded-lg" />
          <p class="text-[11px] text-neutral-400 mt-1">Must match the hospital's records for that Patient ID.</p>
        </div>
        <ActionButton type="submit" variant="primary" class="!px-5 !py-2.5 text-sm" :loading="form.processing" loading-text="Submitting…">Request access</ActionButton>
      </form>
    </div>
  </PortalLayout>
</template>
