import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type LabRequest from '#models/lab_request'
import LabRequestItem from '#models/lab_request_item'
import LabResult from '#models/lab_result'

/**
 * Records lab test results against an open lab request. Auto-releases each
 * result to the patient portal on finalize.
 * Ported from App\Actions\Encounter\RecordLabResultsAction.
 */
export default class RecordLabResultsAction {
  async handle(
    labRequest: LabRequest,
    data: Record<string, any>,
    recordedById: number
  ): Promise<LabResult[]> {
    return db.transaction(async (trx) => {
      if (labRequest.status === 'completed') {
        throw new Error('Cannot record results on a completed lab request.')
      }

      const saved: LabResult[] = []

      for (const row of data.results ?? []) {
        const itemId = row.lab_request_item_id ?? null
        let result: LabResult | null = null

        if (itemId) {
          result = await LabResult.query({ client: trx })
            .where('lab_request_id', labRequest.id)
            .where('lab_request_item_id', itemId)
            .orderBy('id', 'desc')
            .first()
        }

        const payload = {
          labRequestId: labRequest.id,
          labRequestItemId: itemId,
          encounterId: labRequest.encounterId,
          patientId: labRequest.patientId,
          recordedBy: recordedById,
          resultValue: row.result_value ?? null,
          resultText: row.result_text ?? null,
          referenceRange: row.reference_range ?? null,
          interpretation: row.interpretation ?? null,
          remarks: row.remarks ?? null,
          resultStatus: 'resulted',
          resultRecordedAt: DateTime.now(),
          releasedToPatientAt: DateTime.now(),
          releasedBy: recordedById,
        }

        if (result) {
          result.useTransaction(trx)
          result.merge(payload)
          await result.save()
        } else {
          result = await LabResult.create(payload, { client: trx })
        }

        if (itemId) {
          await LabRequestItem.query({ client: trx })
            .where('id', itemId)
            .where('lab_request_id', labRequest.id)
            .update({ status: 'resulted' })
        }

        saved.push(result)
      }

      return saved
    })
  }
}
