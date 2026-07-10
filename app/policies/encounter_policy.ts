import { BasePolicy } from '@adonisjs/bouncer'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import EncounterAbacService from '#support/auth/encounter_abac_service'
import type User from '#models/user'
import type Encounter from '#models/encounter'

/**
 * Authorization for encounter operations. Ported from
 * App\Policies\EncounterPolicy.
 *
 * Combines role/permission checks (RBAC, via the User helper methods) with
 * attribute-based state checks (EncounterAbacService). Users with no roles and
 * no direct permissions are treated as "legacy" accounts with full access.
 */
export default class EncounterPolicy extends BasePolicy {
  private abac = new EncounterAbacService()

  /**
   * When an encounter is being worked on (in_progress), only the clinician who
   * received it into its current stage may act on it. Legacy data without a
   * captured receive transition is not hard-blocked.
   */
  private async isCurrentStageReceiver(user: User, encounter: Encounter): Promise<boolean> {
    if (encounter.currentStatus !== EncounterStatus.InProgress) {
      return true
    }

    const latestTransitionToStage = await encounter
      .related('encounterQueueTransitions')
      .query()
      .where('to_stage', encounter.currentStage)
      .orderBy('received_at', 'desc')
      .orderBy('queued_at', 'desc')
      .orderBy('id', 'desc')
      .first()

    if (!latestTransitionToStage || !latestTransitionToStage.receivedBy) {
      return true
    }

    return Number(latestTransitionToStage.receivedBy) === Number(user.id)
  }

  private isScreeningFlowClinician(user: User): Promise<boolean> {
    return user.hasAnyRole(['screening-clinician', 'screening-review-clinician'])
  }

  private isPharmacyClinician(user: User): Promise<boolean> {
    return user.hasRole('pharmacist')
  }

  private isLegacyUserWithoutRbac(user: User): Promise<boolean> {
    return user.isLegacyUserWithoutRbac()
  }

  async viewAny(user: User): Promise<boolean> {
    if (await this.isLegacyUserWithoutRbac(user)) {
      return true
    }

    return (await user.can('encounter.view-all')) || (await user.can('encounter.view-own'))
  }

  async view(user: User, encounter: Encounter): Promise<boolean> {
    if (!this.abac.canViewEncounter(encounter)) {
      return false
    }

    if (await this.isLegacyUserWithoutRbac(user)) {
      return true
    }

    if (await user.can('encounter.view-all')) {
      return true
    }

    let canViewCurrentStage = false
    switch (encounter.currentStage) {
      case EncounterStage.Registration:
        canViewCurrentStage = await user.can('registration.view-queue')
        break
      case EncounterStage.Triage:
        canViewCurrentStage = await user.can('triage.view-queue')
        break
      case EncounterStage.Screening:
        canViewCurrentStage =
          (await user.hasAnyPermission(['screening.view-queue', 'screening-review.view-queue'])) ||
          (await this.isScreeningFlowClinician(user))
        break
      case EncounterStage.Lab:
        canViewCurrentStage = await user.can('lab.view-queue')
        break
      case EncounterStage.ScreeningReview:
        canViewCurrentStage =
          (await user.hasAnyPermission(['screening-review.view-queue', 'screening.view-queue'])) ||
          (await this.isScreeningFlowClinician(user))
        break
      case EncounterStage.Pharmacy:
        canViewCurrentStage =
          (await user.can('pharmacy.view-queue')) || (await this.isPharmacyClinician(user))
        break
      case EncounterStage.TreatmentRoom:
        canViewCurrentStage = await user.can('treatment-room.view-queue')
        break
      default:
        canViewCurrentStage = false
    }

    if (canViewCurrentStage) {
      return true
    }

    const canAccessPharmacyWorkflow =
      (await user.can('pharmacy.view-queue')) || (await this.isPharmacyClinician(user))

    if (canAccessPharmacyWorkflow) {
      const hasPrescription = await encounter.related('pharmacyPrescriptions').query().first()
      const hasDispense = await encounter.related('pharmacyDispenses').query().first()
      if (hasPrescription || hasDispense) {
        return true
      }
    }

    if (!(await user.can('encounter.view-own'))) {
      return false
    }

    if (
      encounter.startedBy === user.id ||
      encounter.closedBy === user.id ||
      encounter.wardAssignedBy === user.id
    ) {
      return true
    }

    const ownershipChecks: Array<() => Promise<boolean>> = [
      async () =>
        !!(await encounter
          .related('encounterQueueTransitions')
          .query()
          .where('queued_by', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('encounterQueueTransitions')
          .query()
          .where('received_by', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('screeningRecords')
          .query()
          .where('screening_type', 'initial')
          .where('clinician_id', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('screeningRecords')
          .query()
          .where('screening_type', 'review_after_lab')
          .where('clinician_id', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('labRequests')
          .query()
          .where('requested_by', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('pharmacyPrescriptions')
          .query()
          .where('prescribed_by', user.id)
          .first()),
      async () =>
        !!(await encounter
          .related('pharmacyDispenses')
          .query()
          .where('dispensed_by', user.id)
          .first()),
    ]

    for (const check of ownershipChecks) {
      if (await check()) {
        return true
      }
    }

    return false
  }

  async receiveForStage(
    user: User,
    encounter: Encounter,
    stage: EncounterStage
  ): Promise<boolean> {
    let canRole = false
    switch (stage) {
      case EncounterStage.Triage:
        canRole = await user.can('triage.receive')
        break
      case EncounterStage.Screening:
        canRole =
          (await user.hasAnyPermission(['screening.receive', 'screening-review.receive'])) ||
          (await this.isScreeningFlowClinician(user))
        break
      case EncounterStage.Lab:
        canRole = await user.can('lab.receive')
        break
      case EncounterStage.ScreeningReview:
        canRole =
          (await user.hasAnyPermission(['screening-review.receive', 'screening.receive'])) ||
          (await this.isScreeningFlowClinician(user))
        break
      case EncounterStage.Pharmacy:
        canRole = (await user.can('pharmacy.receive')) || (await this.isPharmacyClinician(user))
        break
      case EncounterStage.TreatmentRoom:
        canRole = await user.can('treatment-room.receive')
        break
      default:
        canRole = await user.can('encounter.view-own')
    }

    return (
      (canRole || (await this.isLegacyUserWithoutRbac(user))) &&
      this.abac.canReceiveFromQueue(encounter, stage)
    )
  }

  async editInStage(user: User, encounter: Encounter, stage: EncounterStage): Promise<boolean> {
    const canRole = (await this.isLegacyUserWithoutRbac(user)) || (await this.view(user, encounter))

    return (
      canRole &&
      (await this.isCurrentStageReceiver(user, encounter)) &&
      this.abac.canEditInProgress(encounter, stage)
    )
  }

  async advanceFromStage(
    user: User,
    encounter: Encounter,
    stage: EncounterStage
  ): Promise<boolean> {
    const canRole = (await this.isLegacyUserWithoutRbac(user)) || (await this.view(user, encounter))

    return (
      canRole &&
      (await this.isCurrentStageReceiver(user, encounter)) &&
      this.abac.canAdvanceToNextStage(encounter, stage)
    )
  }
}
