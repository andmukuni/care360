import PossibleResult from '#models/possible_result'
import MedicalDictionaryTerm from '#models/medical_dictionary_term'
import type Encounter from '#models/encounter'
import type { SerializedLabItem } from '#support/encounter/lab_item_payload'
import {
  CLINICAL_FIELD_KEYS,
  type ClinicalFieldKey,
  type ClinicalSuggestionsPayload,
  type FieldSuggestion,
  type PrescriptionSuggestion,
  type StageScope,
} from '#support/clinical/clinical_suggestion_types'
import { normalizeMatchValue, normalizeTestName, testNamesMatch } from '#support/clinical/test_name_normalizer'

export type EncounterClinicalContext = {
  stage: StageScope
  labItems: SerializedLabItem[]
  triage?: {
    temperature?: number | null
    systolic_bp?: number | null
    diastolic_bp?: number | null
    pulse?: number | null
    oxygen_saturation?: number | null
  } | null
  screening?: {
    complaints?: string | null
    provisional_diagnosis?: string | null
    final_diagnosis?: string | null
    tb_symptoms?: string[] | null
  } | null
  review?: {
    final_diagnosis?: string | null
  } | null
}

type LabResultView = {
  test_name: string
  result_value: string | null
  result_text: string | null
  interpretation: string | null
}

/**
 * Rule-based clinical suggestion engine driven by `possible_results` rows.
 */
export default class ClinicalSuggestionService {
  async suggestForEncounter(
    _encounter: Encounter,
    context: EncounterClinicalContext
  ): Promise<ClinicalSuggestionsPayload> {
    const rules = await PossibleResult.query().where('is_active', true).orderBy('priority', 'desc')

    const fieldBuckets = Object.fromEntries(
      CLINICAL_FIELD_KEYS.map((k) => [k, [] as FieldSuggestion[]])
    ) as Record<ClinicalFieldKey, FieldSuggestion[]>

    const prescriptions: PrescriptionSuggestion[] = []
    const seenField = new Set<string>()
    const seenRx = new Set<string>()

    for (const rule of rules) {
      if (!this.ruleAppliesToStage(rule, context.stage)) continue

      if (rule.triggerContext === 'lab_result') {
        for (const item of context.labItems) {
          if (!item.result) continue
          if (!this.labRuleMatches(rule, item)) continue
          this.pushRuleMatch(rule, item, fieldBuckets, prescriptions, seenField, seenRx)
        }
        continue
      }

      if (await this.contextRuleMatches(rule, context)) {
        this.pushContextRuleMatch(rule, fieldBuckets, prescriptions, seenField, seenRx)
      }
    }

    return { fields: fieldBuckets, prescriptions }
  }

  private ruleAppliesToStage(rule: PossibleResult, stage: StageScope): boolean {
    const scopes = rule.parsedStageScope()
    return scopes.length === 0 || scopes.includes(stage)
  }

  private labRuleMatches(rule: PossibleResult, item: SerializedLabItem): boolean {
    if (rule.testName && !testNamesMatch(rule.testName, item.test_name)) {
      return false
    }

    const result = item.result!
    const view: LabResultView = {
      test_name: item.test_name,
      result_value: result.result_value,
      result_text: result.result_text,
      interpretation: result.interpretation,
    }

    return this.matchKindSatisfied(rule.matchKind, rule.matchValue, view)
  }

  private matchKindSatisfied(
    kind: string,
    matchValue: string | null,
    result: LabResultView
  ): boolean {
    const expected = normalizeMatchValue(matchValue)
    const interp = normalizeMatchValue(result.interpretation)
    const value = normalizeMatchValue(result.result_value)
    const text = normalizeMatchValue(result.result_text)

    switch (kind) {
      case 'any_result':
        return true
      case 'interpretation':
        return expected !== '' && interp === expected
      case 'value_equals':
        return expected !== '' && (value === expected || text === expected)
      case 'value_contains':
        return expected !== '' && (value.includes(expected) || text.includes(expected))
      default:
        return false
    }
  }

  private async contextRuleMatches(rule: PossibleResult, context: EncounterClinicalContext): Promise<boolean> {
    const key = normalizeMatchValue(rule.contextMatch)
    if (!key) return false

    switch (rule.triggerContext) {
      case 'vital':
        return this.vitalMatches(key, context.triage)
      case 'symptom':
        return this.symptomMatches(key, context.screening)
      case 'diagnosis_keyword':
        return await this.diagnosisMatches(key, context)
      default:
        return false
    }
  }

  private vitalMatches(
    key: string,
    triage: EncounterClinicalContext['triage']
  ): boolean {
    if (!triage) return false
    const temp = Number(triage.temperature)
    const sys = Number(triage.systolic_bp)
    const dia = Number(triage.diastolic_bp)
    const pulse = Number(triage.pulse)
    const spo2 = Number(triage.oxygen_saturation)

    switch (key) {
      case 'fever':
        return Number.isFinite(temp) && temp >= 38.0
      case 'hypertension':
        return Number.isFinite(sys) && sys >= 140
      case 'tachycardia':
        return Number.isFinite(pulse) && pulse >= 100
      case 'hypoxia':
        return Number.isFinite(spo2) && spo2 > 0 && spo2 < 92
      default:
        return false
    }
  }

