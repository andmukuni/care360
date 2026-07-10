<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import type { Chart as ChartInstance } from 'chart.js'
import StatCard from '~/components/StatCard.vue'
import StageQueueCard from '~/components/StageQueueCard.vue'
import StaffLayout from '~/layouts/StaffLayout.vue'
import { isDarkMode, THEME_CHANGE_EVENT } from '~/composables/useTheme'

interface EncounterRow {
  id: number
  encounter_number: string
  current_stage: string
  current_status: string
  priority_level: string | null
  visit_type: string | null
  started_at: string | null
  full_name: string
  patient_code: string
}

interface InsightFlash {
  id: string
  eyebrow: string
  headline: string
  detail: string
  metric?: string
  tone: 'teal' | 'sky' | 'amber' | 'rose' | 'violet' | 'emerald' | 'neutral'
  href?: string
}

const props = defineProps<{
  isRegistrationClerk?: boolean
  totalPatients: number
  totalHouseholds: number
  activePatients: number
  todayShiftPatients: number
  encounterStageCounts: Record<string, number>
  recentEncounters: EncounterRow[]
  encounterTrendLabels: string[]
  encounterTrendValues: number[]
  insightFlashes?: InsightFlash[]
}>()

const page = usePage()
const clinicName = computed(
  () => ((page.props as any).clinic?.name as string | undefined) || 'International Hospital Zambia'
)

const flashes = computed(() => props.insightFlashes ?? [])
const flashIndex = ref(0)
const flashPaused = ref(false)
let flashTimer: ReturnType<typeof setInterval> | null = null

const currentFlash = computed(() => flashes.value[flashIndex.value] ?? null)

const toneClasses: Record<
  InsightFlash['tone'],
  { card: string; header: string; chip: string; metric: string; metricBox: string; link: string; bar: string }
> = {
  teal: {
    card: 'border-teal-200 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/40',
    header: 'border-teal-100/80 dark:border-teal-900/50',
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
    metric: 'text-teal-800 dark:text-teal-200',
    metricBox: 'bg-white/70 dark:bg-teal-950/50',
    link: 'text-teal-800 dark:text-teal-300',
    bar: 'bg-teal-600',
  },
  sky: {
    card: 'border-sky-200 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40',
    header: 'border-sky-100/80 dark:border-sky-900/50',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    metric: 'text-sky-800 dark:text-sky-200',
    metricBox: 'bg-white/70 dark:bg-sky-950/50',
    link: 'text-sky-800 dark:text-sky-300',
    bar: 'bg-sky-600',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
    header: 'border-amber-100/80 dark:border-amber-900/50',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    metric: 'text-amber-800 dark:text-amber-200',
    metricBox: 'bg-white/70 dark:bg-amber-950/50',
    link: 'text-amber-900 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  rose: {
    card: 'border-rose-200 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40',
    header: 'border-rose-100/80 dark:border-rose-900/50',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    metric: 'text-rose-800 dark:text-rose-200',
    metricBox: 'bg-white/70 dark:bg-rose-950/50',
    link: 'text-rose-800 dark:text-rose-300',
    bar: 'bg-rose-600',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40',
    header: 'border-violet-100/80 dark:border-violet-900/50',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    metric: 'text-violet-800 dark:text-violet-200',
    metricBox: 'bg-white/70 dark:bg-violet-950/50',
    link: 'text-violet-800 dark:text-violet-300',
    bar: 'bg-violet-600',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40',
    header: 'border-emerald-100/80 dark:border-emerald-900/50',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    metric: 'text-emerald-800 dark:text-emerald-200',
    metricBox: 'bg-white/70 dark:bg-emerald-950/50',
    link: 'text-emerald-800 dark:text-emerald-300',
    bar: 'bg-emerald-600',
  },
  neutral: {
    card: 'border-neutral-200 bg-neutral-50 dark:border-white/[0.08] dark:bg-neutral-900',
    header: 'border-neutral-100 dark:border-white/[0.05]',
    chip: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    metric: 'text-neutral-800 dark:text-neutral-200',
    metricBox: 'bg-white/70',
    link: 'text-neutral-700 dark:text-neutral-300',
    bar: 'bg-neutral-500',
  },
}

function nextFlash() {
  if (!flashes.value.length) return
  flashIndex.value = (flashIndex.value + 1) % flashes.value.length
}

function prevFlash() {
  if (!flashes.value.length) return
  flashIndex.value = (flashIndex.value - 1 + flashes.value.length) % flashes.value.length
}

function goToFlash(i: number) {
  flashIndex.value = i
}

function startFlashTimer() {
  stopFlashTimer()
  if (flashes.value.length <= 1) return
  flashTimer = setInterval(() => {
    if (!flashPaused.value) nextFlash()
  }, 6500)
}

