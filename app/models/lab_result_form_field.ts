import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import LabResultForm from './lab_result_form.js'

export default class LabResultFormField extends BaseModel {
  static table = 'lab_result_form_fields'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare labResultFormId: number

  @column()
  declare key: string

  @column()
  declare label: string

  @column()
  declare fieldType: string

  @column()
  declare options: string | null

  @column()
  declare placeholder: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isRequired: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabResultForm, { foreignKey: 'labResultFormId' })
  declare labResultForm: BelongsTo<typeof LabResultForm>

}