  private symptomMatches(
    key: string,
    screening: EncounterClinicalContext['screening']
  ): boolean {
    if (!screening) return false
    const haystack = normalizeMatchValue(
      [screening.complaints, screening.provisional_diagnosis].filter(Boolean).join(' ')
    )

    if (key === 'tb') {
      const tb = screening.tb_symptoms ?? []
      return tb.length > 0 || haystack.includes('tb') || haystack.includes('tuberculosis')
    }

    return haystack.includes(key)
  }

  private async diagnosisMatches(key: string, context: EncounterClinicalContext): Promise<boolean> {
    const parts = [
      context.review?.final_diagnosis,
      context.screening?.final_diagnosis,
      context.screening?.provisional_diagnosis,
    ]
    const haystack = normalizeMatchValue(parts.filter(Boolean).join(' '))
    if (haystack.includes(key)) return true

    // Expand match via dictionary synonyms / labels for the keyword.
    try {
      const terms = await MedicalDictionaryTerm.query()
        .where('domain', 'diagnosis')
        .where('is_active', true)
        .where((q) => {
          const like = `%${key}%`
          q.whereILike('label', like).orWhereILike('synonyms', like).orWhereILike('code', like)
        })
        .limit(25)

      for (const term of terms) {
        const candidates = [term.label, ...term.synonymList, term.code ?? ''].map(normalizeMatchValue)
        if (candidates.some((c) => c && haystack.includes(c))) return true
      }
    } catch {
      // Dictionary table may not exist yet during migrations.
    }

    return false
  }

  private pushRuleMatch(
    rule: PossibleResult,
    item: SerializedLabItem,
    fieldBuckets: Record<ClinicalFieldKey, FieldSuggestion[]>,
    prescriptions: PrescriptionSuggestion[],
    seenField: Set<string>,
    seenRx: Set<string>
  ) {
    const source = {
      test_name: item.test_name,
      result:
        item.result?.result_value ||
        item.result?.result_text ||
        item.result?.interpretation ||
        null,
    }

    this.emitRule(rule, source, fieldBuckets, prescriptions, seenField, seenRx)
  }

  private pushContextRuleMatch(
    rule: PossibleResult,
    fieldBuckets: Record<ClinicalFieldKey, FieldSuggestion[]>,
    prescriptions: PrescriptionSuggestion[],
    seenField: Set<string>,
    seenRx: Set<string>
  ) {
    const source = { trigger: rule.contextMatch }
    this.emitRule(rule, source, fieldBuckets, prescriptions, seenField, seenRx)
  }

  private emitRule(
    rule: PossibleResult,
    source: { test_name?: string | null; result?: string | null; trigger?: string | null },
    fieldBuckets: Record<ClinicalFieldKey, FieldSuggestion[]>,
    prescriptions: PrescriptionSuggestion[],
    seenField: Set<string>,
    seenRx: Set<string>
  ) {
    if (rule.targetField === 'prescription') {
      const items = rule.parsedPrescriptionPayload()
      if (!items.length) return
      const sig = JSON.stringify(items)
      if (seenRx.has(sig)) return
      seenRx.add(sig)
      prescriptions.push({ id: rule.id, items, source })
      return
    }

    const text = rule.suggestionText?.trim()
    if (!text) return

    const field = rule.targetField as ClinicalFieldKey
    if (!CLINICAL_FIELD_KEYS.includes(field)) return

    const dedupeKey = `${field}::${text}`
    if (seenField.has(dedupeKey)) return
    seenField.add(dedupeKey)

    fieldBuckets[field].push({ id: rule.id, text, source })
  }

  /** Build context from a loaded encounter for a given stage. */
  static buildContextFromEncounter(
    encounter: Encounter,
    stage: StageScope,
    labItems: SerializedLabItem[] = []
  ): EncounterClinicalContext {
    const triage = encounter.triageRecords?.[0]
    const initial =
      (encounter.screeningRecords ?? []).find((r) => r.screeningType === 'initial') ?? null
    const review =
      (encounter.screeningRecords ?? [])
        .filter((r) => r.screeningType === 'review_after_lab')
        .sort((a, b) => b.id - a.id)[0] ?? null

    let tbSymptoms: string[] | null = null
    if (initial?.tbSymptoms) {
      try {
        const parsed = JSON.parse(initial.tbSymptoms)
        tbSymptoms = Array.isArray(parsed) ? parsed.map(String) : null
      } catch {
        tbSymptoms = null
      }
    }

    return {
      stage,
      labItems,
      triage: triage
        ? {
            temperature: triage.temperature,
            systolic_bp: triage.systolicBp,
            diastolic_bp: triage.diastolicBp,
            pulse: triage.pulse,
            oxygen_saturation: triage.oxygenSaturation,
          }
        : null,
      screening: initial
        ? {
            complaints: initial.complaints,
            provisional_diagnosis: initial.provisionalDiagnosis,
            final_diagnosis: initial.finalDiagnosis,
            tb_symptoms: tbSymptoms,
          }
        : null,
      review: review ? { final_diagnosis: review.finalDiagnosis } : null,
    }
  }
}
