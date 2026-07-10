import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Encounter from '#models/encounter'
import type PharmacyRecommendation from '#models/pharmacy_recommendation'
import type User from '#models/user'

/**
 * Contracts for cross-phase services that the encounter actions depend on but
 * which are OWNED BY OTHER MIGRATION PHASES (Finance / Billing / GynObs /
 * Notifications). They are declared here as interfaces so Phase 3 compiles and
 * preserves the original call sites; the coordinator must inject concrete
 * implementations when wiring the actions in controllers/DI.
 *
 * Where a dependency is not injected, the action degrades gracefully (the
 * side-effect is skipped) — see the individual actions.
 */

/** App\Services\Finance\CashJournalLedger */
export interface CashJournalLedgerContract {
  recordCollection(input: {
    amount: number | string
    narrative: string
    recordedByUserId: number
    encounterId?: number | null
    householdId?: string | null
    paymentMethod?: string | null
    subscriptionPlan?: string | null
    client?: TransactionClientContract
  }): Promise<unknown>
}

/** App\Services\GynObs\GynObsAlertService */
export interface GynObsAlertServiceContract {
  calculateEdd(lmp: DateTime | null): DateTime | null
}

/** App\Services\Notifications\RecommendationNotificationEngine */
export interface RecommendationNotificationEngineContract {
  notifyMedicationRecommendation(input: {
    encounter: Encounter
    recommendation: PharmacyRecommendation
    actorId?: number | null
  }): Promise<void>
}

/** App\Services\Billing\EncounterBillingService */
export interface EncounterBillingServiceContract {
  billEncounter(
    encounter: Encounter,
    user?: User | null,
    opts?: Record<string, unknown>
  ): Promise<unknown>
}
