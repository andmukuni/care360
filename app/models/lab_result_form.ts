import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import LabResultFormField from './lab_result_form_field.js'
import LabTestCatalog from './lab_test_catalog.js'
import TestType from './test_type.js'

export default class LabResultForm extends BaseModel {
  static table = 'lab_result_forms'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column()
  declare label: string

  @column()
  declare description: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column()
  declare isSystem: boolean

  @column()
  declare templateKey: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => LabResultFormField, { foreignKey: 'labResultFormId' })
  declare labResultFormFields: HasMany<typeof LabResultFormField>

  @hasMany(() => LabTestCatalog, { foreignKey: 'labResultFormId' })
  declare labTestCatalog: HasMany<typeof LabTestCatalog>

  @hasMany(() => TestType, { foreignKey: 'labResultFormId' })
  declare testTypes: HasMany<typeof TestType>

}
