import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import BedAccessory from './bed_accessory.js'
import BedAssignment from './bed_assignment.js'
import Encounter from './encounter.js'
import Ward from './ward.js'

export default class Bed extends BaseModel {
  static table = 'beds'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare wardId: number

  @column()
  declare bedNumber: string

  @column()
  declare status: string

  @column()
  declare encounterId: number | null

  @column()
  declare patientName: string | null

  @column.dateTime()
  declare admittedAt: DateTime | null

  @column.dateTime()
  declare dischargedAt: DateTime | null

  @column()
  declare notes: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Encounter, { foreignKey: 'encounterId' })
  declare encounter: BelongsTo<typeof Encounter>

  @belongsTo(() => Ward, { foreignKey: 'wardId' })
  declare ward: BelongsTo<typeof Ward>

  @hasMany(() => BedAccessory, { foreignKey: 'bedId' })
  declare bedAccessories: HasMany<typeof BedAccessory>

  @hasMany(() => BedAssignment, { foreignKey: 'bedId' })
  declare bedAssignments: HasMany<typeof BedAssignment>

}
