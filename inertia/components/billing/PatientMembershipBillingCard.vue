<script setup lang="ts">
import { computed } from 'vue'
import PatientBarcode from '~/components/billing/PatientBarcode.vue'
import { resolveMembershipCardTheme } from '~/constants/membershipPlanThemes'

const props = withDefaults(
  defineProps<{
    patientId: string
    fullName: string
    patientInitial: string
    barcode?: string | null
    membershipPlan?: string | null
    membershipPlanTier?: number | null
    fundBalance?: string | null
    demoLine?: string | null
    compact?: boolean
  }>(),
  {
    compact: false,
  }
)

const theme = computed(() => resolveMembershipCardTheme(props.membershipPlanTier))
const planLabel = computed(() => props.membershipPlan ?? theme.value.label)
const barcodeValue = computed(() => props.barcode?.trim() || props.patientId)
</script>

<template>
  <div
    class="patient-membership-billing-card"
    :class="{ 'patient-membership-billing-card--compact': compact }"
    :style="{ backgroundColor: theme.primaryDark }"
    :title="membershipPlan ? `${membershipPlan} membership` : 'Patient billing card'"
  >
    <div class="patient-membership-billing-card__glow" aria-hidden="true" />
    <div class="patient-membership-billing-card__arc" aria-hidden="true" />

    <div class="patient-membership-billing-card__top">
      <div class="patient-membership-billing-card__chip" aria-hidden="true">
        <span class="patient-membership-billing-card__chip-line" />
      </div>
      <span class="patient-membership-billing-card__plan">{{ planLabel }}</span>
    </div>

    <div class="patient-membership-billing-card__body">
      <div class="patient-membership-billing-card__initial">{{ patientInitial }}</div>
      <div class="min-w-0 flex-1">
        <p class="patient-membership-billing-card__name">{{ fullName }}</p>
        <p class="patient-membership-billing-card__id">{{ patientId }}</p>
        <p v-if="demoLine" class="patient-membership-billing-card__demo">{{ demoLine }}</p>
      </div>
    </div>

    <div class="patient-membership-billing-card__footer">
      <PatientBarcode :value="barcodeValue" :compact="compact" />
      <span class="patient-membership-billing-card__balance">
        {{ fundBalance != null ? `K ${fundBalance}` : '—' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.patient-membership-billing-card {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 18rem;
  max-width: 26rem;
  min-height: 11.75rem;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
  overflow: hidden;
  border-radius: 1rem;
  padding: 1rem 1.1rem 0.95rem;
  color: #fff;
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
}

.patient-membership-billing-card__glow {
  position: absolute;
  top: -3rem;
  right: -2rem;
  height: 8rem;
  width: 8rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.patient-membership-billing-card__arc {
  position: absolute;
  bottom: -4rem;
  left: -3rem;
  height: 9rem;
  width: 9rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.patient-membership-billing-card__top,
.patient-membership-billing-card__body,
.patient-membership-billing-card__footer {
  position: relative;
  z-index: 1;
}

.patient-membership-billing-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.patient-membership-billing-card__chip {
  display: flex;
  height: 1.5rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  background: linear-gradient(180deg, #e8d28a 0%, #c9a84c 100%);
  padding: 0.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.patient-membership-billing-card__chip-line {
  display: block;
  height: 2px;
  width: 100%;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.28);
}

.patient-membership-billing-card__plan {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.86);
}

.patient-membership-billing-card__body {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.patient-membership-billing-card__initial {
  display: flex;
  height: 2.75rem;
  width: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.patient-membership-billing-card__name {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
}

.patient-membership-billing-card__id {
  margin-top: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.88);
}

.patient-membership-billing-card__demo {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
}

.patient-membership-billing-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  padding-top: 0.75rem;
}

.patient-membership-billing-card__balance {
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}

.patient-membership-billing-card--compact {
  min-width: 0;
  max-width: none;
  min-height: 0;
  gap: 0.55rem;
  padding: 0.7rem 0.8rem 0.65rem;
  border-radius: 0.75rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__chip {
  height: 1.15rem;
  width: 1.6rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__plan {
  font-size: 0.5625rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__body {
  gap: 0.55rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__initial {
  height: 2rem;
  width: 2rem;
  font-size: 0.8125rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__name {
  font-size: 0.9375rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__id {
  margin-top: 0.1rem;
  font-size: 0.5625rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__demo {
  margin-top: 0.15rem;
  font-size: 0.625rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__footer {
  padding-top: 0.45rem;
}

.patient-membership-billing-card--compact .patient-membership-billing-card__balance {
  font-size: 0.9375rem;
}
</style>