function stopFlashTimer() {
  if (flashTimer) {
    clearInterval(flashTimer)
    flashTimer = null
  }
}

watch(flashes, () => {
  flashIndex.value = 0
  startFlashTimer()
})

const stageTitleClass: Record<string, string> = {
  registration: 'text-sky-600 dark:text-sky-400',
  triage: 'text-amber-600 dark:text-amber-400',
  screening: 'text-violet-600 dark:text-violet-400',
  lab: 'text-cyan-600 dark:text-cyan-400',
  screening_review: 'text-rose-600 dark:text-rose-400',
  pharmacy: 'text-emerald-600 dark:text-emerald-400',
  completed: 'text-neutral-600 dark:text-neutral-400',
}

const encountersChartRef = ref<HTMLCanvasElement | null>(null)
const stagesChartRef = ref<HTMLCanvasElement | null>(null)
let encountersChart: ChartInstance | null = null
let stagesChart: ChartInstance | null = null

function chartThemeForMode(isDark: boolean) {
  return isDark
    ? {
        textColor: '#e5e7eb',
        gridColor: 'rgba(148, 163, 184, 0.28)',
        lineStroke: '#22d3ee',
        lineFillStart: 'rgba(34, 211, 238, 0.30)',
        lineFillEnd: 'rgba(34, 211, 238, 0.02)',
        pointColor: '#67e8f9',
        pointBorder: '#082f49',
        tooltipBg: '#0b1220',
        tooltipBorder: 'rgba(34, 211, 238, 0.45)',
        tooltipTitle: '#f8fafc',
        tooltipBody: '#e2e8f0',
      }
    : {
        textColor: '#3f3f46',
        gridColor: 'rgba(113, 113, 122, 0.20)',
        lineStroke: '#0f766e',
        lineFillStart: 'rgba(15, 118, 110, 0.22)',
        lineFillEnd: 'rgba(15, 118, 110, 0.03)',
        pointColor: '#14b8a6',
        pointBorder: '#ffffff',
        tooltipBg: '#111827',
        tooltipBorder: 'rgba(17, 24, 39, 0.3)',
        tooltipTitle: '#ffffff',
        tooltipBody: '#f3f4f6',
      }
}

function destroyCharts() {
  encountersChart?.destroy()
  stagesChart?.destroy()
  encountersChart = null
  stagesChart = null
}

function buildCharts() {
  destroyCharts()

  const chartTheme = chartThemeForMode(isDarkMode())
  Chart.defaults.color = chartTheme.textColor
  Chart.defaults.borderColor = chartTheme.gridColor
  Chart.defaults.font.family =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  if (encountersChartRef.value) {
    encountersChart = new Chart(encountersChartRef.value, {
      type: 'line',
      data: {
        labels: props.encounterTrendLabels,
        datasets: [
          {
            label: 'Encounters',
            data: props.encounterTrendValues,
            borderColor: chartTheme.lineStroke,
            backgroundColor: (context) => {
              const chart = context.chart
              const { ctx, chartArea } = chart
              if (!chartArea) return chartTheme.lineFillStart
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
              gradient.addColorStop(0, chartTheme.lineFillStart)
              gradient.addColorStop(1, chartTheme.lineFillEnd)
              return gradient
            },
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: chartTheme.pointColor,
            pointBorderColor: chartTheme.pointBorder,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 2000, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartTheme.tooltipBg,
            borderColor: chartTheme.tooltipBorder,
            borderWidth: 1,
            titleColor: chartTheme.tooltipTitle,
            bodyColor: chartTheme.tooltipBody,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: chartTheme.textColor },
          },
          y: {
            beginAtZero: true,
            grid: { color: chartTheme.gridColor },
            ticks: { font: { size: 11 }, color: chartTheme.textColor, precision: 0 },
          },
        },
      },
    })
  }

  if (stagesChartRef.value) {
    const stageLabels = ['Registration', 'Triage', 'Screening', 'Lab', 'Review', 'Pharmacy', 'Completed']
    const stageValues = [
      props.encounterStageCounts.registration ?? 0,
      props.encounterStageCounts.triage ?? 0,
      props.encounterStageCounts.screening ?? 0,
      props.encounterStageCounts.lab ?? 0,
      props.encounterStageCounts.screening_review ?? 0,
      props.encounterStageCounts.pharmacy ?? 0,
      props.encounterStageCounts.completed ?? 0,
    ]
    const stageColors = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#10b981', '#737373']

    stagesChart = new Chart(stagesChartRef.value, {
      type: 'bar',
      data: {
        labels: stageLabels,
        datasets: [
          {
            label: 'Encounters',
            data: stageValues,
            backgroundColor: stageColors,
            borderRadius: 4,
            borderSkipped: false,
            hoverBackgroundColor: stageColors.map((c) => `${c}cc`),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 2000,
          easing: 'easeOutQuart',
          delay: (context) => (context.dataIndex ?? 0) * 100,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartTheme.tooltipBg,
            borderColor: chartTheme.tooltipBorder,
            borderWidth: 1,
            titleColor: chartTheme.tooltipTitle,
            bodyColor: chartTheme.tooltipBody,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: chartTheme.textColor,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: chartTheme.gridColor },
            ticks: { font: { size: 11 }, color: chartTheme.textColor, precision: 0 },
          },
        },
      },
    })
  }
}

