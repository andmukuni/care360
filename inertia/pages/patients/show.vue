<script setup lang="ts">
import { ref } from 'vue'
import { Link, router, useForm } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

interface NotificationItem {
  id: string
  type: string
  data: Record<string, any>
  readAt: string | null
  createdAt: string | null
}

const props = defineProps<{
  patient: Record<string, any>
  household: Record<string, any> | null
  recentEncounters: any[]
  householdMembers: any[]
  isRegistrationClerk: boolean
  canStartEncounter: boolean
  patientNotifications: NotificationItem[]
}>()

const notifications = ref<NotificationItem[]>([...props.patientNotifications])

const showPasswordForm = ref(false)

const passwordForm = useForm({
  password: '',
  password_confirmation: '',
})

function sendInvitation() {
  router.post(`/patients/${props.patient.patientId}/portal-invitation`, {}, { preserveScroll: true })
}

function submitPassword() {
  passwordForm.put(`/patients/${props.patient.patientId}/portal-password`, {
    preserveScroll: true,
    onSuccess: () => {
      passwordForm.reset()
      showPasswordForm.value = false
    },
  })
}

function readXsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function markRead(id: string) {
  await fetch(`/patients/${props.patient.patientId}/notifications/${id}/read`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': readXsrfToken(), 'Accept': 'application/json' },
  })
  const n = notifications.value.find((x) => x.id === id)
  if (n) n.readAt = new Date().toISOString()
}

async function markAllRead() {
  await fetch(`/patients/${props.patient.patientId}/notifications/read-all`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': readXsrfToken(), 'Accept': 'application/json' },
  })
  notifications.value.forEach((n) => (n.readAt = n.readAt ?? new Date().toISOString()))
}

function notificationText(n: NotificationItem): string {
  return String(n.data.message ?? n.data.title ?? n.type)
}
</script>

