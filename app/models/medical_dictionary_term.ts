import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type DictionaryDomain = 'diagnosis' | 'drug' | 'lab' | 'symptom'
export type DictionarySource = 'icd11' | 'ntg' | 'medication' | 'test_type' | 'lab_test_catalog' | 'manual' | 'symptom'

export default class MedicalDictionaryTerm extends BaseModel {
  static table = 'medical_dictionary_terms'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare domain: DictionaryDomain

  @column()
  declare code: string | null

  @column()
  declare label: string

  /** JSON-encoded string array */
  @column()
  declare synonyms: string | null

  @column()
  declare definition: string | null

  @column()
  declare hierarchyPath: string | null

  @column()
  declare source: DictionarySource

  @column()
  declare sourceId: string | null

  @column()
  declare hiaCode: string | null

  @column()
  declare isActive: boolean

  @column()
  declare updatedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  get synonymList(): string[] {
    if (!this.synonyms) return []
    try {
      const parsed = JSON.parse(this.synonyms)
      return Array.isArray(parsed) ? parsed.map((s) => String(s)).filter(Boolean) : []
    } catch {
      return []
    }
  }

  setSynonymList(values: string[]): void {
    const cleaned = [...new Set(values.map((v) => v.trim()).filter(Boolean))]
    this.synonyms = cleaned.length ? JSON.stringify(cleaned) : null
  }
}
