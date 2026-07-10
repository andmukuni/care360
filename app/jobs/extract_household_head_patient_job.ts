import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { Job } from '#services/queue/queue_service'

export interface HouseholdExtractionResult {
  status: 'created' | 'updated' | 'skipped'
  message: string
}

/**
 * Ensures a household's head-of-house exists as a linked patient row and
 * rebalances the head flag across household members.
 *
 * Ported from App\Jobs\ExtractHouseholdHeadPatientJob + the
 * App\Services\Households\HouseholdHeadExtractionService it delegated to. The
 * service lived outside this phase's create scope, so its logic is inlined here.
 *
 * Batching: Laravel used the Bus batch (`$this->batch()?->cancelled()`); the
 * simple inline queue has no batch context yet, so an optional `isCancelled`
 * hook is exposed for a future batch-aware driver.
 *
 * NOTE: this job performs writes to `patients` / `households`. It is a faithful
 * port and only runs when explicitly dispatched.
 */
export class ExtractHouseholdHeadPatientJob implements Job {
  constructor(
    private readonly householdId: string,
    private readonly isCancelled: () => boolean = () => false
  ) {}

  async handle(): Promise<void> {
    if (this.isCancelled()) {
      return
    }

    const result = await this.extractByHouseholdId(this.householdId)
    logger.info({ householdId: this.householdId, ...result }, 'Household head extraction')
  }

  async extractByHouseholdId(householdId: string): Promise<HouseholdExtractionResult> {
    const householdRow = await db.from('households').where('household_id', householdId).first()

    if (!householdRow) {
      return { status: 'skipped', message: 'Household not found.' }
    }

    return this.extractFromHouseholdRow(householdRow)
  }

  async extractFromHouseholdRow(householdRow: any): Promise<HouseholdExtractionResult> {
    const householdId = String(householdRow.household_id ?? '').trim()
    const headName = String(householdRow.head_of_house ?? '').trim()

    if (householdId === '' || headName === '') {
      return { status: 'skipped', message: 'Missing household ID or head name.' }
    }

    const householdBarcode = String(householdRow.barcode ?? '').trim()
    const headLookupName = headName.toLowerCase()
    const now = DateTime.now().toSQL()

    let matchingMember = await db
      .from('patients')
      .where('household_id', householdId)
      .whereRaw('lower(trim(full_name)) = ?', [headLookupName])
      .orderByRaw("CASE WHEN lower(relationship_to_head) = 'head' THEN 0 ELSE 1 END")
      .orderBy('source_created_at')
      .orderBy('id')
      .first()

    let usedStatus: 'created' | 'updated' = 'updated'

    if (!matchingMember) {
      const patientId = await this.generatePatientId()
      const barcode = householdBarcode !== '' ? householdBarcode : this.generateBarcode('P', patientId)

      const inserted = await db
        .table('patients')
        .insert({
          patient_id: patientId,
          barcode,
          full_name: headName,
          phone_number: String(householdRow.phone_number ?? '').trim() || null,
          nrc_number: String(householdRow.nrc_number ?? '').trim() || null,
          household_id: householdId,
          household_head_of_house: headName,
          relationship_to_head: 'Head',
          source_created_at: now,
          created_at: now,
          updated_at: now,
        })
        .returning('id')

      const memberDbId = Array.isArray(inserted) ? (inserted[0] as any).id ?? inserted[0] : inserted
      matchingMember = await db.from('patients').where('id', memberDbId).first()
      usedStatus = 'created'
    } else {
      await db
        .from('patients')
        .where('id', matchingMember.id)
        .update({
          household_id: householdId,
          household_head_of_house: headName,
          relationship_to_head: 'Head',
          barcode: householdBarcode !== '' ? householdBarcode : matchingMember.barcode,
          updated_at: now,
        })
    }

    await this.rebalanceHouseholdHead(householdId, Number(matchingMember.id))

    if (householdBarcode !== '') {
      await db
        .from('patients')
        .where('id', matchingMember.id)
        .update({ barcode: householdBarcode, updated_at: now })
    }

    // TODO(cache): Laravel busted ListPageCache for patients/households here.

    return { status: usedStatus, message: `Head ${headName} is now linked as a patient.` }
  }

  private async generatePatientId(): Promise<string> {
    let candidate: string
    do {
      candidate = this.generateBarcode('P')
      const exists = await db.from('patients').where('patient_id', candidate).first()
      if (!exists) {
        break
      }
    } while (true)
    return candidate
  }

  /**
   * TODO(barcode): port App\Support\TdltsBarcodeGenerator for exact parity.
   * This fallback produces a prefixed unique-ish code so the job is functional.
   */
  private generateBarcode(prefix: string, seed?: string): string {
    const base = seed ?? randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
    return `${prefix}${base}`
  }

  private async rebalanceHouseholdHead(
    householdId: string,
    preferredHeadDbId: number | null = null
  ): Promise<void> {
    const now = DateTime.now().toSQL()

    const members = await db
      .from('patients')
      .where('household_id', householdId)
      .orderByRaw("CASE WHEN lower(relationship_to_head) = 'head' THEN 0 ELSE 1 END")
      .orderBy('source_created_at')
      .orderBy('id')

    if (members.length === 0) {
      await db
        .from('households')
        .where('household_id', householdId)
        .update({ head_of_house: null, updated_at: now })
      return
    }

    let selectedHead: any = null
    if (preferredHeadDbId !== null) {
      selectedHead = members.find((m: any) => Number(m.id) === preferredHeadDbId) ?? null
    }
    if (!selectedHead) {
      selectedHead = members[0]
    }

    let headName = String(selectedHead.full_name ?? '').trim()
    if (headName === '') {
      headName = 'Unknown'
    }

    await db
      .from('households')
      .where('household_id', householdId)
      .update({ head_of_house: headName, updated_at: now })

    await db
      .from('patients')
      .where('household_id', householdId)
      .update({
        relationship_to_head: 'Member',
        household_head_of_house: headName,
        updated_at: now,
      })

    await db
      .from('patients')
      .where('id', selectedHead.id)
      .update({ relationship_to_head: 'Head', updated_at: now })
  }
}
