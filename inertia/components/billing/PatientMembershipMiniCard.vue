<script setup lang="ts">
import { computed } from 'vue'
import { resolveMembershipCardTheme } from '~/constants/membershipPlanThemes'

const props = defineProps<{
  patientId: string
  patientInitial: string
  membershipPlan?: string | null
  membershipPlanTier?: number | null
  fundBalance?: string | null
}>()

const theme = computed(() => resolveMembershipCardTheme(props.membershipPlanTier))
const planLabel = computed(() => props.membershipPlan ?? theme.value.label)
</script>

<template>
  <div
    class="patient-membership-mini-card"
    :style="{ backgroundColor: theme.primaryDark }"
    :title="membershipPlan ? `${membershipPlan} membership` : 'No active membership plan'"
  >
    <div class="patient-membership-mini-card__glow" aria-hidden="true" />
    <div class="patient-membership-mini-card__top">
      <div class="patient-membership-mini-card__chip" aria-hidden="true">
        <span class="patient-membership-mini-card__chip-line" />
      </div>
      <span class="patient-membership-mini-card__plan">{{ planLabel }}</span>
    </div>
    <p class="patient-membership-mini-card__id">{{ patientId }}</p>
    <div class="patient-membership-mini-card__footer">
      <span class="patient-membership-mini-card__initial">{{ patientInitial }}</span>
      <span v-if="fundBalance != null" class="patient-membership-mini-card__balance">K {{ fundBalance }}</span>
    </div>
  </div>
</template>

<style scoped>
.patient-membership-mini-card {
  position: relative;
  display: flex;
  width: 7.25rem;
  flex-direction: column;
  gap: 0.2rem;
  overflow: hidden;
  border-radius: 0.65rem;
  padding: 0.45rem 0.5rem 0.4rem;
  color: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
  flex-shrink: 0;
}

.patient-membership-mini-card__glow {
  position: absolute;
  top: -1.5rem;
  right: -1rem;
  height: 4rem;
  width: 4rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.patient-membership-mini-card__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.25rem;
}

.patient-membership-mini-card__chip {
  display: flex;
  height: 0.85rem;
  width: 1.15rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.15rem;
  background: #d4b86a;
  padding: 0.15rem;
}

.patient-membership-mini-card__chip-line {
  display: block;
  height: 1px;
  width: 100%;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.25);
}

.patient-membership-mini-card__plan {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.82);
}

.patient-membership-mini-card__id {
  position: relative;
  z-index: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
}

.patient-membership-mini-card__footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  padding-top: 0.2rem;
}

.patient-membership-mini-card__initial {
  display: flex;
  height: 1.15rem;
  width: 1.15rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 0.5625rem;
  font-weight: 700;
}

.patient-membership-mini-card__balance {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
}
</style>