<template>
  <StaffLayout>
    <template #header>
      <h1 class="text-lg font-semibold">{{ patient.fullName }}</h1>
    </template>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="font-mono text-sm text-sand-11">{{ patient.patientId }}</span>
      <span
        class="rounded px-2 py-0.5 text-xs"
        :class="patient.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-sand-3 text-sand-11'"
      >{{ patient.status }}</span>
      <span v-if="patient.isDeceased" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Deceased</span>
      <div class="ml-auto flex gap-2">
        <Link :href="`/patients/${patient.patientId}/edit`" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Edit</Link>
        <Link v-if="!isRegistrationClerk" :href="`/patients/${patient.patientId}/encounters`" class="theme-icon-btn rounded px-3 py-1.5 text-sm">Encounters</Link>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <!-- Demographics -->
        <section class="theme-panel rounded-lg p-6">
          <h2 class="mb-4 text-sm font-semibold text-sand-11">Demographics</h2>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt class="text-sand-11">Gender</dt><dd>{{ patient.gender || '—' }}</dd></div>
            <div><dt class="text-sand-11">Date of Birth</dt><dd>{{ patient.dateOfBirth || '—' }}</dd></div>
            <div><dt class="text-sand-11">NRC</dt><dd>{{ patient.nrcNumber || '—' }}</dd></div>
            <div><dt class="text-sand-11">Phone</dt><dd>{{ patient.phoneNumber || '—' }}</dd></div>
            <div><dt class="text-sand-11">Email</dt><dd>{{ patient.email || '—' }}</dd></div>
            <div><dt class="text-sand-11">Barcode</dt><dd class="font-mono">{{ patient.barcode || '—' }}</dd></div>
            <div><dt class="text-sand-11">Marital Status</dt><dd>{{ patient.maritalStatus || '—' }}</dd></div>
            <div><dt class="text-sand-11">Home Language</dt><dd>{{ patient.homeLanguage || '—' }}</dd></div>
            <div><dt class="text-sand-11">Occupation</dt><dd>{{ patient.occupation || '—' }}</dd></div>
            <div><dt class="text-sand-11">Address</dt><dd>{{ patient.address || '—' }}</dd></div>
          </dl>
          <div v-if="!isRegistrationClerk" class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-sand-4 pt-4 text-sm">
            <div><dt class="text-sand-11">ART Number</dt><dd>{{ patient.artNumber || '—' }}</dd></div>
            <div><dt class="text-sand-11">NUPN</dt><dd>{{ patient.nupn || '—' }}</dd></div>
            <div><dt class="text-sand-11">Blood Group</dt><dd>{{ patient.bloodGroup || '—' }}</dd></div>
            <div><dt class="text-sand-11">Allergies</dt><dd>{{ patient.allergies || '—' }}</dd></div>
          </div>
        </section>

        <!-- Recent encounters -->
        <section v-if="!isRegistrationClerk" class="theme-panel rounded-lg p-6">
          <h2 class="mb-4 text-sm font-semibold text-sand-11">Recent Encounters</h2>
          <div v-if="recentEncounters.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-sand-11">
                <tr class="border-b border-sand-6">
                  <th class="py-2 pr-3">Encounter</th>
                  <th class="py-2 pr-3">Stage</th>
                  <th class="py-2 pr-3">Status</th>
                  <th class="py-2 pr-3">Started</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in recentEncounters" :key="e.id" class="border-b border-sand-4">
                  <td class="py-2 pr-3 font-mono">{{ e.encounter_number }}</td>
                  <td class="py-2 pr-3">{{ e.current_stage }}</td>
                  <td class="py-2 pr-3">{{ e.current_status }}</td>
                  <td class="py-2 pr-3">{{ e.started_at ? String(e.started_at).slice(0, 16).replace('T', ' ') : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-sand-11">No encounters recorded.</p>
        </section>
      </div>

      <div class="space-y-6">
        <!-- Household -->
        <section class="theme-panel rounded-lg p-6">
          <h2 class="mb-4 text-sm font-semibold text-sand-11">Household</h2>
          <div v-if="household">
            <Link :href="`/households/${household.householdId}`" class="text-blue-600 hover:underline">
              {{ household.headOfHouseName }}
            </Link>
            <p class="font-mono text-xs text-sand-11">{{ household.householdId }}</p>
          </div>
          <p v-else class="text-sm text-sand-11">Not linked to a household.</p>

          <ul v-if="householdMembers.length" class="mt-4 space-y-1 border-t border-sand-4 pt-3 text-sm">
            <li v-for="m in householdMembers" :key="m.patientId" class="flex justify-between">
              <span :class="m.isSelf ? 'font-medium' : ''">{{ m.fullName }}</span>
              <span class="text-xs text-sand-11">{{ m.relationshipToHead || 'Member' }}</span>
            </li>
          </ul>
        </section>

        <!-- Portal management -->
        <section v-if="!isRegistrationClerk" class="theme-panel rounded-lg p-6">
          <h2 class="mb-4 text-sm font-semibold text-sand-11">Patient Portal</h2>
          <p class="mb-3 text-sm">
            Status:
            <span :class="patient.email ? 'text-green-700' : 'text-sand-11'">
              {{ patient.email ? patient.email : 'No email on file' }}
            </span>
          </p>
          <div class="flex flex-col gap-2">
            <button type="button" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" @click="sendInvitation">
              Send Portal Invitation
            </button>
            <button type="button" class="theme-icon-btn rounded px-3 py-1.5 text-sm" @click="showPasswordForm = !showPasswordForm">
              Set Portal Password
            </button>
          </div>
          <form v-if="showPasswordForm" class="mt-3 space-y-2 border-t border-sand-4 pt-3" @submit.prevent="submitPassword">
            <input v-model="passwordForm.password" type="password" placeholder="New password" class="w-full rounded border border-sand-6 px-3 py-2 text-sm" />
            <p v-if="passwordForm.errors.password" class="text-xs text-red-600">{{ passwordForm.errors.password }}</p>
            <input v-model="passwordForm.password_confirmation" type="password" placeholder="Confirm password" class="w-full rounded border border-sand-6 px-3 py-2 text-sm" />
            <ActionButton type="submit" variant="primary" :loading="passwordForm.processing" loading-text="Saving…">Save</ActionButton>
          </form>
        </section>

        <!-- Notifications -->
        <section class="theme-panel rounded-lg p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-sand-11">Notifications</h2>
            <button v-if="notifications.length" type="button" class="text-xs text-blue-600 hover:underline" @click="markAllRead">
              Mark all read
            </button>
          </div>
          <ul v-if="notifications.length" class="space-y-2 text-sm">
            <li
              v-for="n in notifications"
              :key="n.id"
              class="flex items-start justify-between gap-2 rounded p-2"
              :class="n.readAt ? 'text-sand-11' : 'bg-blue-50'"
            >
              <span>{{ notificationText(n) }}</span>
              <button v-if="!n.readAt" type="button" class="shrink-0 text-xs text-blue-600 hover:underline" @click="markRead(n.id)">
                Read
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-sand-11">No notifications.</p>
        </section>
      </div>
    </div>
  </StaffLayout>
</template>
