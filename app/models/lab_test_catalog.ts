import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import LabResultForm from './lab_result_form.js'

export default class LabTestCatalog extends BaseModel {
  static table = 'lab_test_catalog'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string | null

  @column()
  declare name: string

  @column()
  declare group: string | null

  @column()
  declare specimen: string | null

  @column()
  declare labResultFormId: number | null

  @column()
  declare isCommon: boolean

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabResultForm, { foreignKey: 'labResultFormId' })
  declare labResultForm: BelongsTo<typeof LabResultForm>

}
