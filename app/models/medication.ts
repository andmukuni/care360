import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany, afterSave, afterDelete } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import PharmacyDispenseItem from './pharmacy_dispense_item.js'
import StartupMedication from './startup_medication.js'
import Unit from './unit.js'

export default class Medication extends BaseModel {
  static table = 'medications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare unit: string | null

  @column()
  declare genericName: string | null

  @column()
  declare category: string

  @column()
  declare form: string

  @column()
  declare strength: string | null

  @column()
  declare defaultRoute: string | null

  @column()
  declare defaultFrequency: string | null

  @column()
  declare isControlled: boolean

  @column()
  declare isActive: boolean

  @column()
  declare stockOnHand: number | null

  @column()
  declare reorderThreshold: number | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => PharmacyDispenseItem, { foreignKey: 'medicationId' })
  declare pharmacyDispenseItems: HasMany<typeof PharmacyDispenseItem>

  @hasMany(() => StartupMedication, { foreignKey: 'medicationId' })
  declare startupMedications: HasMany<typeof StartupMedication>

  @manyToMany(() => Unit, {
    pivotTable: 'medication_unit',
    pivotForeignKey: 'medication_id',
    pivotRelatedForeignKey: 'unit_id',
  })
  declare units: ManyToMany<typeof Unit>

  @afterSave()
  static async invalidateReferenceCache(medication: Medication) {
    const { invalidateMedicationCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidateMedicationCache(medication)
  }

  @afterDelete()
  static async invalidateReferenceCacheOnDelete(medication: Medication) {
    const { invalidateMedicationCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidateMedicationCache(medication)
  }
}
