import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import LabRequestItem from './lab_request_item.js'
import LabSample from './lab_sample.js'
import TestType from './test_type.js'

export default class LabSpecimenType extends BaseModel {
  static table = 'lab_specimen_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare code: string | null

  @column()
  declare defaultUnit: string | null

  @column()
  declare testCategory: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => LabRequestItem, { foreignKey: 'labSpecimenTypeId' })
  declare labRequestItems: HasMany<typeof LabRequestItem>

  @hasMany(() => LabSample, { foreignKey: 'labSpecimenTypeId' })
  declare labSamples: HasMany<typeof LabSample>

  @hasMany(() => TestType, { foreignKey: 'labSpecimenTypeId' })
  declare testTypes: HasMany<typeof TestType>

}
