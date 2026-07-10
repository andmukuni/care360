import db from '@adonisjs/lucid/services/db'
import type Appointment from '#models/appointment'
import Encounter from '#models/encounter'
import Patient from '#models/patient'
import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'
import { EncounterAuditService } from '#services/encounter/encounter_audit_service'
import { EncounterQueueService } from '#services/encounter/encounter_queue_service'
import { EncounterWorkflowService } from '#services/encounter/encounter_workflow_service'
import StartEncounterAction from '#actions/encounter/start_encounter_action'

/**
 * Starts an encounter for a confirmed appointment and drops it directly into
 * the chosen stage's queue — a deliberate staff shortcut that bypasses the
 * step-by-step stage graph.
 * Ported from App\Actions\Encounter\StartEncounterFromAppointmentAction.
 */
export default class StartEncounterFromAppointmentAction {
  private readonly startAction = new StartEncounterAction()
  private readonly queueService = new EncounterQueueService()
  private readonly workflowService = new EncounterWorkflowService()
  private readonly auditService = new EncounterAuditService()

  async handle(
    appointment: Appointment,
    targetStage: EncounterStage,
    userId: number,
    notes: string | null = null
  ): Promise<Encounter> {
    return db.transaction(async (trx) => {
      const patient = await Patient.findOrFail(appointment.patientId, { client: trx })

      const context = [
        `Started from appointment #${appointment.id}`,
        appointment.appointmentType,
        appointment.appointmentPurpose,
      ]
        .filter((v) => !!v)
        .join(' · ')
        .trim()

      // 1. Create the encounter (always begins at registration).
      const encounter = await this.startAction.handle(
        {
          patient_id: patient.id,
          visit_type: appointment.appointmentType,
          priority_level: 'normal',
          registration_notes: context,
        },
        userId,
        trx
      )

      // 2. Link the appointment to the encounter.
      encounter.useTransaction(trx)
      encounter.appointmentId = appointment.id
      await encounter.save()

      // 3. Route straight to the chosen stage's queue (unless registration).
      if (targetStage !== EncounterStage.Registration) {
        await this.workflowService.completeStageLog(encounter, userId, notes, trx)

        await this.queueService.queueTo(encounter, targetStage, userId, notes, trx)

        // Direct advance — intentionally skips the strict next-stage assertion.
        encounter.useTransaction(trx)
        encounter.currentStage = targetStage
        encounter.currentStatus = EncounterStatus.Queued
        await encounter.save()

        await this.auditService.record({
          encounter,
          actionName: 'queued_from_appointment',
          actionStage: targetStage,
          actionBy: userId,
          newValues: {
            appointment_id: appointment.id,
            to_stage: targetStage,
          },
          notes,
          client: trx,
        })
      }

      // 4. Mark the appointment as fulfilled so it leaves the active queue.
      appointment.useTransaction(trx)
      appointment.status = 'completed'
      await appointment.save()

      return encounter
    })
  }
}
