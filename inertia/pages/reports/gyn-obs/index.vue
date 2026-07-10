<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'

interface UpcomingDelivery {
  full_name: string
  patient_ref: string
  gravida: number | null
  para: number | null
  expected_delivery_date: string | null
  last_menstrual_period: string | null
  encounter_id: number | null
}

defineProps<{
  cervicalSummary: Record<string, number>
  cervicalMonthPivot: Record<string, Record<string, number>>
  allCervicalResults: string[]
  contraceptiveSummary: Record<string, number>
  contraceptiveDistribution: { method: string | null; total: number }[]
  antenatalSummary: Record<string, number | null>
  upcomingDeliveries: UpcomingDelivery[]
  gravidaParaTrend: { month: string; avg_gravida: number; avg_para: number; total_records: number }[]
}>()

function label(key: string | number) {
  const s = String(key)
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}
</script>

<template>
  <StaffLayout>
    <template #header><h1 class="text-lg font-semibold">Gyn &amp; OBS Dashboard</h1></template>

    <div class="mb-4">
      <Link href="/reports" class="text-sm text-blue-600 hover:underline">← Back to reports</Link>
    </div>

    <!-- Summary cards -->
    <div class="mb-6 grid gap-4 md:grid-cols-3">
      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-3 text-sm font-semibold">Cervical screening</h3>
        <dl class="space-y-1 text-sm">
          <div v-for="(v, k) in cervicalSummary" :key="k" class="flex justify-between">
            <dt class="text-sand-11">{{ label(k) }}</dt>
            <dd class="font-medium">{{ v }}</dd>
          </div>
        </dl>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-3 text-sm font-semibold">Contraceptive</h3>
        <dl class="space-y-1 text-sm">
          <div v-for="(v, k) in contraceptiveSummary" :key="k" class="flex justify-between">
            <dt class="text-sand-11">{{ label(k) }}</dt>
            <dd class="font-medium">{{ v }}</dd>
          </div>
        </dl>
      </div>
      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-3 text-sm font-semibold">Antenatal</h3>
        <dl class="space-y-1 text-sm">
          <div v-for="(v, k) in antenatalSummary" :key="k" class="flex justify-between">
            <dt class="text-sand-11">{{ label(k) }}</dt>
            <dd class="font-medium">{{ v ?? '—' }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Cervical outcomes by month -->
      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-3 text-sm font-semibold">Cervical outcomes by month</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-sand-6 text-left text-sand-11">
                <th class="px-2 py-1.5 font-medium">Month</th>
                <th v-for="r in allCervicalResults" :key="r" class="px-2 py-1.5 text-right font-medium">{{ label(r) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(results, month) in cervicalMonthPivot" :key="month" class="border-b border-sand-4">
                <td class="px-2 py-1.5">{{ month }}</td>
                <td v-for="r in allCervicalResults" :key="r" class="px-2 py-1.5 text-right">{{ results[r] ?? 0 }}</td>
              </tr>
              <tr v-if="!Object.keys(cervicalMonthPivot).length">
                <td :colspan="allCervicalResults.length + 1" class="px-2 py-4 text-center text-sand-11">No data.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Contraceptive distribution -->
      <div class="theme-panel rounded-lg p-4">
        <h3 class="mb-3 text-sm font-semibold">Contraceptive method distribution</h3>
        <ul class="space-y-1 text-sm">
          <li v-for="row in contraceptiveDistribution" :key="row.method ?? 'none'" class="flex justify-between">
            <span class="text-sand-11">{{ row.method ?? 'Unspecified' }}</span>
            <span class="font-medium">{{ row.total }}</span>
          </li>
          <li v-if="!contraceptiveDistribution.length" class="text-center text-sand-11">No data.</li>
        </ul>
      </div>
    </div>

    <!-- Upcoming deliveries -->
    <div class="mt-6 theme-panel rounded-lg p-4">
      <h3 class="mb-3 text-sm font-semibold">Upcoming deliveries</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-sand-6 text-left text-sand-11">
              <th class="px-2 py-1.5 font-medium">Patient</th>
              <th class="px-2 py-1.5 font-medium">Ref</th>
              <th class="px-2 py-1.5 text-right font-medium">Gravida</th>
              <th class="px-2 py-1.5 text-right font-medium">Para</th>
              <th class="px-2 py-1.5 font-medium">EDD</th>
              <th class="px-2 py-1.5 font-medium">LMP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in upcomingDeliveries" :key="`${d.patient_ref}-${d.expected_delivery_date}`" class="border-b border-sand-4">
              <td class="px-2 py-1.5">{{ d.full_name }}</td>
              <td class="px-2 py-1.5">{{ d.patient_ref }}</td>
              <td class="px-2 py-1.5 text-right">{{ d.gravida ?? '—' }}</td>
              <td class="px-2 py-1.5 text-right">{{ d.para ?? '—' }}</td>
              <td class="px-2 py-1.5">{{ d.expected_delivery_date ?? '—' }}</td>
              <td class="px-2 py-1.5">{{ d.last_menstrual_period ?? '—' }}</td>
            </tr>
            <tr v-if="!upcomingDeliveries.length">
              <td colspan="6" class="px-2 py-4 text-center text-sand-11">No upcoming deliveries.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </StaffLayout>
</template>
