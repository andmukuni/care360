import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import LabTestCatalog from '#models/lab_test_catalog'
import Medication from '#models/medication'
import Permission from '#models/permission'
import RateCardService from '#models/rate_card_service'
import Role from '#models/role'

const VISIT_TYPES = ['OPD', 'ANC', 'Immunisation', 'HIV Testing', 'ART', 'Admission', 'Appointment', 'Other']

const CONSULTATION_PRICES: Record<string, number> = {
  OPD: 150,
  ANC: 150,
  Immunisation: 100,
  'HIV Testing': 80,
  ART: 120,
  Admission: 200,
  Appointment: 150,
  Other: 150,
}

export default class extends BaseSeeder {
  async run() {
    await this.seedPermissions()
    await this.seedConsultations()
    await this.seedLabTests()
    await this.seedMedications()
    await this.seedTreatmentRoom()
  }

  private async seedPermissions() {
    const names = ['rate-card.read', 'rate-card.manage']

    for (const name of names) {
      await Permission.firstOrCreate({ name, guardName: 'web' })
    }

    const permissionIds = await Permission.query().whereIn('name', names).select('id')
    const ids = permissionIds.map((p) => p.id)

    for (const roleName of ['super-admin', 'records-officer']) {
      const role = await Role.query().where('name', roleName).where('guardName', 'web').first()
      if (!role) {
        continue
      }

      for (const permissionId of ids) {
        const exists = await db
          .from('role_has_permissions')
          .where('role_id', role.id)
          .where('permission_id', permissionId)
          .first()

        if (!exists) {
          await db.table('role_has_permissions').insert({
            role_id: role.id,
            permission_id: permissionId,
          })
        }
      }
    }
  }

  private async seedConsultations() {
    for (const visitType of VISIT_TYPES) {
      const code = `CONSULT_${visitType.replace(/\s+/g, '_').toUpperCase()}`
      await this.upsert({
        code,
        name: `${visitType} Consultation`,
        category: 'hospital',
        activityType: 'consultation',
        activityKey: visitType,
        price: CONSULTATION_PRICES[visitType] ?? 150,
      })
    }
  }

  private async seedLabTests() {
    const tests = await LabTestCatalog.query().where('isActive', true).orderBy('name')

    for (const test of tests) {
      const code = (test.code ?? `LAB_${test.name.replace(/\s+/g, '_').toUpperCase()}`).slice(0, 80)
      await this.upsert({
        code: await this.uniqueCode(code, 'lab_test_catalog_id', test.id),
        name: test.name,
        category: 'hospital',
        activityType: 'lab_test',
        activityKey: test.name,
        labTestCatalogId: test.id,
        price: 120,
      })
    }
  }

  private async seedMedications() {
    const medications = await Medication.query().where('isActive', true).orderBy('name')

    for (const medication of medications) {
      const base = `PHARM_${medication.name.replace(/\s+/g, '_').toUpperCase()}`.slice(0, 72)
      await this.upsert({
        code: `${base}_${medication.id}`,
        name: medication.name,
        category: 'pharmacy',
        activityType: 'medication',
        activityKey: medication.name,
        medicationId: medication.id,
        price: 35,
      })
    }
  }

  private async seedTreatmentRoom() {
    await this.upsert({
      code: 'TREATMENT_ROOM_DEFAULT',
      name: 'Treatment Room Services',
      category: 'hospital',
      activityType: 'treatment_room',
      activityKey: 'default',
      price: 100,
    })
  }

  private async upsert(data: {
    code: string
    name: string
    category: string
    activityType: string
    activityKey: string
    labTestCatalogId?: number
    medicationId?: number
    price: number
  }) {
    let existing: RateCardService | null = null

    if (data.labTestCatalogId) {
      existing = await RateCardService.query().where('labTestCatalogId', data.labTestCatalogId).first()
    } else if (data.medicationId) {
      existing = await RateCardService.query().where('medicationId', data.medicationId).first()
    } else if (data.activityType === 'consultation') {
      existing = await RateCardService.query()
        .where('activityType', 'consultation')
        .where('activityKey', data.activityKey)
        .first()
    } else if (data.activityType === 'treatment_room') {
      existing = await RateCardService.query().where('activityType', 'treatment_room').first()
    }

    existing ??= await RateCardService.query().where('code', data.code).first()

    if (existing) {
      existing.merge({
        name: data.name,
        activityKey: data.activityKey,
        labTestCatalogId: data.labTestCatalogId ?? null,
        medicationId: data.medicationId ?? null,
        isActive: true,
      })
      await existing.save()
      return
    }

    await RateCardService.create({
      code: data.code,
      name: data.name,
      category: data.category as RateCardService['category'],
      activityType: data.activityType as RateCardService['activityType'],
      activityKey: data.activityKey,
      labTestCatalogId: data.labTestCatalogId ?? null,
      medicationId: data.medicationId ?? null,
      price: data.price,
      isActive: true,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    })
  }

  private async uniqueCode(baseCode: string, linkColumn: 'lab_test_catalog_id' | 'medication_id', linkId: number) {
    const exists = await RateCardService.query().where('code', baseCode).first()
    if (!exists) {
      return baseCode
    }

    return `${baseCode.slice(0, 70)}_${linkId}`
  }
}
