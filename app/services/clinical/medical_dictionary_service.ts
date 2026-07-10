import { readFileSync, existsSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import MedicalDictionaryTerm, {
  type DictionaryDomain,
  type DictionarySource,
} from '#models/medical_dictionary_term'
import Medication from '#models/medication'
import TestType from '#models/test_type'
import LabTestCatalog from '#models/lab_test_catalog'
import {
  CHRONIC_LEVEL2_BY_LEVEL1,
  CHRONIC_LEVEL3_BY_LEVEL2,
  NTG_LEVEL1_OPTIONS,
} from '#support/clinical/ntg_catalog'

export type DictionarySearchHit = {
  id: number
  domain: DictionaryDomain
  code: string | null
  label: string
  synonyms: string[]
  definition: string | null
  hierarchy_path: string | null
  source: string
  hia_code: string | null
}

const CURATED_DEFINITIONS: Record<string, string> = {
  malaria:
    'Parasitic infection transmitted by Anopheles mosquitoes; presents with fever, chills, headache, and may progress to severe disease.',
  cough: 'Forceful expulsion of air from the lungs; may be dry or productive and can signal respiratory infection or TB.',
  fever: 'Elevated body temperature, commonly ≥38°C; a non-specific sign of infection or inflammation.',
  tuberculosis:
    'Mycobacterial infection, often pulmonary; look for prolonged cough, night sweats, weight loss, and fever.',
  hypertension: 'Persistently elevated blood pressure; a major risk factor for stroke, heart failure, and kidney disease.',
  anaemia: 'Reduced haemoglobin or red-cell mass leading to fatigue, pallor, and reduced oxygen delivery.',
  diarrhoea: 'Frequent loose or watery stools; assess dehydration and infectious causes.',
  pneumonia: 'Infection of the lung parenchyma; typically fever, cough, and abnormal chest findings.',
  diabetes: 'Disorder of glucose regulation; may present with polyuria, polydipsia, weight change, or complications.',
  asthma: 'Reversible airway obstruction with wheeze, cough, and breathlessness; often triggered by allergens or infection.',
  'iron deficiency anaemia': 'Anaemia due to insufficient iron stores; common in women of reproductive age and children.',
  'night sweats': 'Drenching sweats during sleep; concerning for TB, HIV, or other systemic illness when persistent.',
  'weight loss': 'Unintentional loss of body weight; investigate infection, malignancy, malnutrition, or metabolic disease.',
  lethargy: 'Marked tiredness or reduced energy; evaluate for anaemia, infection, metabolic, or psychosocial causes.',
  'shortness of breath': 'Subjective difficulty breathing; urgent evaluation if sudden, severe, or with chest pain.',
  'chest pain': 'Pain or discomfort in the chest; differentiate cardiac, respiratory, musculoskeletal, and GI causes.',
  fatigue: 'Persistent tiredness not relieved by rest; broad differential including anaemia, infection, and depression.',
  'blood-stained sputum': 'Haemoptysis; requires prompt assessment for TB, pneumonia, or other serious lung disease.',
}

const SYMPTOM_SEED: Array<{ key: string; label: string; definition: string }> = [
  {
    key: 'cough',
    label: 'Cough',
    definition: CURATED_DEFINITIONS.cough,
  },
  {
    key: 'fever',
    label: 'Fever',
    definition: CURATED_DEFINITIONS.fever,
  },
  {
    key: 'lethargy',
    label: 'Lethargy',
    definition: CURATED_DEFINITIONS.lethargy,
  },
  {
    key: 'weight_loss',
    label: 'Weight Loss',
    definition: CURATED_DEFINITIONS['weight loss'],
  },
  {
    key: 'blood_stained_sputum',
    label: 'Blood-stained sputum',
    definition: CURATED_DEFINITIONS['blood-stained sputum'],
  },
  {
    key: 'shortness_of_breath',
    label: 'Shortness of breath',
    definition: CURATED_DEFINITIONS['shortness of breath'],
  },
  {
    key: 'chest_pain',
    label: 'Chest Pain',
    definition: CURATED_DEFINITIONS['chest pain'],
  },
  {
    key: 'night_sweats',
    label: 'Night Sweats',
    definition: CURATED_DEFINITIONS['night sweats'],
  },
  {
    key: 'fatigue',
    label: 'Fatigue',
    definition: CURATED_DEFINITIONS.fatigue,
  },
]

function curatedDefinitionFor(label: string): string | null {
  const key = label.trim().toLowerCase()
  if (CURATED_DEFINITIONS[key]) return CURATED_DEFINITIONS[key]
  for (const [needle, def] of Object.entries(CURATED_DEFINITIONS)) {
    if (key.includes(needle)) return def
  }
  return null
}

function serialize(term: MedicalDictionaryTerm): DictionarySearchHit {
  return {
    id: term.id,
    domain: term.domain,
    code: term.code,
    label: term.label,
    synonyms: term.synonymList,
    definition: term.definition,
    hierarchy_path: term.hierarchyPath,
    source: term.source,
    hia_code: term.hiaCode,
  }
}

export default class MedicalDictionaryService {
  static serialize = serialize

  static async search(options: {
    domain?: DictionaryDomain | null
    q?: string
    limit?: number
    activeOnly?: boolean
  }): Promise<DictionarySearchHit[]> {
    const q = (options.q ?? '').trim()
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
    const activeOnly = options.activeOnly !== false

    const query = MedicalDictionaryTerm.query()
      .if(activeOnly, (builder) => builder.where('is_active', true))
      .if(options.domain, (builder) => builder.where('domain', options.domain!))
      .if(q !== '', (builder) => {
        const like = `%${q}%`
        builder.where((sub) => {
          sub
            .whereILike('label', like)
            .orWhereILike('code', like)
            .orWhereILike('hierarchy_path', like)
            .orWhereILike('synonyms', like)
            .orWhereILike('definition', like)
        })
      })
      .orderBy('label')
      .limit(limit)

    const rows = await query
    return rows.map(serialize)
  }

  static async find(id: number): Promise<DictionarySearchHit | null> {
    const term = await MedicalDictionaryTerm.find(id)
    return term ? serialize(term) : null
  }

  static async definitionsByLabels(
    domain: DictionaryDomain,
    labels: string[]
  ): Promise<Record<string, string | null>> {
    const cleaned = [...new Set(labels.map((l) => l.trim()).filter(Boolean))]
    if (!cleaned.length) return {}

    const rows = await MedicalDictionaryTerm.query()
      .where('domain', domain)
      .where('is_active', true)
      .whereIn('label', cleaned)

    const map: Record<string, string | null> = {}
    for (const label of cleaned) map[label] = null
    for (const row of rows) {
      map[row.label] = row.definition
    }
    return map
  }

  /**
   * Upsert a synced term. Preserves manually edited definitions unless
   * `overwriteDefinition` is true or the existing definition is empty.
   */
  static async upsertFromSource(input: {
    domain: DictionaryDomain
    source: DictionarySource
    sourceId: string
    label: string
    code?: string | null
    synonyms?: string[]
    hierarchyPath?: string | null
    definition?: string | null
    hiaCode?: string | null
    overwriteDefinition?: boolean
  }): Promise<MedicalDictionaryTerm> {
    const existing = await MedicalDictionaryTerm.query()
      .where('domain', input.domain)
      .where('source', input.source)
      .where('source_id', input.sourceId)
      .first()

    const nextDefinition =
      input.overwriteDefinition || !existing?.definition
        ? (input.definition ?? existing?.definition ?? null)
        : existing.definition

    if (existing) {
      existing.label = input.label
      existing.code = input.code ?? existing.code
      existing.hierarchyPath = input.hierarchyPath ?? existing.hierarchyPath
      existing.hiaCode = input.hiaCode ?? existing.hiaCode
      existing.definition = nextDefinition
      existing.isActive = true
      if (input.synonyms) existing.setSynonymList(input.synonyms)
      await existing.save()
      return existing
    }

    const created = new MedicalDictionaryTerm()
    created.domain = input.domain
    created.source = input.source
    created.sourceId = input.sourceId
    created.label = input.label
    created.code = input.code ?? null
    created.hierarchyPath = input.hierarchyPath ?? null
    created.definition = input.definition ?? curatedDefinitionFor(input.label)
    created.hiaCode = input.hiaCode ?? null
    created.isActive = true
    created.setSynonymList(input.synonyms ?? [])
    await created.save()
    return created
  }

  private static async existingBySourceId(
    domain: DictionaryDomain,
    source: DictionarySource
  ): Promise<Map<string, MedicalDictionaryTerm>> {
    const rows = await MedicalDictionaryTerm.query().where('domain', domain).where('source', source)
    return new Map(rows.filter((r) => r.sourceId).map((r) => [r.sourceId!, r]))
  }

  private static async flushTerms(terms: MedicalDictionaryTerm[]): Promise<void> {
    if (!terms.length) return
    const trx = await db.transaction()
    try {
      for (const term of terms) {
        term.useTransaction(trx)
        await term.save()
      }
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  static async syncAll(options: { logger?: (msg: string) => void } = {}): Promise<{
    icd11: number
    ntg: number
    medications: number
    lab: number
    symptoms: number
  }> {
    const log = options.logger ?? (() => {})
    const icd11 = await this.syncIcd11(log)
    const ntg = await this.syncNtg(log)
    const medications = await this.syncMedications(log)
    const lab = await this.syncLab(log)
    const symptoms = await this.syncSymptoms(log)
    return { icd11, ntg, medications, lab, symptoms }
  }

  static async syncIcd11(log: (msg: string) => void = () => {}): Promise<number> {
    const path = app.makePath('resources/data/icd11-library.txt')
    if (!existsSync(path)) {
      log('ICD-11 library file missing; skipped.')
      return 0
    }

    const lines = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const existing = await this.existingBySourceId('diagnosis', 'icd11')
    const chunkSize = 250
    const pending: MedicalDictionaryTerm[] = []
    let count = 0

    for (const [index, label] of lines.entries()) {
      const sourceId = `icd11:${index + 1}`
      const definition = curatedDefinitionFor(label)
      let term = existing.get(sourceId)

      if (term) {
        term.label = label
        term.definition = term.definition || definition
        term.isActive = true
      } else {
        term = new MedicalDictionaryTerm()
        term.domain = 'diagnosis'
        term.source = 'icd11'
        term.sourceId = sourceId
        term.label = label
        term.definition = definition
        term.isActive = true
        existing.set(sourceId, term)
      }

      pending.push(term)
      count++

      if (pending.length >= chunkSize) {
        await this.flushTerms(pending)
        pending.length = 0
        if (count % 500 === 0) log(`ICD-11 synced ${count}/${lines.length}`)
      }
    }

    await this.flushTerms(pending)
    log(`ICD-11 synced ${count} terms`)
    return count
  }

  static async syncNtg(log: (msg: string) => void = () => {}): Promise<number> {
    let count = 0
    for (const level1 of NTG_LEVEL1_OPTIONS) {
      const level2List = CHRONIC_LEVEL2_BY_LEVEL1[level1] ?? []
      for (const level2 of level2List) {
        const level3List = CHRONIC_LEVEL3_BY_LEVEL2[level2] ?? []
        if (!level3List.length) {
          await this.upsertFromSource({
            domain: 'diagnosis',
            source: 'ntg',
            sourceId: `ntg:${level1}>${level2}`,
            label: level2,
            hierarchyPath: `${level1} > ${level2}`,
            synonyms: [level1],
            definition: curatedDefinitionFor(level2),
          })
          count++
          continue
        }
        for (const level3 of level3List) {
          await this.upsertFromSource({
            domain: 'diagnosis',
            source: 'ntg',
            sourceId: `ntg:${level1}>${level2}>${level3}`,
            label: level3,
            hierarchyPath: `${level1} > ${level2} > ${level3}`,
            synonyms: [level1, level2],
            definition: curatedDefinitionFor(level3),
          })
          count++
        }
      }
    }
    log(`NTG synced ${count} terms`)
    return count
  }

  static async syncMedications(log: (msg: string) => void = () => {}): Promise<number> {
    const meds = await Medication.query().where('isActive', true).orderBy('name')
    let count = 0
    for (const med of meds) {
      const synonyms = [med.genericName, med.category, med.form, med.strength].filter(
        (v): v is string => Boolean(v && String(v).trim())
      )
      await this.upsertFromSource({
        domain: 'drug',
        source: 'medication',
        sourceId: String(med.id),
        label: med.name,
        synonyms,
        definition: med.notes?.trim() || curatedDefinitionFor(med.name),
        hierarchyPath: med.category || null,
      })
      count++
    }
    log(`Medications synced ${count} terms`)
    return count
  }

  static async syncLab(log: (msg: string) => void = () => {}): Promise<number> {
    let count = 0
    const tests = await TestType.query().where('isActive', true).orderBy('name')
    for (const test of tests) {
      await this.upsertFromSource({
        domain: 'lab',
        source: 'test_type',
        sourceId: String(test.id),
        label: test.name,
        synonyms: test.description ? [test.description] : [],
        definition: test.description?.trim() || curatedDefinitionFor(test.name),
      })
      count++
    }

    try {
      const catalog = await LabTestCatalog.query().where('isActive', true).orderBy('name')
      for (const row of catalog) {
        await this.upsertFromSource({
          domain: 'lab',
          source: 'lab_test_catalog',
          sourceId: String(row.id),
          label: row.name,
          code: row.code ?? null,
          synonyms: [row.code, row.group, row.specimen].filter(
            (v): v is string => Boolean(v && String(v).trim())
          ),
          hierarchyPath: row.group ?? null,
          definition: curatedDefinitionFor(row.name),
        })
        count++
      }
    } catch {
      log('lab_test_catalog sync skipped (table/columns unavailable)')
    }

    log(`Lab synced ${count} terms`)
    return count
  }

  static async syncSymptoms(log: (msg: string) => void = () => {}): Promise<number> {
    let count = 0
    for (const symptom of SYMPTOM_SEED) {
      await this.upsertFromSource({
        domain: 'symptom',
        source: 'symptom',
        sourceId: symptom.key,
        label: symptom.label,
        synonyms: [symptom.key.replace(/_/g, ' ')],
        definition: symptom.definition,
        code: symptom.key,
      })
      count++
    }
    log(`Symptoms synced ${count} terms`)
    return count
  }
}