const stageConfig: Record<string, { label: string; badge: string; dot: string; href: string }> = {
  registration: {
    label: 'Registration',
    badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
    href: '/registration',
  },
  triage: {
    label: 'Triage',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    href: '/triage/queue',
  },
  screening: {
    label: 'Screening',
    badge: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
    href: '/screening/queue',
  },
  lab: {
    label: 'Lab',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500',
    href: '/lab/queue',
  },
  screening_review: {
    label: 'Screening Review',
    badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    href: '/screening-review/queue',
  },
  pharmacy: {
    label: 'Pharmacy',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    href: '/pharmacy/queue',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
    dot: 'bg-neutral-500',
    href: '/encounters?status=completed',
  },
}

const statusBadge: Record<string, string> = {
  started: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  queued: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  in_progress: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  completed: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
  cancelled: 'bg-neutral-300 text-neutral-500 dark:bg-neutral-600 dark:text-neutral-400',
}

const stageBadgeFallback = 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'

function formatNumber(n: number) {
  return n.toLocaleString()
}

function formatDateTime(d: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

onMounted(() => {
  startFlashTimer()
  buildCharts()
  window.addEventListener(THEME_CHANGE_EVENT, buildCharts)
})

onUnmounted(() => {
  stopFlashTimer()
  window.removeEventListener(THEME_CHANGE_EVENT, buildCharts)
  destroyCharts()
})
</script>

<template>
  <Head :title="`Dashboard — ${clinicName}`" />

  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="text-neutral-700 dark:text-neutral-200 font-medium">Dashboard</span>
    </template>

    <section class="mb-6">
      <!-- Dynamic clinical insight slideshow -->
      <div
        v-if="currentFlash"
        class="mb-5 overflow-hidden rounded-2xl border transition-colors duration-500"
        :class="toneClasses[currentFlash.tone].card"
        @mouseenter="flashPaused = true"
        @mouseleave="flashPaused = false"
      >
        <div
          class="flex items-center justify-between gap-3 border-b px-5 py-2.5"
          :class="toneClasses[currentFlash.tone].header"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            Clinical insights
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-md p-1 text-neutral-500 transition hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-black/20 dark:hover:text-neutral-200"
              aria-label="Previous insight"
              @click="prevFlash"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              class="rounded-md p-1 text-neutral-500 transition hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-black/20 dark:hover:text-neutral-200"
              aria-label="Next insight"
              @click="nextFlash"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="relative min-h-[7.5rem] px-5 py-4 sm:px-6 sm:py-5">
          <Transition
            mode="out-in"
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div :key="currentFlash.id" class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <span
                  class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  :class="toneClasses[currentFlash.tone].chip"
                >
                  {{ currentFlash.eyebrow }}
                </span>
                <h3 class="mt-2 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-xl">
                  {{ currentFlash.headline }}
                </h3>
                <p class="mt-1.5 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                  {{ currentFlash.detail }}
                </p>
                <Link
                  v-if="currentFlash.href"
                  :href="currentFlash.href"
                  class="mt-3 inline-flex text-xs font-semibold hover:underline"
                  :class="toneClasses[currentFlash.tone].link"
                >
                  Open related queue →
                </Link>
              </div>
              <div
                v-if="currentFlash.metric"
                class="flex flex-col items-end justify-center rounded-xl px-4 py-3"
                :class="toneClasses[currentFlash.tone].metricBox"
              >
                <p class="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Signal</p>
                <p
                  class="text-3xl font-bold tabular-nums tracking-tight"
                  :class="toneClasses[currentFlash.tone].metric"
                >
                  {{ currentFlash.metric }}
                </p>
              </div>
            </div>
          </Transition>
        </div>

        <div class="flex items-center justify-between gap-3 px-5 pb-3 sm:px-6">
          <div class="flex gap-1.5">
            <button
              v-for="(flash, i) in flashes"
              :key="flash.id"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :class="i === flashIndex ? ['w-5', toneClasses[flash.tone].bar] : 'w-1.5 bg-black/15 dark:bg-white/25'"
              :aria-label="`Show insight ${i + 1}`"
              @click="goToFlash(i)"
            />
          </div>
          <p class="text-[11px] tabular-nums text-neutral-500">
            {{ flashIndex + 1 }} / {{ flashes.length }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StageQueueCard
          v-for="(cfg, stageKey) in stageConfig"
          :key="stageKey"
          :label="cfg.label"
          :count="encounterStageCounts[stageKey] ?? 0"
          :href="cfg.href"
          :action-label="stageKey === 'completed' ? 'Open list' : 'Open queue'"
          :dot-class="cfg.dot"
          :title-class="stageTitleClass[stageKey] ?? 'text-neutral-600 dark:text-neutral-400'"
        />
      </div>
    </section>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
      <StatCard title="Total Patients" :value="formatNumber(totalPatients)" meta="Seeded from local DB" color="blue">
        <template #icon>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </template>
      </StatCard>
      <StatCard title="Total Households" :value="formatNumber(totalHouseholds)" meta="Linked household records" color="indigo">
        <template #icon>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </template>
      </StatCard>
      <StatCard title="Active Patients" :value="formatNumber(activePatients)" meta="Current patient records" color="green">
        <template #icon>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </template>
      </StatCard>
      <StatCard title="Today's Shift Volume" :value="formatNumber(todayShiftPatients)" meta="Patients seen today" color="yellow">
        <template #icon>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </template>
      </StatCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="card overflow-hidden">
        <div class="theme-card-header px-5 py-4">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Encounters Over Time</h3>
          <p class="text-xs text-neutral-500 mt-0.5">Daily encounter volume — last 7 days</p>
        </div>
        <div class="p-5 chart-wrap">
          <canvas ref="encountersChartRef" />
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="theme-card-header px-5 py-4">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Stage Distribution</h3>
          <p class="text-xs text-neutral-500 mt-0.5">Current encounter spread across stages</p>
        </div>
        <div class="p-5 chart-wrap">
          <canvas ref="stagesChartRef" />
        </div>
      </div>
    </div>

    <div class="card overflow-hidden mb-6">
      <div class="theme-card-header flex items-center justify-between px-5 py-4">
        <div>
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recent Encounters</h3>
          <p class="text-xs text-neutral-500 mt-0.5">Latest 10 encounters across all stages</p>
        </div>
        <Link href="/registration" class="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition">
          Go to Registration →
        </Link>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="theme-card-header bg-neutral-50 dark:bg-neutral-800/40">
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Encounter #</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Patient ID</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Stage</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Visit Type</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Priority</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Started</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            <tr v-for="enc in recentEncounters" :key="enc.id" class="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
              <td class="px-5 py-3.5 font-mono text-xs text-neutral-600 dark:text-neutral-400">{{ enc.encounter_number }}</td>
              <td class="px-5 py-3.5 font-medium text-neutral-900 dark:text-neutral-100">{{ enc.full_name }}</td>
              <td class="px-5 py-3.5 font-mono text-xs text-neutral-600 dark:text-neutral-400">{{ enc.patient_code }}</td>
              <td class="px-5 py-3.5">
                <span
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold"
                  :class="stageConfig[enc.current_stage]?.badge ?? stageBadgeFallback"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    :class="stageConfig[enc.current_stage]?.dot ?? 'bg-neutral-400'"
                  />
                  {{ stageConfig[enc.current_stage]?.label ?? enc.current_stage }}
                </span>
              </td>
              <td class="px-5 py-3.5">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="statusBadge[enc.current_status] ?? 'bg-neutral-100 text-neutral-700'"
                >
                  {{ statusLabel(enc.current_status) }}
                </span>
              </td>
              <td class="px-5 py-3.5 text-sm text-neutral-600 dark:text-neutral-400 capitalize">{{ enc.visit_type || '—' }}</td>
              <td class="px-5 py-3.5">
                <span
                  v-if="enc.priority_level === 'urgent'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                >
                  Urgent
                </span>
                <span
                  v-else-if="enc.priority_level === 'high'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
                >
                  High
                </span>
                <span v-else class="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
                  {{ enc.priority_level || 'Normal' }}
                </span>
              </td>
              <td class="px-5 py-3.5 text-xs text-neutral-600 dark:text-neutral-400">{{ formatDateTime(enc.started_at) }}</td>
            </tr>
            <tr v-if="!recentEncounters.length">
              <td colspan="8" class="px-5 py-12 text-center text-sm text-neutral-500">
                No encounters yet.
                <Link href="/registration" class="text-neutral-800 dark:text-neutral-200 hover:underline font-medium">
                  Start one at Registration →
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="h-4" />
  </StaffLayout>
</template>
