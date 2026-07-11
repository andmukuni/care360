<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import JsBarcode from 'jsbarcode'
import StaffLayout from '~/layouts/StaffLayout.vue'
import HouseholdMembers from '~/components/staff/households/HouseholdMembers.vue'

interface Member {
  patientId: string
  fullName: string
  gender: string
  dateOfBirth: string | null
  phoneNumber: string
  nrcNumber: string
  relationshipToHead: string
}

type TabId = 'overview' | 'subscription' | 'members' | 'barcode'

const props = defineProps<{
  household: Record<string, any>
  members: Member[]
  membersTotal: number
}>()

const tab = ref<TabId>('overview')
const barcodeSvgRef = ref<SVGSVGElement | null>(null)

const tabs = computed(() => [
  {
    id: 'overview' as TabId,
    label: 'Overview',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'subscription' as TabId,
    label: 'Subscription & Payment',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    id: 'members' as TabId,
    label: 'Members',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    count: props.membersTotal,
  },
  {
    id: 'barcode' as TabId,
    label: 'Barcode',
    icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  },
])

const initials = computed(() => {
  const parts = String(props.household.headOfHouseName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'H'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
})

const locationLabel = computed(() => {
  const parts = [props.household.village, props.household.town].map((v) => String(v ?? '').trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
})

const headCount = computed(() => props.members.filter((m) => m.relationshipToHead === 'Head').length)

const headExtraction = computed(() => {
  const headName = String(props.household.headOfHouseName ?? '').trim()
  if (headName === '' || headName === '—') {
    return { status: 'missing', label: 'Missing head', class: 'b-red' }
  }
  const hasPatient = props.members.some(
    (m) => m.fullName.trim().toLowerCase() === headName.toLowerCase()
  )
  if (hasPatient) {
    return { status: 'extracted', label: 'Head extracted', class: 'b-green' }
  }
  return { status: 'pending', label: 'Not extracted', class: 'b-amber' }
})

const paymentBadgeClass = computed(() => {
  const status = String(props.household.paymentStatus ?? '').toLowerCase()
  return status === 'active' ? 'b-green' : 'b-gray'
})

const summaryItems = computed(() => [
  {
    label: 'Head of House',
    ok: display(props.household.headOfHouseName) !== '—',
    detail: display(props.household.headOfHouseName),
  },
  {
    label: 'Head Extraction',
    ok: headExtraction.value.status === 'extracted',
    detail: headExtraction.value.label,
  },
  {
    label: 'Members',
    ok: props.membersTotal > 0,
    detail: props.membersTotal > 0 ? `${props.membersTotal} linked patient(s)` : 'No members linked',
  },
  {
    label: 'Payment',
    ok: String(props.household.paymentStatus ?? '').toLowerCase() === 'active',
    detail: display(props.household.paymentStatus),
  },
])

function display(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  return text === '' ? '—' : text
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFee(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function extractHead() {
  router.post(`/households/${props.household.householdId}/extract-head-patient`, {}, { preserveScroll: true })
}

function printBarcode() {
  window.print()
}

function renderBarcode() {
  const node = barcodeSvgRef.value
  const value = String(props.household.barcode ?? props.household.householdId ?? '').trim()
  if (!node || !value) return
  try {
    JsBarcode(node, value, {
      format: 'CODE128',
      width: 2.2,
      height: 55,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    node.innerHTML = ''
  }
}

onMounted(() => {
  if (tab.value === 'barcode') renderBarcode()
})

watch(tab, (next) => {
  if (next === 'barcode') setTimeout(renderBarcode, 0)
})
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <Link href="/households" class="transition hover:text-neutral-700 dark:hover:text-neutral-200">Households</Link>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ household.headOfHouseName }}</span>
    </template>

    <div class="hero-card mb-5">
      <div class="hero-top">
        <div class="hero-avatar hero-avatar--household">{{ initials }}</div>

        <div class="min-w-0 flex-1">
          <div class="hero-name">{{ household.headOfHouseName }}</div>
          <div class="hero-sub">
            <span>{{ household.householdId }}</span>
            <span v-if="display(household.phoneNumber) !== '—'">{{ household.phoneNumber }}</span>
            <span v-if="display(household.nrcNumber) !== '—'">NRC {{ household.nrcNumber }}</span>
            <span v-if="locationLabel !== '—'">{{ locationLabel }}</span>
          </div>
          <div class="hero-badges">
            <span class="badge b-black font-mono text-xs">{{ household.householdId }}</span>
            <span class="badge" :class="paymentBadgeClass">{{ household.paymentStatus }}</span>
            <span class="badge" :class="headExtraction.class">{{ headExtraction.label }}</span>
            <span v-if="display(household.barcode) !== '—'" class="badge b-gray font-mono text-[10px]">
              {{ household.barcode }}
            </span>
            <span v-if="membersTotal > 0" class="badge b-blue">{{ membersTotal }} Member{{ membersTotal === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <div class="flex-shrink-0 text-right text-xs text-neutral-500 dark:text-neutral-400">
          <div class="mb-1 text-[10px] font-semibold uppercase">Registered</div>
          <div class="font-semibold text-neutral-700 dark:text-neutral-200">{{ formatDate(household.createdAt) }}</div>
        </div>
      </div>

      <div class="patient-stats-strip">
        <div class="patient-stat-cell">
          <div class="patient-stat-val">{{ membersTotal }}</div>
          <div class="patient-stat-lbl">Members</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val" :class="headCount > 0 ? 'text-green-600' : 'text-amber-500'">{{ headCount }}</div>
          <div class="patient-stat-lbl">Head Recorded</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val text-sm font-semibold">{{ display(household.paymentStatus) }}</div>
          <div class="patient-stat-lbl">Payment</div>
        </div>
        <div class="patient-stat-cell">
          <div class="patient-stat-val truncate text-sm font-semibold">{{ locationLabel }}</div>
          <div class="patient-stat-lbl">Location</div>
        </div>
      </div>

      <div class="patient-action-row">
        <button type="button" class="patient-action-btn patient-action-btn--primary" @click="extractHead">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Extract Head as Patient
        </button>
        <Link href="/households/barcodes/print" class="patient-action-btn">Print Barcodes</Link>
        <Link
          :href="`/patients/create?household_id=${household.householdId}`"
          class="patient-action-btn"
        >
          Create Patient
        </Link>
        <Link href="/households" class="patient-action-btn">Back to Registry</Link>
      </div>
    </div>

    <div class="space-y-4">
      <div class="stage-tab-nav-sticky">
        <nav class="enc-tab-nav">
          <button
            v-for="tb in tabs"
            :key="tb.id"
            type="button"
            class="enc-tab-btn"
            :class="{ active: tab === tb.id }"
            @click="tab = tb.id"
          >
            <svg class="h-[13px] w-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tb.icon" />
            </svg>
            {{ tb.label }}
            <span
              v-if="tb.count"
              class="ml-1 rounded-full bg-neutral-600 px-1.5 py-0.5 text-[10px] text-white"
            >
              {{ tb.count }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Overview -->
      <div class="enc-panel" :class="{ active: tab === 'overview' }">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span class="sc-title">Household Identity</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item"><label>Household ID</label><span class="font-mono font-semibold">{{ household.householdId }}</span></div>
                <div class="kv-item"><label>Head of House</label><span class="font-semibold">{{ household.headOfHouseName }}</span></div>
                <div class="kv-item"><label>Phone</label><span>{{ display(household.phoneNumber) }}</span></div>
                <div class="kv-item"><label>NRC Number</label><span class="font-mono">{{ display(household.nrcNumber) }}</span></div>
                <div class="kv-item"><label>Household Type</label><span>{{ display(household.householdType) }}</span></div>
                <div class="kv-item"><label>Registered On</label><span>{{ formatDate(household.createdAt) }}</span></div>
                <div class="kv-item"><label>Barcode</label><span class="font-mono">{{ display(household.barcode) }}</span></div>
              </div>
            </div>
          </div>

          <div class="sc">
            <div class="sc-hd">
              <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="sc-title">Location</span>
            </div>
            <div class="sc-bd">
              <div class="kv">
                <div class="kv-item"><label>Village</label><span>{{ display(household.village) }}</span></div>
                <div class="kv-item"><label>Town</label><span>{{ display(household.town) }}</span></div>
                <div class="kv-item kv-w"><label>Full Location</label><span>{{ locationLabel }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="item in summaryItems" :key="item.label" class="sc !mb-0">
            <div class="sc-bd !py-3">
              <div class="flex items-start gap-3">
                <div
                  class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs"
                  :class="item.ok ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'"
                >
                  <svg v-if="item.ok" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p class="text-[10px] font-bold uppercase text-neutral-500">{{ item.label }}</p>
                  <p class="mt-0.5 text-xs leading-tight text-neutral-700">{{ item.detail }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="members.length" class="sc mt-4">
          <div class="sc-hd">
            <span class="sc-title">Recent Members</span>
            <button type="button" class="ml-auto text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-800" @click="tab = 'members'">
              Manage members →
            </button>
          </div>
          <div>
            <Link
              v-for="member in members.slice(0, 5)"
              :key="member.patientId"
              :href="`/patients/${member.patientId}`"
              class="patient-enc-row"
            >
              <div class="patient-enc-num">{{ member.patientId }}</div>
              <div class="patient-enc-info">
                <div class="patient-enc-diag">{{ member.fullName }}</div>
                <div class="patient-enc-meta">
                  {{ display(member.gender) }}
                  <template v-if="display(member.phoneNumber) !== '—'"> · {{ member.phoneNumber }}</template>
                </div>
              </div>
              <span class="badge" :class="member.relationshipToHead === 'Head' ? 'b-blue' : 'b-gray'">
                {{ member.relationshipToHead || 'Member' }}
              </span>
              <div class="patient-enc-date">{{ formatDate(member.dateOfBirth) }}</div>
            </Link>
          </div>
        </div>
      </div>

      <!-- Subscription -->
      <div class="enc-panel" :class="{ active: tab === 'subscription' }">
        <div class="sc">
          <div class="sc-hd">
            <svg class="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span class="sc-title">Subscription & Payment</span>
            <span class="ml-auto badge" :class="paymentBadgeClass">{{ household.paymentStatus }}</span>
          </div>
          <div class="sc-bd">
            <div class="kv">
              <div class="kv-item"><label>Subscription Plan</label><span>{{ display(household.subscriptionPlan) }}</span></div>
              <div class="kv-item"><label>Subscription Fee</label><span>{{ formatFee(household.subscriptionFee) }}</span></div>
              <div class="kv-item"><label>Payment Method</label><span>{{ display(household.paymentMethod) }}</span></div>
              <div class="kv-item"><label>Payment Status</label><span>{{ display(household.paymentStatus) }}</span></div>
              <div class="kv-item"><label>Transaction Code</label><span class="font-mono">{{ display(household.transactionCode) }}</span></div>
              <div class="kv-item"><label>Household Type</label><span>{{ display(household.householdType) }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Members -->
      <div class="enc-panel" :class="{ active: tab === 'members' }">
        <HouseholdMembers :household-id="household.householdId" :members="members" embedded />
      </div>

      <!-- Barcode -->
      <div class="enc-panel" :class="{ active: tab === 'barcode' }">
        <div v-if="display(household.barcode) !== '—' || household.householdId" class="sc">
          <div class="sc-hd">
            <span class="sc-title">Household Barcode</span>
            <button type="button" class="patient-action-btn ml-auto text-xs" @click="printBarcode">Print Barcode</button>
          </div>
          <div class="sc-bd flex flex-col items-center py-8">
            <div id="patient-barcode-printable" class="patient-barcode-label">
              <p class="patient-barcode-label__name">{{ household.headOfHouseName }}</p>
              <p v-if="display(household.phoneNumber) !== '—'" class="patient-barcode-label__name !mb-2 !font-normal !text-[11px]">
                Phone: {{ household.phoneNumber }}
              </p>
              <svg ref="barcodeSvgRef" />
              <p class="patient-barcode-label__value">{{ household.barcode || household.householdId }}</p>
            </div>
            <p class="mt-4 text-xs text-neutral-400">Use CODE128 scanner to look up this household</p>
          </div>
        </div>
        <div v-else class="sc">
          <div class="sc-bd">
            <div class="empty-state">
              <p>No barcode assigned to this household.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>
