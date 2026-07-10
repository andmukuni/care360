import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
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

export default class SetupRateCard extends BaseCommand {
  static commandName = 'setup:rate-card'
  static description = 'Create rate_card_services table and seed linked service prices'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    await this.createTableIfMissing()
    await this.markUsersMigrationComplete()
    await this.seedPermissions()
    await this.seedConsultations()
    await this.seedLabTests()
    await this.seedMedications()
    await this.seedTreatmentRoom()

    const counts = await db
      .from('rate_card_services')
      .select('activity_type')
      .count('* as total')
      .groupBy('activity_type')

    const byType: Record<string, number> = {}
    for (const row of counts) {
      byType[row.activity_type as string] = Number(row.total)
    }

    this.logger.success(
      `Rate card ready. Consultations: ${byType.consultation ?? 0}, lab tests: ${byType.lab_test ?? 0}, medications: ${byType.medication ?? 0}, treatment room: ${byType.treatment_room ?? 0}`
    )
  }

  private async createTableIfMissing() {
    const result = await db.rawQuery("SELECT to_regclass('public.rate_card_services') AS tbl")
    if (result.rows[0]?.tbl) {
      this.logger.info('rate_card_services table already exists')
      return
    }

    await db.rawQuery(`
      CREATE TABLE rate_card_services (
        id SERIAL PRIMARY KEY,
        code VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'hospital',
        activity_type VARCHAR(50) NOT NULL,
        activity_key VARCHAR(255) NULL,
        lab_test_catalog_id INTEGER NULL REFERENCES lab_test_catalog(id) ON DELETE SET NULL,
        medication_id INTEGER NULL REFERENCES medications(id) ON DELETE SET NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)

    await db.rawQuery('CREATE INDEX rate_card_services_activity_type_activity_key_index ON rate_card_services (activity_type, activity_key)')
    await db.rawQuery('CREATE INDEX rate_card_services_is_active_index ON rate_card_services (is_active)')
    await db.rawQuery('CREATE INDEX rate_card_services_lab_test_catalog_id_index ON rate_card_services (lab_test_catalog_id)')
    await db.rawQuery('CREATE INDEX rate_card_services_medication_id_index ON rate_card_services (medication_id)')

    const migrationName = 'database/migrations/1783700000000_create_rate_card_services_table'
    const exists = await db.from('adonis_schema').where('name', migrationName).first()
    if (!exists) {
      await db.table('adonis_schema').insert({
        name: migrationName,
        batch: 1,
        migration_time: DateTime.now().toSQL({ includeOffset: false }),
      })
    }

    this.logger.success('Created rate_card_services table')
  }

  private async markUsersMigrationComplete() {
    const migrationName = 'database/migrations/1783426941920_create_users_table'
    const exists = await db.from('adonis_schema').where('name', migrationName).first()
    if (!exists) {
      await db.table('adonis_schema').insert({
        name: migrationName,
        batch: 1,
        migration_time: DateTime.now().toSQL({ includeOffset: false }),
      })
      this.logger.info('Marked users migration as complete')
    }
  }

  private async seedPermissions() {
    const names = ['rate-card.read', 'rate-card.manage']

    for (const name of names) {
      await Permission.firstOrCreate({ name, guardName: 'web' })
    }

    const permissionIds = (await Permission.query().whereIn('name', names)).map((p) => p.id)

    for (const roleName of ['super-admin', 'records-officer']) {
      const role = await Role.query().where('name', roleName).where('guardName', 'web').first()
      if (!role) {
        continue
      }

      for (const permissionId of permissionIds) {
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

    this.logger.success('Rate card permissions assigned')
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

  private async seedLabTests(): Promise<number> {
    const tests = await LabTestCatalog.query().where('isActive', true).orderBy('name')
    const existingByCatalog = new Set(
      (await RateCardService.query().whereNotNull('labTestCatalogId').select('labTestCatalogId')).map(
        (r) => r.labTestCatalogId!
      )
    )
    const usedCodes = new Set(
      (await RateCardService.query().select('code')).map((r) => r.code)
    )

    const toInsert: Record<string, unknown>[] = []
    for (const test of tests) {
      if (existingByCatalog.has(test.id)) {
        continue
      }

      let code = `LAB_${test.id}`
      if (test.code) {
        code = `LAB_${test.code}`.slice(0, 70)
        if (usedCodes.has(code)) {
          code = `LAB_${test.id}`
        }
      }

      usedCodes.add(code)
      toInsert.push({
        code,
        name: test.name,
        category: 'hospital',
        activity_type: 'lab_test',
        activity_key: test.name,
        lab_test_catalog_id: test.id,
        medication_id: null,
        price: 120,
        is_active: true,
        created_at: DateTime.now().toSQL({ includeOffset: false }),
        updated_at: DateTime.now().toSQL({ includeOffset: false }),
      })
    }

    await this.bulkInsert(toInsert)
    return tests.length
  }

  private async seedMedications(): Promise<number> {
    const medications = await Medication.query().where('isActive', true).orderBy('name')
    const existingByMedication = new Set(
      (await RateCardService.query().whereNotNull('medicationId').select('medicationId')).map((r) => r.medicationId!)
    )

    const toInsert: Record<string, unknown>[] = []
    for (const medication of medications) {
      if (existingByMedication.has(medication.id)) {
        continue
      }

      toInsert.push({
        code: `PHARM_${medication.id}`,
        name: medication.name,
        category: 'pharmacy',
        activity_type: 'medication',
        activity_key: medication.name,
        lab_test_catalog_id: null,
        medication_id: medication.id,
        price: 35,
        is_active: true,
        created_at: DateTime.now().toSQL({ includeOffset: false }),
        updated_at: DateTime.now().toSQL({ includeOffset: false }),
      })
    }

    await this.bulkInsert(toInsert)
    return medications.length
  }

  private async bulkInsert(rows: Record<string, unknown>[]) {
    const chunkSize = 100
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      if (!chunk.length) {
        continue
      }

      await db.table('rate_card_services').multiInsert(chunk)
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
    })
  }

  private async uniqueCode(baseCode: string, linkId: number) {
    const exists = await RateCardService.query().where('code', baseCode).first()
    if (!exists) {
      return baseCode
    }

    return `${baseCode.slice(0, 70)}_${linkId}`
  }
}
