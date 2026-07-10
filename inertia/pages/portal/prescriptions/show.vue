<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

defineProps<{
  patient: Record<string, any>
  prescription: Record<string, any>
}>()

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function humanize(value: any): string {
  const s = String(value ?? '')
  return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : ''
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <Link href="/portal/prescriptions" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">← All prescriptions</Link>
      <div class="flex items-center gap-2 flex-wrap mt-2">
        <h1 class="text-2xl font-bold text-neutral-900">{{ prescription.prescriptionNumber ?? 'Prescription' }}</h1>
        <span v-if="prescription.status" class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
          {{ humanize(prescription.status) }}
        </span>
      </div>
      <p class="text-xs text-neutral-500 mt-1.5">
        Prescribed {{ fmtDateTime(prescription.prescribedAt) }}
        <template v-if="prescription.prescribedByUser"> · {{ prescription.prescribedByUser.name }}</template>
        <template v-if="prescription.encounter"> · {{ prescription.encounter.encounterNumber }}</template>
      </p>
    </div>

    <div v-if="prescription.notes" class="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
      <span class="font-semibold">Note:</span> {{ prescription.notes }}
    </div>

    <div class="theme-surface rounded-xl overflow-hidden mb-4">
      <div class="px-4 py-3 border-b border-neutral-100">
        <h2 class="text-sm font-bold text-neutral-900">Medications</h2>
      </div>
      <div class="divide-y divide-neutral-100">
        <div v-for="item in prescription.pharmacyPrescriptionItems ?? []" :key="item.id" class="px-4 py-3">
          <p class="text-sm font-semibold text-neutral-900">
            {{ item.drugName }}
            <span v-if="item.strength || item.formulation" class="text-neutral-400 font-normal">
              ({{ [item.strength, item.formulation].filter(Boolean).join(' ') }})
            </span>
          </p>
          <p class="text-xs text-neutral-500 mt-0.5">
            <template v-if="item.dose">Dose {{ item.dose }}</template>
            <template v-if="item.frequency"> · {{ item.frequency }}x {{ item.frequencyUnit ?? 'daily' }}</template>
            <template v-if="item.duration"> · {{ item.duration }} {{ item.durationUnit }}</template>
            <template v-if="item.quantityPrescribed"> · Qty {{ item.quantityPrescribed }}</template>
            <template v-if="item.route"> · {{ item.route }}</template>
          </p>
          <p v-if="item.instructions" class="text-xs text-neutral-600 mt-1">
            <span class="font-semibold">Instructions:</span> {{ item.instructions }}
          </p>
        </div>
        <p v-if="!(prescription.pharmacyPrescriptionItems ?? []).length" class="px-4 py-8 text-sm text-neutral-500 text-center">
          No medications on this prescription
        </p>
      </div>
    </div>

    <div v-for="dispense in prescription.pharmacyDispenses ?? []" :key="dispense.id"
         class="theme-surface rounded-xl overflow-hidden mb-4">
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <h2 class="text-sm font-semibold text-neutral-900">Dispensed</h2>
        <span class="text-xs font-medium text-neutral-400">{{ fmtDateTime(dispense.dispensedAt) }}</span>
      </div>
      <div class="p-4 space-y-3">
        <p v-if="dispense.counselingNotes" class="text-sm text-neutral-700">
          <span class="font-semibold text-xs uppercase text-neutral-500">Counseling:</span> {{ dispense.counselingNotes }}
        </p>
        <p v-if="dispense.dispensingNotes" class="text-xs text-neutral-500">{{ dispense.dispensingNotes }}</p>
        <ul v-if="(dispense.pharmacyDispenseItems ?? []).length" class="text-sm space-y-1.5">
          <li v-for="dItem in dispense.pharmacyDispenseItems" :key="dItem.id" class="text-neutral-700">
            <span class="font-medium">{{ dItem.drugName }}</span>
            <template v-if="dItem.quantityDispensed"> · Qty {{ dItem.quantityDispensed }}</template>
            <span v-if="dItem.instructions" class="block text-xs text-neutral-500 mt-0.5">
              <span class="font-semibold">Instructions:</span> {{ dItem.instructions }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </PortalLayout>
</template>
