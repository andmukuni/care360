import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TestType from './test_type.js'

export type PossibleResultMatchKind =
  | 'interpretation'
  | 'value_equals'
  | 'value_contains'
  | 'any_result'

export type PossibleResultTriggerContext =
  | 'lab_result'
  | 'symptom'
  | 'vital'
  | 'diagnosis_keyword'

export type PossibleResultTargetField =
  | 'final_diagnosis'
  | 'clinical_findings'
  | 'physical_examination'
  | 'assessment_notes'
  | 'plan'
  | 'review_notes'
  | 'treatment_plan'
  | 'provisional_diagnosis'
  | 'prescription'
  | 'chief_complaint_brief'

export type PrescriptionSuggestionItem = {
  drug_name: string
  dose?: string | null
  formulation?: string | null
  frequency?: string | null
  frequency_unit?: string | null
  duration?: string | null
  duration_unit?: string | null
  route?: string | null
  quantity_prescribed?: number | null
  instructions?: string | null
}

export default class PossibleResult extends BaseModel {
  static table = 'possible_results'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare testName: string | null

  @column()
  declare testTypeId: number | null

  @column()
  declare matchKind: PossibleResultMatchKind

  @column()
  declare matchValue: string | null

  @column()
  declare targetField: PossibleResultTargetField

  @column()
  declare suggestionText: string | null

  @column()
  declare prescriptionPayload: string | null

  @column()
  declare stageScope: string

  @column()
  declare triggerContext: PossibleResultTriggerContext

  @column()
  declare contextMatch: string | null

  @column()
  declare priority: number

  @column()
  declare isActive: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => TestType, { foreignKey: 'testTypeId' })
  declare testType: BelongsTo<typeof TestType>

  parsedStageScope(): string[] {
    if (!this.stageScope) return []
    try {
      const parsed = JSON.parse(this.stageScope)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }

  parsedPrescriptionPayload(): PrescriptionSuggestionItem[] {
    if (!this.prescriptionPayload) return []
    try {
      const parsed = JSON.parse(this.prescriptionPayload)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
