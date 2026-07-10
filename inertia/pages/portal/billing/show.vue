<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

const props = defineProps<{
  patient: Record<string, any>
  invoice: Record<string, any>
}>()

function money(value: number | string): string {
  return 'K ' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
</script>

<template>
  <PortalLayout>
    <div class="mb-6">
      <Link href="/portal/billing" class="text-xs font-semibold text-neutral-500 hover:text-neutral-900">&larr; Billing</Link>
      <h1 class="text-2xl font-bold mt-2">{{ invoice.invoice_number ?? 'Invoice' }}</h1>
      <div class="flex items-center gap-2 mt-2">
        <span class="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">{{ invoice.status }}</span>
        <span class="text-sm text-neutral-500">{{ fmtDate(invoice.issued_at) }}</span>
      </div>
    </div>

    <div class="rounded-xl theme-surface mb-4 overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Line items</h2></div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs uppercase text-neutral-500 border-b border-neutral-200">
            <tr>
              <th class="text-left px-4 py-2 font-semibold">Description</th>
              <th class="text-right px-4 py-2 font-semibold">Qty</th>
              <th class="text-right px-4 py-2 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            <tr v-for="line in (invoice.invoiceLines ?? [])" :key="line.id">
              <td class="px-4 py-2">{{ line.description }}</td>
              <td class="px-4 py-2 text-right">{{ line.quantity }}</td>
              <td class="px-4 py-2 text-right font-medium">{{ money(line.amount) }}</td>
            </tr>
            <tr v-if="!(invoice.invoiceLines ?? []).length">
              <td colspan="3" class="px-4 py-6 text-center text-neutral-500">No line items.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl theme-surface p-4 mb-4">
      <h2 class="text-sm font-semibold mb-3">Summary</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between"><dt class="text-neutral-500">Total</dt><dd class="font-semibold">{{ money(invoice.total_amount) }}</dd></div>
        <div class="flex justify-between"><dt class="text-neutral-500">Balance due</dt><dd class="font-bold text-lg">{{ money(invoice.balance_due) }}</dd></div>
        <div v-if="invoice.due_at" class="flex justify-between"><dt class="text-neutral-500">Due date</dt><dd>{{ fmtDate(invoice.due_at) }}</dd></div>
      </dl>
      <p v-if="invoice.notes" class="text-xs text-neutral-500 mt-4 whitespace-pre-line">{{ invoice.notes }}</p>
    </div>

    <div v-if="(invoice.payments ?? []).length" class="rounded-xl theme-surface overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Payments</h2></div>
      <div class="divide-y divide-neutral-100">
        <div v-for="payment in invoice.payments" :key="payment.id" class="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ money(payment.amount) }}</p>
            <p class="text-xs text-neutral-500">{{ fmtDate(payment.paid_at) }}</p>
          </div>
          <Link :href="`/portal/billing/payments/${payment.id}/receipt`" class="text-xs font-semibold underline">Download receipt</Link>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
