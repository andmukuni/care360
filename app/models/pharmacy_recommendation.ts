import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Encounter from './encounter.js'
import PharmacyPrescriptionItem from './pharmacy_prescription_item.js'
import User from './user.js'

export default class PharmacyRecommendation extends BaseModel {
  static table = 'pharmacy_recommendations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare encounterId: number

  @column()
  declare sourcePrescriptionId: number | null

  @column()
  declare sourcePrescriptionItemId: number

  @column()
  declare recommendedPrescriptionId: number | null

  @column()
  declare recommendedPrescriptionItemId: number | null

  @column()
  declare recommendedBy: number | null

  @column()
  declare status: string

  @column()
  declare recommendationNote: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => User, { foreignKey: 'recommendedBy' })
  declare recommendedByUser: BelongsTo<typeof User>

  @belongsTo(() => PharmacyPrescriptionItem, { foreignKey: 'sourcePrescriptionItemId' })
  declare sourceItem: BelongsTo<typeof PharmacyPrescriptionItem>

  @belongsTo(() => PharmacyPrescriptionItem, { foreignKey: 'recommendedPrescriptionItemId' })
  declare recommendedItem: BelongsTo<typeof PharmacyPrescriptionItem>
}