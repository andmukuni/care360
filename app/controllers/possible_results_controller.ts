import type { HttpContext } from '@adonisjs/core/http'
import PossibleResult from '#models/possible_result'
import TestType from '#models/test_type'
import LabTestCatalog from '#models/lab_test_catalog'
import { possibleResultValidator } from '#validators/staff/possible_result'

const TARGET_FIELDS = [
  'final_diagnosis',
  'clinical_findings',
  'physical_examination',
  'assessment_notes',
  'plan',
  'review_notes',
  'treatment_plan',
  'provisional_diagnosis',
  'prescription',
  'chief_complaint_brief',
]

const STAGE_SCOPES = ['screening_review', 'screening', 'triage', 'pharmacy']

export default class PossibleResultsController {
  async index({ inertia }: HttpContext) {
    const rows = await PossibleResult.query().preload('testType').orderBy('test_name').orderBy('priority', 'desc')

    return inertia.render('test-types/possible-results/index', {
      rows: rows.map((r) => ({
        id: r.id,
        test_name: r.testName,
        test_type_name: r.testType?.name ?? null,
        match_kind: r.matchKind,
        match_value: r.matchValue,
        target_field: r.targetField,
        suggestion_preview: r.suggestionText?.slice(0, 80) ?? (r.prescriptionPayload ? 'Rx template' : '—'),
        stage_scope: r.parsedStageScope().join(', '),
        trigger_context: r.triggerContext,
        is_active: r.isActive,
        priority: r.priority,
      })),
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('test-types/possible-results/form', await this.formOptions(null))
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(possibleResultValidator)
    await PossibleResult.create(this.toModelPayload(data))
    session.flash('success', 'Possible result rule created.')
    return response.redirect().toPath('/test-types/possible-results')
  }

  async edit({ params, inertia }: HttpContext) {
    const row = await PossibleResult.findOrFail(params.id)
    return inertia.render('test-types/possible-results/form', {
      ...(await this.formOptions(row)),
      row: this.serializeRow(row),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const row = await PossibleResult.findOrFail(params.id)
    const data = await request.validateUsing(possibleResultValidator)
    row.merge(this.toModelPayload(data))
    await row.save()
    session.flash('success', 'Possible result rule updated.')
    return response.redirect().toPath('/test-types/possible-results')
  }

  async destroy({ params, response, session }: HttpContext) {
    const row = await PossibleResult.findOrFail(params.id)
    await row.delete()
    session.flash('success', 'Possible result rule deleted.')
    return response.redirect().toPath('/test-types/possible-results')
  }

  private async formOptions(row: PossibleResult | null) {
    const testTypes = await TestType.query().where('is_active', true).orderBy('name')
    const catalog = await LabTestCatalog.query().where('is_active', true).orderBy('name').limit(500)

    return {
      targetFields: TARGET_FIELDS,
      stageScopes: STAGE_SCOPES,
      matchKinds: ['interpretation', 'value_equals', 'value_contains', 'any_result'],
      triggerContexts: ['lab_result', 'symptom', 'vital', 'diagnosis_keyword'],
      testTypes: testTypes.map((t) => ({ id: t.id, name: t.name })),
      catalogNames: catalog.map((c) => c.name),
      isEdit: !!row,
    }
  }

  private serializeRow(row: PossibleResult) {
    return {
      id: row.id,
      test_name: row.testName,
      test_type_id: row.testTypeId,
      match_kind: row.matchKind,
      match_value: row.matchValue,
      target_field: row.targetField,
      suggestion_text: row.suggestionText,
      prescription_payload: row.prescriptionPayload,
      stage_scope: row.parsedStageScope(),
      trigger_context: row.triggerContext,
      context_match: row.contextMatch,
      priority: row.priority,
      is_active: row.isActive,
      notes: row.notes,
    }
  }

  private toModelPayload(data: Record<string, any>) {
    return {
      testName: data.test_name ?? null,
      testTypeId: data.test_type_id ?? null,
      matchKind: data.match_kind,
      matchValue: data.match_value ?? null,
      targetField: data.target_field,
      suggestionText: data.suggestion_text ?? null,
      prescriptionPayload: data.prescription_payload ?? null,
      stageScope: JSON.stringify(data.stage_scope ?? []),
      triggerContext: data.trigger_context ?? 'lab_result',
      contextMatch: data.context_match ?? null,
      priority: data.priority ?? 0,
      isActive: data.is_active ?? true,
      notes: data.notes ?? null,
    }
  }
}
