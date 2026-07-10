import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import LabRequest from './lab_request.js'
import LabResult from './lab_result.js'
import LabSpecimenType from './lab_specimen_type.js'

export default class LabRequestItem extends BaseModel {
  static table = 'lab_request_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare labRequestId: number

  @column()
  declare testCode: string | null

  @column()
  declare testName: string

  @column()
  declare specimenType: string | null

  @column()
  declare labSpecimenTypeId: number | null

  @column()
  declare testGroup: string | null

  @column()
  declare instructions: string | null

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabRequest, { foreignKey: 'labRequestId' })
  declare labRequest: BelongsTo<typeof LabRequest>

  @belongsTo(() => LabSpecimenType, { foreignKey: 'labSpecimenTypeId' })
  declare labSpecimenType: BelongsTo<typeof LabSpecimenType>

  @hasMany(() => LabResult, { foreignKey: 'labRequestItemId' })
  declare labResults: HasMany<typeof LabResult>

}
