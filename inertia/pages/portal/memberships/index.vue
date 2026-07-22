<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import PortalLayout from '~/layouts/PortalLayout.vue'
import { confirmDialog } from '~/composables/useConfirm'

interface Plan {
  id: number
  name: string
  tier: number
  description: string | null
  minimum_deposit: number
  discount_percent: number
  perks: string | null
}
interface Account {
  id: number
  status: string
  membership_plan_id: number
  balance: number
  created_at: string | null
  membershipPlan?: Plan | null
}

const props = defineProps<{
  patient: Record<string, any>
  plans: Plan[]
  current: Account | null
  history: Account[]
}>()

const hasCurrent = computed(
  () => props.current && ['active', 'pending'].includes(props.current.status)
)

// Per-plan subscribe form selections.
const selections = reactive<Record<number, { billing_cycle: string; payment: string }>>({})
function selectionFor(id: number) {
  if (!selections[id]) selections[id] = { billing_cycle: 'monthly', payment: 'online' }
  return selections[id]
}

function money(value: number | string): string {
  return 'K ' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
function perkList(perks: string | null): string[] {
  if (!perks) return []
  try {
    const parsed = JSON.parse(perks)
    if (Array.isArray(parsed)) return parsed.map((p) => String(p))
  } catch {
    /* not JSON — fall through */
  }
  return perks.split(/\r?\n|,/).map((p) => p.trim()).filter(Boolean)
}
function isCurrentPlan(plan: Plan): boolean {
  return (
    !!props.current &&
    Number(props.current.membership_plan_id) === Number(plan.id) &&
    ['active', 'pending'].includes(props.current.status)
  )
}

function subscribe(plan: Plan) {
  router.post(`/portal/memberships/${plan.id}/subscribe`, { ...selectionFor(plan.id) })
}
async function cancel() {
  if (!props.current) return
  if (!(await confirmDialog('Cancel your membership?'))) return
  router.post(`/portal/memberships/subscriptions/${props.current.id}/cancel`)
}
</script>

<template>
  <PortalLayout>
    <h1 class="text-2xl font-bold mb-1">Membership</h1>
    <p class="text-sm text-neutral-500 mb-6">Subscribe to a plan for discounts and member perks.</p>

    <!-- Current subscription -->
    <div v-if="hasCurrent && current" class="mb-6 p-5 rounded-xl theme-surface">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Current plan</p>
          <h2 class="text-lg font-bold">{{ current.membershipPlan?.name ?? '—' }}</h2>
          <p class="text-xs text-neutral-500 mt-0.5">Balance {{ money(current.balance) }} · {{ cap(current.status) }}</p>
        </div>
        <span class="text-[11px] font-semibold px-2 py-1 rounded-full" :class="current.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">{{ cap(current.status) }}</span>
      </div>
      <p v-if="current.status === 'pending'" class="mt-3 text-xs text-amber-600">
        Your subscription is awaiting payment. Settle the invoice on your
        <Link href="/portal/billing" class="underline">Billing</Link> page to activate it.
      </p>
      <button type="button" @click="cancel" class="mt-4 text-xs font-semibold text-red-600 hover:underline">Cancel membership</button>
    </div>

    <!-- Available plans -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="plan in plans" :key="plan.id"
           class="rounded-xl bg-white border p-5 flex flex-col"
           :class="isCurrentPlan(plan) ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200'">
        <div class="flex items-center justify-between">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Tier {{ plan.tier }}</p>
          <span v-if="isCurrentPlan(plan) && current" class="text-[10px] font-semibold px-2 py-0.5 rounded-full" :class="current.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
            {{ current.status === 'active' ? 'Current plan' : 'Pending payment' }}
          </span>
        </div>
        <h3 class="text-lg font-bold">{{ plan.name }}</h3>
        <p class="mt-1 text-xs text-neutral-500">{{ plan.description }}</p>

        <div class="mt-4 flex items-baseline gap-2">
          <span class="text-2xl font-bold">{{ money(plan.minimum_deposit) }}</span>
          <span class="text-xs text-neutral-500">minimum deposit</span>
        </div>

        <ul class="mt-4 space-y-1.5 text-xs text-neutral-600 flex-1">
          <li v-if="Number(plan.discount_percent) > 0">✓ {{ Number(plan.discount_percent) }}% off services</li>
          <li v-for="perk in perkList(plan.perks)" :key="perk">✓ {{ perk }}</li>
        </ul>

        <div v-if="isCurrentPlan(plan) && current" class="mt-4">
          <Link v-if="current.status === 'pending'" href="/portal/billing" class="block text-center w-full px-3 py-2 rounded bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">Complete payment</Link>
          <div v-else class="w-full px-3 py-2 rounded bg-neutral-100 text-neutral-500 text-sm font-semibold text-center">Your current plan</div>
        </div>
        <form v-else @submit.prevent="subscribe(plan)" class="mt-4 space-y-2">
          <div class="flex gap-2 text-xs">
            <label class="flex-1">
              <span class="block text-neutral-500 mb-1">Billing</span>
              <select v-model="selectionFor(plan.id).billing_cycle" class="w-full rounded border border-neutral-300 bg-white px-2 py-1.5">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label class="flex-1">
              <span class="block text-neutral-500 mb-1">Payment</span>
              <select v-model="selectionFor(plan.id).payment" class="w-full rounded border border-neutral-300 bg-white px-2 py-1.5">
                <option value="online">Pay online</option>
                <option value="manual">Pay at clinic</option>
              </select>
            </label>
          </div>
          <button type="submit" class="w-full px-3 py-2 rounded bg-neutral-900 text-white text-sm font-semibold hover:opacity-90">
            {{ current ? 'Switch to this plan' : 'Subscribe' }}
          </button>
        </form>
      </div>
      <div v-if="!plans.length" class="col-span-full text-center text-sm text-neutral-500 py-10">
        Membership plans will appear here once published.
      </div>
    </div>

    <!-- History -->
    <div v-if="history.length" class="mt-6 rounded-xl theme-surface overflow-hidden">
      <div class="px-4 py-3 border-b border-neutral-100"><h2 class="text-sm font-semibold">Subscription history</h2></div>
      <div class="divide-y divide-neutral-100">
        <div v-for="h in history" :key="h.id" class="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ h.membershipPlan?.name ?? '—' }}</p>
            <p class="text-xs text-neutral-500">{{ fmtDate(h.created_at) }}</p>
          </div>
          <span class="text-[11px] font-semibold text-neutral-500 capitalize">{{ h.status }}</span>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
