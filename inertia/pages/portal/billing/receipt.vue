<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  payment: Record<string, any>
  invoice: Record<string, any> | null
  receipt: Record<string, any> | null
}>()

const receiptNumber = computed(() => props.receipt?.receipt_number ?? props.payment.id)

function money(value: number | string): string {
  return 'K ' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
function methodLabel(value: string | null): string {
  if (!value) return '—'
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function print() {
  window.print()
}
</script>

<template>
  <PortalLayout>
    <div class="max-w-md mx-auto">
      <Link href="/portal/billing" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">&larr; Billing</Link>
      <div class="rounded-xl theme-surface p-6 mt-3">
        <h1 class="text-xl font-bold">Payment Receipt</h1>
        <p class="text-xs text-neutral-500 mt-1">Receipt #{{ receiptNumber }}<br />{{ fmtDateTime(payment.paid_at) }}</p>

        <dl class="mt-6 text-sm divide-y divide-neutral-100">
          <div class="flex justify-between py-2"><dt>Patient</dt><dd>{{ patient.full_name }}</dd></div>
          <div class="flex justify-between py-2"><dt>Patient ID</dt><dd>{{ patient.patient_id }}</dd></div>
          <div v-if="invoice" class="flex justify-between py-2"><dt>Invoice</dt><dd>{{ invoice.invoice_number ?? ('#' + invoice.id) }}</dd></div>
          <div class="flex justify-between py-2"><dt>Payment method</dt><dd>{{ methodLabel(payment.payment_method) }}</dd></div>
        </dl>

        <p class="text-lg font-bold mt-4">Amount paid: {{ money(payment.amount) }}</p>
        <p class="text-[11px] text-neutral-400 mt-6">Thank you for your payment. Keep this receipt for your records.</p>

        <button type="button" @click="print" class="mt-6 w-full px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold">Print receipt</button>
      </div>
    </div>
  </PortalLayout>
</template>
