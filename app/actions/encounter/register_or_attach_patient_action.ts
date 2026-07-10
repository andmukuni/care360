import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import Patient from '#models/patient'
import { TdltsBarcodeGenerator } from '#support/tdlts_barcode_generator'
import { toDateTime } from '#support/encounter/coerce'

export interface RegisterOrAttachResult {
  patient: Patient
  wasExisting: boolean
}

/**
 * Finds an existing patient or creates a new one (optionally creating/attaching
 * a household). Ported from App\Actions\Encounter\RegisterOrAttachPatientAction.
 */
export default class RegisterOrAttachPatientAction {
  async handle(
    data: Record<string, any>,
    client?: TransactionClientContract
  ): Promise<RegisterOrAttachResult> {
    // Use existing patient when their integer PK is supplied
    if (data.patient_id) {
      const patient = await Patient.findOrFail(Number(data.patient_id), { client })
      return { patient, wasExisting: true }
    }

    const qb: QueryClientContract = client ?? db.connection()

    const createHousehold = Boolean(data.create_household ?? false)
    let householdId: string | null = null
    let householdHead: string | null = null
    let householdVillage: string | null = null

    if (createHousehold) {
      householdId = await this.generateHouseholdId(qb)
      householdHead = String(data.full_name ?? '').trim()
      const village = data.village !== undefined ? String(data.village).trim() : null
      householdVillage = village !== null && village !== '' ? village : null

      await qb.table('households').insert({
        household_id: householdId,
        head_of_house: householdHead !== '' ? householdHead : null,
        nrc_number: data.nrc_number ?? null,
        phone_number: data.phone_number ?? null,
        village: householdVillage,
        barcode: TdltsBarcodeGenerator.generate('H', householdId),
        payment_status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
    } else if (data.household_id) {
      const selected = await qb
        .from('households')
        .select('household_id', 'head_of_house', 'village')
        .where('household_id', String(data.household_id))
        .first()

      if (selected) {
        householdId = String(selected.household_id)
        householdHead = String(selected.head_of_house ?? '')
        const village = String(selected.village ?? '')
        householdVillage = village !== '' ? village : null
      }
    }

    const patient = await Patient.create(
      {
        patientId: await this.generatePatientNumber(client),
        fullName: data.full_name,
        gender: data.gender ?? null,
        dateOfBirth: toDateTime(data.date_of_birth ?? null),
        nrcNumber: data.nrc_number ?? null,
        phoneNumber: data.phone_number ?? null,
        email: data.email ?? null,
        cityTownVillage: householdVillage,
        relationshipToHead: createHousehold ? 'Head' : householdId ? 'Member' : null,
        householdHeadOfHouse: householdHead && householdHead !== '' ? householdHead : null,
        householdId,
      },
      { client }
    )

    return { patient, wasExisting: false }
  }

  private async generatePatientNumber(client?: TransactionClientContract): Promise<string> {
    const latest = await Patient.query({ client }).orderBy('id', 'desc').first()
    const nextId = latest ? latest.id + 1 : 1
    return TdltsBarcodeGenerator.generate('P', nextId)
  }

  private async generateHouseholdId(qb: QueryClientContract): Promise<string> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidate = `HH-${DateTime.now().toFormat('yyyyLLdd')}-${String(
        Math.floor(Math.random() * 10000)
      ).padStart(4, '0')}`

      const exists = await qb.from('households').where('household_id', candidate).first()
      if (!exists) {
        return candidate
      }
    }
  }
}
