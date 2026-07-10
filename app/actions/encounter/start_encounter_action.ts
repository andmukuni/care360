import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Encounter from '#models/encounter'
import EncounterStageLog from '#models/encounter_stage_log'
import RegistrationRecord from '#models/registration_record'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { QueueTransitionStatus } from '#enums/queue_transition_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import type { CashJournalLedgerContract } from '#services/encounter/external_contracts'
import {
  ActiveEncounterExistsException,
  PatientNotEligibleForEncounterException,
} from '#support/encounter/exceptions'
import RegisterOrAttachPatientAction from '#actions/encounter/register_or_attach_patient_action'
import { staffQueueBroadcast } from '#services/staff/staff_queue_broadcast_service'

/**
 * Creates an encounter, opens the registration stage log, and writes a
 * registration record — all inside a single DB transaction.
 * Ported from App\Actions\Encounter\StartEncounterAction.
 *
 * `cashJournalLedger` is a cross-phase (Finance) dependency; when it is not
 * injected the household-subscription cash entry is skipped.
 */
export default class StartEncounterAction {
  private readonly registerOrAttach = new RegisterOrAttachPatientAction()
  private readonly auditService = new EncounterAuditService()

  constructor(private readonly cashJournalLedger?: CashJournalLedgerContract) {}

  async handle(
    data: Record<string, any>,
    registrarId: number,
    client?: TransactionClientContract
  ): Promise<Encounter> {
    if (client) {
      return this.run(data, registrarId, client)
    }
    return db.transaction((trx) => this.run(data, registrarId, trx))
  }

  private async run(
    data: Record<string, any>,
    registrarId: number,
    trx: TransactionClientContract
  ): Promise<Encounter> {
    let registrationNotes: string | null = data.registration_notes ?? null

    if (
      (data.create_household ?? false) &&
      data.payment_plan &&
      data.payment_mode &&
      data.payment_amount
    ) {
      const paymentPlan = data.payment_plan === 'annual' ? 'Annual' : 'Monthly'
      const paymentMode = data.payment_mode === 'mobile_money' ? 'Mobile money' : 'Cash'
      const paymentLine = `Household payment: ${paymentPlan} K${this.numberFormat(
        data.payment_amount
      )} via ${paymentMode}.`

      registrationNotes = [registrationNotes, paymentLine].filter((v) => !!v).join('\n').trim()
    }

    // 1. Find or create patient
    const { patient, wasExisting } = await this.registerOrAttach.handle(data, trx)

    if (patient.isDeceased) {
      throw new PatientNotEligibleForEncounterException(
        patient.fullName,
        PatientNotEligibleForEncounterException.REASON_DECEASED
      )
    }

    if (patient.status === 'inactive' && !(data.confirm_inactive_patient ?? false)) {
      throw new PatientNotEligibleForEncounterException(
        patient.fullName,
        PatientNotEligibleForEncounterException.REASON_INACTIVE
      )
    }

    // 2. Guard — a patient may only have one active encounter at a time.
    const activeEncounter = await Encounter.query({ client: trx })
      .where('patient_id', patient.id)
      .where('is_locked', false)
      .whereNull('closed_at')
      .orderBy('id', 'desc')
      .first()

    if (activeEncounter !== null) {
      throw new ActiveEncounterExistsException(activeEncounter.encounterNumber)
    }

    const attendantType = wasExisting ? 're_attendant' : 'first_attendant'

    // 3. Create encounter
    const encounter = await Encounter.create(
      {
        encounterNumber: await this.generateEncounterNumber(trx),
        patientId: patient.id,
        currentStage: EncounterStage.Registration,
        currentStatus: EncounterStatus.Started,
        visitType: data.visit_type ?? null,
        priorityLevel: data.priority_level ?? null,
        startedAt: DateTime.now(),
        startedBy: registrarId,
      },
      { client: trx }
    )

    // 3b. Open registration stage log
    await EncounterStageLog.create(
      {
        encounterId: encounter.id,
        patientId: patient.id,
        stageName: EncounterStage.Registration,
        stageSequence: EncounterStageHelper.sequence(EncounterStage.Registration),
        status: QueueTransitionStatus.Received,
        startedBy: registrarId,
        startedAt: DateTime.now(),
      },
      { client: trx }
    )

    // 4. Write registration record
    await RegistrationRecord.create(
      {
        encounterId: encounter.id,
        patientId: patient.id,
        registrarId,
        wasExistingPatient: wasExisting,
        attendantType: (data.visit_type ?? null) === 'OPD' ? attendantType : 'first_attendant',
        searchReference: data.search_reference ?? null,
        registrationNotes,
        registeredAt: DateTime.now(),
      },
      { client: trx }
    )

    if (
      (data.create_household ?? false) &&
      data.payment_plan &&
      data.payment_mode &&
      data.payment_amount &&
      this.cashJournalLedger
    ) {
      const paymentPlan = data.payment_plan === 'annual' ? 'Annual' : 'Monthly'
      const paymentModeLabel = data.payment_mode === 'mobile_money' ? 'Mobile money' : 'Cash'
      await this.cashJournalLedger.recordCollection({
        amount: data.payment_amount,
        narrative: `Household subscription (${paymentPlan}): K${this.numberFormat(
          data.payment_amount
        )} via ${paymentModeLabel} — encounter ${encounter.encounterNumber}.`,
        recordedByUserId: registrarId,
        encounterId: encounter.id,
        householdId: patient.householdId,
        paymentMethod: String(data.payment_mode),
        subscriptionPlan: String(data.payment_plan),
        client: trx,
      })
    }

    // 5. Audit
    await this.auditService.record({
      encounter,
      actionName: 'encounter_started',
      actionStage: EncounterStage.Registration,
      actionBy: registrarId,
      newValues: {
        encounter_number: encounter.encounterNumber,
        patient_id: patient.patientId,
        was_existing: wasExisting,
      },
      client: trx,
    })

    await encounter.load('patient')
    await encounter.load('registrationRecords')
    await encounter.load('encounterStageLogs')
    await encounter.load('encounterAudits')

    staffQueueBroadcast.notifyStages([EncounterStage.Registration], trx)

    return encounter
  }

  private async generateEncounterNumber(client: TransactionClientContract): Promise<string> {
    const date = DateTime.now().toFormat('yyyyLLdd')
    const prefix = `ENC-${date}-`

    const latest = await Encounter.query({ client })
      .where('encounter_number', 'like', `${prefix}%`)
      .orderBy('id', 'desc')
      .first()

    const seq = latest ? Number.parseInt(latest.encounterNumber.slice(-5), 10) + 1 : 1

    return prefix + String(seq).padStart(5, '0')
  }

  private numberFormat(amount: unknown): string {
    return Math.trunc(Number(amount)).toLocaleString('en-US')
  }
}
