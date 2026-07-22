<script setup lang="ts">
import { ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import StaffLayout from '~/layouts/StaffLayout.vue'
import Spinner from '~/components/ui/Spinner.vue'
import ActionButton from '~/components/ui/ActionButton.vue'
import OptionalMark from '~/components/ui/OptionalMark.vue'
import RegistrationPatientMeta from '~/components/registration/RegistrationPatientMeta.vue'
import RegistrationActiveEncounterBadge from '~/components/registration/RegistrationActiveEncounterBadge.vue'
import QueueEmptyState from '~/components/staff/queue/QueueEmptyState.vue'
import QueueLiveIndicator from '~/components/staff/queue/QueueLiveIndicator.vue'
import PatientMembershipMiniCard from '~/components/billing/PatientMembershipMiniCard.vue'
import { useRegistrationDesk, type PatientSearchResult } from '~/composables/useRegistrationDesk'
import { useLiveQueueRefresh } from '~/composables/useLiveQueueRefresh'
import { resolveMembershipCardTheme } from '~/constants/membershipPlanThemes'

const props = defineProps<{
  activeEncounters: {
    data: {
      id: number
      encounter_number: string
      patient_name: string
      patient_initial: string
      visit_type: string | null
      priority_level: string | null
      started_at_relative: string | null
    }[]
    meta: {
      current_page: number
      last_page: number
      per_page: number
      total: number
    }
  }
  villages: string[]
  visitTypes: string[]
  priorityLevels: { value: string; label: string }[]
  selectedHouseholdOption: { id: string; name: string; label: string } | null
}>()

const desk = useRegistrationDesk({
  villages: props.villages,
  selectedHouseholdOption: props.selectedHouseholdOption,
})

useLiveQueueRefresh({
  stages: ['registration'],
  only: ['activeEncounters'],
})

const showEncounterModal = ref(false)

function openHouseholdForm() {
  showEncounterModal.value = true
  desk.openNewPatientForm('household')
}

function registerNewPatient() {
  showEncounterModal.value = true
  desk.openNewPatientForm('patient')
}

function startEncounterForPatient(patient: PatientSearchResult) {
  if (patient.active_encounter) return
  showEncounterModal.value = true
  desk.selectPatient(patient)
}

function closeEncounterModal() {
  showEncounterModal.value = false
  desk.resetForm()
}

function closeEncounterModalFromBackdrop() {
  desk.closeModalFromBackdrop()
  if (!desk.selectedPatient && !desk.showNewPatientForm) {
    showEncounterModal.value = false
  }
}

function onHouseholdSearchFocus() {
  if (desk.householdSearch.trim().length > 0) desk.searchHouseholds()
}

function closeHouseholdSuggestions() {
  setTimeout(() => {
    desk.householdSuggestionOpen = false
  }, 150)
}

function closeVillageSuggestions() {
  setTimeout(() => {
    desk.villageSuggestionOpen = false
  }, 150)
}

function onAddVillageClick() {
  desk.showAddVillage = true
  setTimeout(() => desk.newVillageInput?.focus(), 0)
}

function priorityLabel(level: string | null): string {
  if (!level) return ''
  return level.charAt(0).toUpperCase() + level.slice(1)
}
</script>

<template>
  <StaffLayout breadcrumbs>
    <template #breadcrumbs>
      <span class="mx-2">/</span>
      <span class="font-medium text-neutral-700 dark:text-neutral-200">Registration Desk</span>
    </template>

    <div class="queue-page queue-page--registration w-full space-y-5">
      <header class="queue-page-header">
        <div class="queue-page-header-intro min-w-0 flex-1">
          <h1 class="queue-page-title">Registration Desk</h1>
          <p class="queue-page-description">
            Find patients by barcode, name, NRC, phone, or patient number. Start encounters and queue them to triage.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="btn-primary inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm" @click="registerNewPatient">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Patient
          </button>
          <button type="button" class="btn-secondary inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm" @click="openHouseholdForm">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Add Household
          </button>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <!-- Find Patient -->
        <div class="space-y-5 xl:col-span-2">
          <div class="queue-segments queue-segments--full" role="tablist" aria-label="Patient search methods">
            <button
              v-for="tab in desk.tabs"
              :key="tab.key"
              type="button"
              role="tab"
              class="queue-segment"
              :class="{ active: desk.activeTab === tab.key }"
              :aria-selected="desk.activeTab === tab.key"
              @click="desk.switchTab(tab.key)"
            >
              <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
              </svg>
              <span>{{ tab.label }}</span>
            </button>
          </div>

          <div class="queue-panel overflow-hidden p-5">
            <Transition name="search-tab" mode="out-in" @after-enter="desk.focusActiveSearchField">
              <div :key="desk.activeTab" class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div :class="desk.activeTab === 'name' ? 'md:col-span-2' : 'md:col-span-4'">
              <label class="field-label search-row-label">{{ desk.currentLabel() }}</label>

              <div v-if="desk.activeTab === 'barcode'" data-search-tab="barcode">
                <p class="mb-2 text-[11px] text-neutral-500">USB/Bluetooth scanner works directly in the input below.</p>
                <div class="relative">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </span>
                  <input
                    :ref="(el) => (desk.barcodeInput = el as HTMLInputElement | null)"
                    v-model="desk.searchQuery"
                    type="text"
                    class="field-input pl-10 font-mono tracking-wider"
                    placeholder="Scan with USB/Bluetooth scanner or type barcode…"
                    @input="desk.queueSearchPatients(150)"
                    @keydown.enter.prevent="desk.commitScannedCode(desk.searchQuery, 'manual')"
                    @focus="desk.scannerStatus = 'Hardware scanner ready — scan now or type barcode manually.'"
                  />
                </div>
                <p class="mt-1 text-[11px] text-neutral-400">{{ desk.scannerStatus }}</p>
                <div class="mt-2 rounded border border-neutral-200 bg-neutral-50/70 px-3 py-2/40">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">Scanner diagnostics</p>
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="desk.scannerDiag.signalToneClass">
                        {{ desk.scannerDiag.signalLabel }}
                      </span>
                      <button
                        type="button"
                        class="rounded border border-neutral-300 px-2 py-1 text-[10px] text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                        @click="desk.scannerDiagnosticsEnabled = !desk.scannerDiagnosticsEnabled"
                      >
                        {{ desk.scannerDiagnosticsEnabled ? 'Hide' : 'Show' }}
                      </button>
                    </div>
                  </div>
                  <div v-show="desk.scannerDiagnosticsEnabled" class="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 sm:grid-cols-2">
                    <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Last source:</span> {{ desk.scannerDiag.lastSource }}</p>
                    <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Length:</span> {{ desk.scannerDiag.lastLength }}</p>
                    <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Avg key gap:</span> {{ desk.scannerDiag.lastInterKeyMsLabel }}</p>
                    <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Scanned at:</span> {{ desk.scannerDiag.lastScannedAt }}</p>
                    <p class="truncate sm:col-span-2"><span class="font-medium text-neutral-700 dark:text-neutral-300">Last code:</span> {{ desk.scannerDiag.lastCode }}</p>
                    <p class="text-[10px] text-neutral-400 sm:col-span-2">{{ desk.scannerDiag.signalHint }}</p>
                  </div>
                </div>
              </div>

              <div v-else-if="desk.activeTab === 'name'" data-search-tab="name">
                <input
                  v-model="desk.searchQuery"
                  type="text"
                  class="field-input"
                  placeholder="e.g. Jane Banda, John Mwale…"
                  @input="desk.queueSearchPatients(200)"
                />
              </div>

              <div v-else-if="desk.activeTab === 'nrc'" data-search-tab="nrc">
                <div class="relative">
                  <input
                    :value="desk.nrcSearchInput"
                    type="text"
                    maxlength="11"
                    class="field-input font-mono text-base tracking-widest"
                    placeholder="000000/00/0"
                    @input="desk.onNrcSearchInput"
                    @keydown.backspace="desk.onNrcSearchBackspace"
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">NRC</span>
                </div>
                <p class="mt-1 text-[11px] text-neutral-400">Format: 123456/12/1 — slashes are added automatically</p>
              </div>

              <div v-else-if="desk.activeTab === 'phone'" data-search-tab="phone">
                <input
                  :value="desk.phoneLocal"
                  type="tel"
                  maxlength="12"
                  class="field-input font-mono tracking-wider"
                  placeholder="97 1234567"
                  @input="desk.formatPhoneInput"
                />
                <p class="mt-1 text-[11px] text-neutral-400">Enter phone digits only (no country code required)</p>
              </div>

              <div v-else-if="desk.activeTab === 'patient_no'" data-search-tab="patient_no">
                <div class="relative">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">PAT-</span>
                  <input
                    v-model="desk.searchQuery"
                    type="text"
                    class="field-input pl-14 font-mono tracking-wider"
                    placeholder="000001"
                    @input="desk.queueSearchPatients(200)"
                  />
                </div>
                <p class="mt-1 text-[11px] text-neutral-400">Enter the patient ID number</p>
              </div>
            </div>

            <div v-if="desk.activeTab === 'name'">
              <label class="field-label search-row-label">
                <span>Sex</span>
                <OptionalMark />
              </label>
              <select v-model="desk.searchSex" class="field-input" @change="desk.searchPatients">
                <option value="">All</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div v-if="desk.activeTab === 'name'">
              <label class="field-label search-row-label">
                <span>Date of Birth</span>
                <OptionalMark hint="Optional — narrows name search" />
              </label>
              <input v-model="desk.searchDob" type="date" class="field-input" @change="desk.searchPatients" />
            </div>
              </div>
            </Transition>

          <div v-if="desk.searching" class="mt-4 flex items-center gap-2 text-sm text-neutral-500">
            <Spinner v-if="desk.searchResults.length === 0" />
            <span>{{ desk.searchResults.length === 0 ? 'Searching…' : 'Updating results…' }}</span>
          </div>

          <div v-if="desk.visibleResults().length > 0" class="mt-4">
            <p class="mb-2 text-xs text-neutral-500">{{ desk.resultCountLabel() }}</p>
            <div class="divide-y divide-neutral-100 overflow-hidden rounded border border-neutral-300 dark:divide-white/[0.04]">
              <div
                v-for="p in desk.visibleResults()"
                :key="p.id"
                class="registration-search-row flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                :class="{ 'registration-search-row--active-visit': !!p.active_encounter }"
              >
                <div class="flex min-w-0 flex-1 items-center gap-4">
                  <PatientMembershipMiniCard
                    :patient-id="p.patient_id"
                    :patient-initial="p.full_name.charAt(0).toUpperCase()"
                    :membership-plan="p.membership?.membership_plan"
                    :membership-plan-tier="p.membership?.membership_plan_tier"
                    :fund-balance="p.membership?.fund_balance"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-center gap-2">
                      <Link
                        :href="`/patients/${p.patient_id}`"
                        class="registration-search-row__name truncate text-sm font-semibold text-neutral-900 transition hover:text-sky-700 hover:underline dark:text-neutral-100 dark:hover:text-sky-300"
                      >
                        {{ p.full_name }}
                      </Link>
                      <span
                        v-if="p.active_encounter"
                        class="registration-search-row__live-dot shrink-0"
                        title="Patient has an active visit"
                        aria-hidden="true"
                      />
                    </div>
                    <RegistrationPatientMeta
                      :patient-id="p.patient_id"
                      :gender="p.gender"
                      :date-of-birth="p.date_of_birth"
                      :nrc-number="p.nrc_number"
                      :phone-number="p.phone_number"
                    />
                    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <RegistrationActiveEncounterBadge
                        v-if="p.active_encounter"
                        :encounter="p.active_encounter"
                      />
                      <span
                        v-if="p.membership?.membership_plan"
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        :style="{
                          color: resolveMembershipCardTheme(p.membership.membership_plan_tier).primaryDark,
                          backgroundColor: resolveMembershipCardTheme(p.membership.membership_plan_tier).soft,
                        }"
                      >
                        {{ p.membership.membership_plan }}
                        <template v-if="p.membership.membership_discount_percent > 0">
                          · {{ p.membership.membership_discount_percent }}% off
                        </template>
                      </span>
                      <span v-if="p.is_deceased" class="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-900/40 dark:text-red-300">Deceased</span>
                      <span v-if="p.status === 'inactive'" class="inline-flex items-center rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">Inactive</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-primary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
                  :disabled="!!p.active_encounter"
                  :title="
                    p.active_encounter
                      ? `Patient already has active visit ${p.active_encounter.encounter_number}`
                      : 'Start a new encounter'
                  "
                  @click="startEncounterForPatient(p)"
                >
                  <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Start Encounter
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="desk.searchPerformed && desk.searchResults.length === 0 && !desk.searching"
            class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600/60 dark:text-neutral-300"
          >
            <span>No patients found for "<span class="font-medium">{{ desk.searchQuery }}</span>"</span>
            <button type="button" class="btn-secondary shrink-0 px-3 py-1.5 text-xs" @click.stop="registerNewPatient">Register New Patient</button>
          </div>
          </div>
        </div>

        <!-- Active at Registration -->
        <div class="xl:col-span-1">
          <div class="queue-panel overflow-hidden xl:sticky xl:top-4">
            <div class="registration-active-header flex items-center gap-3 border-b px-4 py-3.5">
              <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">Active at Registration</h2>
              <QueueLiveIndicator />
              <span class="queue-segment-count ml-auto">{{ activeEncounters.meta.total }}</span>
            </div>

            <QueueEmptyState
              v-if="activeEncounters.data.length === 0"
              title="No active encounters"
              description="Start one using the search panel."
            />
            <div v-else class="divide-y divide-neutral-100 dark:divide-white/[0.04]">
              <div
                v-for="enc in activeEncounters.data"
                :key="enc.id"
                class="px-4 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                    {{ enc.patient_initial }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ enc.patient_name }}</p>
                      <span v-if="enc.priority_level && enc.priority_level !== 'normal'" class="badge shrink-0 text-[10px]" :class="`badge-${enc.priority_level}`">
                        {{ priorityLabel(enc.priority_level) }}
                      </span>
                    </div>
                    <p class="mt-0.5 truncate text-xs text-neutral-500">
                      {{ enc.encounter_number }}
                      <template v-if="enc.visit_type"> · {{ enc.visit_type }}</template>
                      <template v-if="enc.started_at_relative"> · {{ enc.started_at_relative }}</template>
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <Link
                      :href="`/registration/encounters/${enc.id}`"
                      class="btn-icon inline-flex h-8 w-8 items-center justify-center dark:hover:bg-neutral-800"
                      title="View encounter"
                      aria-label="View encounter"
                    >
                      <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                    <Link
                      :href="`/registration/encounters/${enc.id}`"
                      class="btn-icon btn-icon--primary inline-flex h-8 w-8 items-center justify-center"
                      title="Queue to triage"
                      aria-label="Queue to triage"
                    >
                      <svg class="btn-icon__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeEncounters.meta.last_page > 1" class="flex items-center justify-center gap-2 border-t border-neutral-200 px-4 py-3">
              <Link
                v-if="activeEncounters.meta.current_page > 1"
                :href="`/registration?page=${activeEncounters.meta.current_page - 1}`"
                class="btn-secondary px-3 py-1.5 text-xs"
                preserve-scroll
              >
                Previous
              </Link>
              <span class="text-xs text-neutral-500">
                Page {{ activeEncounters.meta.current_page }} of {{ activeEncounters.meta.last_page }}
              </span>
              <Link
                v-if="activeEncounters.meta.current_page < activeEncounters.meta.last_page"
                :href="`/registration?page=${activeEncounters.meta.current_page + 1}`"
                class="btn-secondary px-3 py-1.5 text-xs"
                preserve-scroll
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Start Encounter Modal -->
    <Teleport to="body">
        <div
          v-if="showEncounterModal"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
          @click.self="closeEncounterModalFromBackdrop"
          @keydown.escape.window="closeEncounterModal"
        >
          <div class="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl" @click.stop>
            <div class="flex flex-shrink-0 items-center justify-between theme-card-header px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-900 dark:bg-white">
                  <svg class="h-4 w-4 text-white dark:text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
                  <span v-if="desk.selectedPatient">
                    Start Encounter — <span class="text-neutral-600 dark:text-neutral-400">{{ desk.selectedPatient.full_name }}</span>
                  </span>
                  <span v-else-if="desk.showNewPatientForm && desk.newPatientMode === 'patient'">Register New Patient &amp; Start Encounter</span>
                  <span v-else-if="desk.showNewPatientForm && desk.newPatientMode === 'household'">Register Household Leader &amp; Start Encounter</span>
                </h2>
              </div>
              <button type="button" class="text-neutral-400 transition hover:text-neutral-600" @click="closeEncounterModal">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto">
              <form class="space-y-4 p-5" @submit.prevent="desk.submitStartEncounter">
                <div v-if="desk.selectedPatient?.is_deceased" class="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  This patient is marked as <strong>deceased</strong>. New encounters cannot be started.
                </div>
                <div
                  v-if="desk.selectedPatient && !desk.selectedPatient.is_deceased && desk.selectedPatient.status === 'inactive'"
                  class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                >
                  This patient is <strong>inactive</strong>. You will be asked to confirm before starting an encounter.
                </div>

                <div v-if="desk.showNewPatientForm && !desk.selectedPatient">
                  <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                    {{ desk.newPatientMode === 'household' ? 'Household Leader Details' : 'New Patient Details' }}
                  </h3>
                  <p v-if="desk.newPatientMode === 'household'" class="mb-4 text-xs text-neutral-500">
                    This patient will be saved as the household leader and a linked household record will be created.
                  </p>
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div v-if="desk.newPatientMode === 'patient'" class="md:col-span-2">
                      <label class="field-label">Add to Household <span class="font-normal text-neutral-500">(optional)</span></label>
                      <div class="relative">
                        <input
                          v-model="desk.householdSearch"
                          type="text"
                          class="field-input"
                          placeholder="Search households by head name or household ID"
                          @input="desk.queueSearchHouseholds()"
                          @focus="onHouseholdSearchFocus"
                          @blur="closeHouseholdSuggestions"
                        />
                        <div
                          v-if="desk.householdSuggestionOpen && desk.householdSuggestions.length > 0"
                          class="absolute z-20 mt-1 w-full overflow-hidden theme-surface rounded shadow-lg"
                        >
                          <button
                            v-for="household in desk.householdSuggestions"
                            :key="household.id"
                            type="button"
                            class="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50"
                            @mousedown.prevent="desk.selectHousehold(household)"
                          >
                            <span class="block text-sm font-medium text-neutral-900">{{ household.name }}</span>
                            <span class="block text-xs text-neutral-500">{{ household.id }}</span>
                          </button>
                        </div>
                      </div>
                      <p class="mt-1 text-[11px] text-neutral-400">Type to search. Up to three matches are shown.</p>
                      <p v-if="desk.selectedHouseholdId" class="mt-1 text-xs text-neutral-600">
                        Linked household: <span class="font-medium">{{ desk.selectedHouseholdLabel }}</span>
                      </p>
                    </div>

                    <div class="md:col-span-2">
                      <label class="field-label">Full Name <span class="req">*</span></label>
                      <input v-model="desk.form.full_name" type="text" class="field-input" placeholder="First Middle Last" @input="desk.titleCaseName" />
                    </div>
                    <div>
                      <label class="field-label">Gender</label>
                      <select v-model="desk.form.gender" class="field-input">
                        <option value="">— Select —</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label class="field-label">Date of Birth</label>
                      <input v-model="desk.form.date_of_birth" type="date" class="field-input" />
                    </div>
                    <div>
                      <label class="field-label">NRC Number</label>
                      <input
                        v-model="desk.form.nrc_number"
                        type="text"
                        class="field-input font-mono tracking-widest"
                        placeholder="123456/10/1"
                        maxlength="11"
                        autocomplete="off"
                        @input="desk.applyNrcFormat"
                        @keydown.backspace="desk.onNrcFieldBackspace"
                      />
                      <p class="mt-1 text-[11px] text-neutral-400">Format: 6 digits / 2 digits / 1 digit — slashes are added automatically</p>
                    </div>
                    <div>
                      <label class="field-label">Phone Number</label>
                      <input v-model="desk.form.phone_number" type="text" class="field-input" placeholder="+260 97…" />
                    </div>

                    <div v-if="desk.newPatientMode === 'household'" class="md:col-span-2">
                      <label class="field-label">Village <span class="req">*</span></label>
                      <div class="relative">
                        <input
                          v-model="desk.villageQuery"
                          type="text"
                          class="field-input"
                          placeholder="Search and select village"
                          autocomplete="off"
                          @focus="desk.openVillageSuggestions()"
                          @click="desk.openVillageSuggestions()"
                          @input="desk.onVillageInput()"
                          @blur="closeVillageSuggestions"
                        />
                        <div
                          v-if="desk.villageSuggestionOpen && desk.filteredVillageSuggestions().length > 0"
                          class="absolute z-20 mt-1 w-full overflow-hidden theme-surface rounded shadow-lg"
                        >
                          <button
                            v-for="village in desk.filteredVillageSuggestions()"
                            :key="village"
                            type="button"
                            class="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50"
                            @mousedown.prevent="desk.selectVillage(village)"
                          >
                            <span class="block text-sm text-neutral-900">{{ village }}</span>
                          </button>
                        </div>
                      </div>
                      <p class="mt-1 text-[11px] text-neutral-400">Click to see 4 suggestions. Keep typing to refine matches.</p>

                      <div class="mt-2">
                        <button
                          v-if="!desk.showAddVillage"
                          type="button"
                          class="text-[11px] text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-800"
                          @click="onAddVillageClick"
                        >
                          + Add village
                        </button>
                        <div v-if="desk.showAddVillage">
                          <div class="mt-1 flex items-center gap-2">
                            <input
                              :ref="(el) => (desk.newVillageInput = el as HTMLInputElement | null)"
                              v-model="desk.newVillageName"
                              type="text"
                              class="field-input text-sm"
                              placeholder="Type village name…"
                              maxlength="100"
                              @keydown.enter.prevent="desk.saveNewVillage()"
                              @keydown.escape="desk.showAddVillage = false; desk.newVillageName = ''; desk.addVillageError = ''"
                            />
                            <ActionButton
                              type="button"
                              class="whitespace-nowrap px-3 py-2 text-xs"
                              :loading="desk.addVillageLoading"
                              loading-text="Saving…"
                              @click="desk.saveNewVillage()"
                            >
                              Save
                            </ActionButton>
                            <button type="button" class="btn-secondary px-3 py-2 text-xs" @click="desk.showAddVillage = false; desk.newVillageName = ''; desk.addVillageError = ''">Cancel</button>
                          </div>
                          <p v-if="desk.addVillageError" class="mt-1 text-xs text-red-700">{{ desk.addVillageError }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="overflow-hidden rounded-lg border border-neutral-200">
                  <div class="theme-card-header px-4 py-2.5/60">
                    <h3 class="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Encounter Details</h3>
                  </div>
                  <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                    <div>
                      <label class="field-label">Visit Type</label>
                      <select v-model="desk.form.visit_type" class="field-input">
                        <option value="">— Select —</option>
                        <option v-for="visitType in visitTypes" :key="visitType" :value="visitType">{{ visitType }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="field-label">Priority Level</label>
                      <select v-model="desk.form.priority_level" class="field-input">
                        <option v-for="level in priorityLevels" :key="level.value" :value="level.value">{{ level.label }}</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <label class="field-label">Registration Notes</label>
                      <textarea v-model="desk.form.registration_notes" rows="3" class="field-input" placeholder="Any relevant notes for this visit…" />
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <ActionButton type="submit" :loading="desk.form.processing" loading-text="Starting…">
                    <template #icon>
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </template>
                    Start Encounter
                  </ActionButton>
                  <button type="button" class="btn-secondary" @click="closeEncounterModal">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Teleport>
  </StaffLayout>
</template>

<style scoped>
.search-tab-enter-active,
.search-tab-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.search-tab-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.search-tab-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
