import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type LabRequest from '#models/lab_request'
import LabRequestItem from '#models/lab_request_item'
import LabSample from '#models/lab_sample'
import LabSpecimenType from '#models/lab_specimen_type'

/**
 * Records sample collection against an open lab request.
 * Ported from App\Actions\Encounter\RecordLabSamplesAction.
 */
export default class RecordLabSamplesAction {
  async handle(
    labRequest: LabRequest,
    data: Record<string, any>,
    collectedById: number
  ): Promise<LabSample[]> {
    return db.transaction(async (trx) => {
      if (labRequest.status === 'completed') {
        throw new Error('Cannot add samples to a completed lab request.')
      }

      const created: LabSample[] = []

      for (const sample of data.samples ?? []) {
        let sid: number | null =
          sample.lab_specimen_type_id !== undefined && sample.lab_specimen_type_id !== null
            ? Number(sample.lab_specimen_type_id)
            : null

        if (sid) {
          const exists = await LabSpecimenType.find(sid, { client: trx })
          if (!exists) {
            sid = null
          }
        }

        let typeName = String(sample.sample_type ?? '').trim()
        if (sid) {
          const catalog = await LabSpecimenType.find(sid, { client: trx })
          if (catalog) {
            typeName = catalog.name
          }
        }

        const labSample = await LabSample.create(
          {
            labRequestId: labRequest.id,
            encounterId: labRequest.encounterId,
            patientId: labRequest.patientId,
            collectedBy: collectedById,
            sampleType: typeName,
            labSpecimenTypeId: sid ? sid : null,
            sampleLabel: sample.sample_label ?? null,
            collectionNotes: sample.collection_notes ?? null,
            collectedAt: DateTime.now(),
          },
          { client: trx }
        )

        created.push(labSample)
      }

      // Optionally mark request items as collected
      if (Array.isArray(data.item_ids) && data.item_ids.length > 0) {
        await LabRequestItem.query({ client: trx })
          .whereIn('id', data.item_ids)
          .where('lab_request_id', labRequest.id)
          .update({ status: 'collected' })
      }

      return created
    })
  }
}
