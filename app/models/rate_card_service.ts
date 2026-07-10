import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import LabTestCatalog from './lab_test_catalog.js'
import Medication from './medication.js'

export type RateCardActivityType = 'consultation' | 'lab_test' | 'medication' | 'treatment_room'
export type RateCardCategory = 'hospital' | 'pharmacy' | 'excluded' | 'outsourced'

export default class RateCardService extends BaseModel {
  static table = 'rate_card_services'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare category: RateCardCategory

  @column()
  declare activityType: RateCardActivityType

  @column()
  declare activityKey: string | null

  @column()
  declare labTestCatalogId: number | null

  @column()
  declare medicationId: number | null

  @column()
  declare price: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabTestCatalog, { foreignKey: 'labTestCatalogId' })
  declare labTestCatalog: BelongsTo<typeof LabTestCatalog>

  @belongsTo(() => Medication, { foreignKey: 'medicationId' })
  declare medication: BelongsTo<typeof Medication>
}
