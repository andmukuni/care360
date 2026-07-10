<script setup lang="ts">
import { reactive } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import ReceptionLayout from '~/layouts/ReceptionLayout.vue'

const props = defineProps<{
  todayRegistrations: number
  todayHouseholds: number
  todayShiftPatients: number
  recentRegistrations: any[]
  recentHouseholds: any[]
  shiftSummary: { shift_type: string; total_seen: number }[]
  results: any[]
  hasSearch: boolean
  searchBy: string
  queryValue: string
  firstName: string
  lastName: string
  dob: string
  gender: string
  totalRecords: number
}>()

const filters = reactive({
  search_by: props.searchBy,
  q: props.queryValue,
  first_name: props.firstName,
  last_name: props.lastName,
  dob: props.dob,
  gender: props.gender,
})

function runSearch() {
  router.get('/reception-dashboard', { ...filters }, { preserveState: true, preserveScroll: true })
}
</script>

<template>
  <ReceptionLayout>
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="theme-surface rounded-lg p-4">
        <div class="text-3xl font-bold">{{ todayRegistrations }}</div>
        <div class="text-sm text-sand-11">Registrations today</div>
      </div>
      <div class="theme-surface rounded-lg p-4">
        <div class="text-3xl font-bold">{{ todayHouseholds }}</div>
        <div class="text-sm text-sand-11">Households today</div>
      </div>
      <div class="theme-surface rounded-lg p-4">
        <div class="text-3xl font-bold">{{ todayShiftPatients }}</div>
        <div class="text-sm text-sand-11">Patients seen (shift)</div>
      </div>
    </div>

    <section class="theme-surface rounded-lg p-4 mb-6">
      <h2 class="font-medium mb-3">Find a patient</h2>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="runSearch">
        <select v-model="filters.search_by" class="theme-field rounded px-3 py-2 text-sm">
          <option value="nrc">NRC</option>
          <option value="barcode">Barcode / Patient ID</option>
          <option value="cellphone">Phone</option>
          <option value="full_name">Full name</option>
        </select>
        <template v-if="filters.search_by === 'full_name'">
          <input v-model="filters.first_name" placeholder="First name" class="theme-field rounded px-3 py-2 text-sm" />
          <input v-model="filters.last_name" placeholder="Last name" class="theme-field rounded px-3 py-2 text-sm" />
        </template>
        <template v-else>
          <input v-model="filters.q" placeholder="Search value" class="theme-field rounded px-3 py-2 text-sm" />
        </template>
        <button type="submit" class="rounded bg-primary px-4 py-2 text-sm text-white">Search</button>
      </form>

      <div v-if="hasSearch" class="mt-4">
        <p class="text-sm text-sand-11 mb-2">{{ totalRecords }} result(s)</p>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-sand-11 border-b border-sand-6">
              <th class="py-2">Patient ID</th><th>Name</th><th>NRC</th><th>Phone</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in results" :key="r.id" class="border-b border-sand-4">
              <td class="py-2">
                <Link :href="`/patients/${r.patient_id}`" class="text-blue-600 hover:underline">{{ r.patient_id }}</Link>
              </td>
              <td>{{ r.full_name }}</td>
              <td>{{ r.nrc_number }}</td>
              <td>{{ r.phone_number }}</td>
            </tr>
            <tr v-if="!results.length"><td colspan="4" class="py-4 text-center text-sand-11">No matches.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-6">
      <section class="theme-surface rounded-lg p-4">
        <h2 class="font-medium mb-3">Recent registrations</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="p in recentRegistrations" :key="p.patient_id" class="flex justify-between">
            <span>{{ p.full_name }}</span><span class="text-sand-11">{{ p.patient_id }}</span>
          </li>
        </ul>
      </section>
      <section class="theme-surface rounded-lg p-4">
        <h2 class="font-medium mb-3">Recent households</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="h in recentHouseholds" :key="h.household_id" class="flex justify-between">
            <span>{{ h.head_of_house }}</span><span class="text-sand-11">{{ h.household_id }}</span>
          </li>
        </ul>
      </section>
    </div>
  </ReceptionLayout>
</template>
