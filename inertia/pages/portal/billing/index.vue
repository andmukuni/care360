<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'

interface Invoice {
  id: number
  invoice_number: string | null
  status: string
  issued_at: string | null
  total_amount: number
  balance_due: number
}
interface Payment {
  id: number
  amount: number
  paid_at: string | null
  payment_method: string | null
}

const props = defineProps<{
  patient: Record<string, any>
  invoices: { data: Invoice[]; meta: Record<string, any> }
  outstandingBalance: string
  recentPayments: Payment[]
}>()

const tab = ref<'invoices' | 'payments'>('invoices')

function money(value: number | string): string {
  return 'K ' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function methodLabel(value: string | null): string {
  if (!value) return '—'
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const outstanding = computed(() => money(props.outstandingBalance))
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-6">Billing</h1>

    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="p-4 rounded-xl theme-surface">
        <p class="text-2xl font-bold">{{ outstanding }}</p>
        <p class="text-xs font-semibold uppercase text-neutral-500 mt-1">Outstanding balance</p>
      </div>
      <button type="button" @click="tab = 'payments'" class="text-left p-4 rounded-xl theme-surface">
        <p class="text-2xl font-bold">{{ recentPayments.length }}</p>
        <p class="text-xs font-semibold uppercase text-neutral-500 mt-1">Recent payments</p>
      </button>
    </div>

    <div class="flex gap-1 p-1 rounded-xl bg-neutral-100 mb-4">
      <button type="button" @click="tab = 'invoices'"
              :class="['flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition', tab === 'invoices' ? 'bg-white shadow-sm' : 'text-neutral-500']">
        Invoices
      </button>
      <button type="button" @click="tab = 'payments'"
              :class="['flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition', tab === 'payments' ? 'bg-white shadow-sm' : 'text-neutral-500']">
        Recent payments
      </button>
    </div>

    <div v-show="tab === 'invoices'" class="theme-surface rounded-xl divide-y divide-neutral-100">
      <Link v-for="invoice in invoices.data" :key="invoice.id" :href="`/portal/billing/invoices/${invoice.id}`" class="block px-4 py-3 hover:bg-neutral-50">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ invoice.invoice_number ?? ('Invoice #' + invoice.id) }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">{{ fmtDate(invoice.issued_at) }} · {{ money(invoice.total_amount) }}</p>
          </div>
          <div class="text-right">
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">{{ invoice.status }}</span>
            <p v-if="Number(invoice.balance_due) > 0" class="text-xs font-semibold mt-1">Due {{ money(invoice.balance_due) }}</p>
          </div>
        </div>
      </Link>
      <p v-if="!invoices.data.length" class="px-4 py-8 text-center text-sm text-neutral-500">No invoices. Bills issued to you will appear here.</p>
    </div>

    <div v-show="tab === 'payments'" class="theme-surface rounded-xl divide-y divide-neutral-100">
      <div v-for="payment in recentPayments" :key="payment.id" class="px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">{{ money(payment.amount) }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">{{ fmtDate(payment.paid_at) }} · {{ methodLabel(payment.payment_method) }}</p>
        </div>
        <Link :href="`/portal/billing/payments/${payment.id}/receipt`" class="text-xs font-semibold text-neutral-600 underline shrink-0">Receipt</Link>
      </div>
      <p v-if="!recentPayments.length" class="px-4 py-8 text-center text-sm text-neutral-500">No payments yet.</p>
    </div>
  </PortalLayout>
</template>
