import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Encounter from '#models/encounter'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatusHelper } from '#enums/encounter_status'
import { EncounterDetailService } from '#services/encounter/encounter_detail_service'
import { EncounterShowSerializer } from '#services/encounter/encounter_show_serializer'
import ReopenEncounterAction from '#actions/encounter/reopen_encounter_action'
import ReopenEncounterToStageAction from '#actions/encounter/reopen_encounter_to_stage_action'
import { loadClinicalSuggestions } from '#support/clinical/load_clinical_suggestions'
import type { StageScope } from '#support/clinical/clinical_suggestion_types'

/**
 * Encounter register + profile. Ported from App\Http\Controllers\EncounterController.
 *
 * The Laravel controller exposed a jQuery DataTables JSON endpoint (`datatable`);
 * here `index` returns the ordered rows for the shared client-side DataTable.
 */
export default class EncountersController {
  private readonly detailService = new EncounterDetailService()
  private readonly showSerializer = new EncounterShowSerializer()

  // GET /encounters
  async index({ request, inertia }: HttpContext) {
    const filters = request.only([
      'stage',
      'status',
      'priority',
      'date_from',
      'date_to',
      'search',
      'attendant_type',
    ])
    const sort = String(request.qs().sort ?? 'started')
    const direction = String(request.qs().direction ?? 'desc')

    // Reuse the Phase-3 detail service; pull a large page so the client-side
    // DataTable receives the full ordered set.
    const paginator = await this.detailService.list(filters, 500, sort, direction, 1)

    return inertia.render('encounters/index', {
      encounters: paginator.all().map((e) => this.rowFor(e)),
      filters,
      sort,
      direction,
    })
  }

  // GET /encounters/:encounter
  async show({ params, inertia }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    await this.detailService.load(encounter)

    return inertia.render('encounters/show', {
      encounter: await this.showSerializer.serialize(encounter),
      reopenStages: EncounterStageHelper.activeStages().map((s) => ({
        value: s,
        label: EncounterStageHelper.label(s),
      })),
    })
  }

  // POST /encounters/:encounter/reopen
  async reopen({ params, request, response, session, auth }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    const user = auth.getUserOrFail()

    const validator = vine.compile(
      vine.object({
        reason: vine.string().trim().maxLength(500),
        notes: vine.string().trim().maxLength(500).nullable().optional(),
      })
    )
    const data = await request.validateUsing(validator)
    const notes = [data.reason, data.notes].filter((v) => !!v).join('\n').trim()

    try {
      await new ReopenEncounterAction().handle(encounter, user.id, notes)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash('success', `Encounter ${encounter.encounterNumber} has been reopened.`)
    return response.redirect().toPath(`/encounters/${encounter.id}`)
  }

  // POST /encounters/:encounter/reopen-to-stage
  async reopenToStage({ params, request, response, session, auth }: HttpContext) {
    const encounter = await Encounter.findOrFail(params.encounter)
    const user = auth.getUserOrFail()

    const stageValues = EncounterStageHelper.activeStages()
    const validator = vine.compile(
      vine.object({
        target_stage: vine.enum(stageValues),
        reason: vine.string().trim().maxLength(500),
      })
    )
    const data = await request.validateUsing(validator)
    const targetStage = data.target_stage as EncounterStage

    try {
      await new ReopenEncounterToStageAction().handle(encounter, targetStage, user.id, data.reason)
    } catch (error) {
      session.flash('error', error.message)
      return response.redirect().back()
    }

    session.flash(
      'success',
      `Encounter ${encounter.encounterNumber} reopened and queued to ${EncounterStageHelper.label(targetStage)}.`
    )
    return response.redirect().back()
  }

  // GET /encounters/:encounter/suggestions?stage=screening_review
  async suggestions({ params, request, response }: HttpContext) {
    const stage = String(request.qs().stage ?? 'screening_review') as StageScope
    const allowed: StageScope[] = ['screening_review', 'screening', 'triage', 'pharmacy']
    if (!allowed.includes(stage)) {
      return response.status(422).json({ ok: false, message: 'Invalid stage.' })
    }

    const payload = await loadClinicalSuggestions(Number(params.encounter), stage)
    return response.json({ ok: true, ...payload })
  }

  private rowFor(e: Encounter) {
    return {
      id: e.id,
      encounter_number: e.encounterNumber,
      patient_name: e.patient?.fullName ?? null,
      patient_code: e.patient?.patientId ?? null,
      stage: e.currentStage,
      stage_label: EncounterStageHelper.label(e.currentStage as EncounterStage),
      status: e.currentStatus,
      status_label: EncounterStatusHelper.label(e.currentStatus),
      priority: e.priorityLevel,
      visit_type: e.visitType,
      started_at: e.startedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
      started_by: e.startedByUser?.name ?? null,
      is_locked: e.isLocked,
    }
  }

}
