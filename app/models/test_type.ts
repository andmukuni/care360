import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, afterSave, afterDelete } from '@adonisjs/lucid/orm'
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

  @afterSave()
  static async invalidateReferenceCache(testType: TestType) {
    const { invalidateTestTypeCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidateTestTypeCache(testType)
  }

  @afterDelete()
  static async invalidateReferenceCacheOnDelete(testType: TestType) {
    const { invalidateTestTypeCache } = await import('#models/hooks/cache_invalidation_hooks')
    await invalidateTestTypeCache(testType)
  }
}
