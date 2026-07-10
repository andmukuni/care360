import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import LabResultForm from './lab_result_form.js'
import LabSpecimenType from './lab_specimen_type.js'

export default class TestType extends BaseModel {
  static table = 'test_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare labResultFormId: number | null

  @column()
  declare isActive: boolean

  @column()
  declare labSpecimenTypeId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => LabResultForm, { foreignKey: 'labResultFormId' })
  declare labResultForm: BelongsTo<typeof LabResultForm>

  @belongsTo(() => LabSpecimenType, { foreignKey: 'labSpecimenTypeId' })
  declare labSpecimenType: BelongsTo<typeof LabSpecimenType>

}
