import type EncounterAudit from '#models/encounter_audit'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'

const ACTION_LABELS: Record<string, string> = {
  lab_received: 'Patient received in Lab',
  lab_samples_collected: 'Sample(s) collected',
  lab_results_saved: 'Results saved',
  lab_result_updated: 'Result updated',
  queued_back_to_screening_review: 'Sent to Screening Review',
  returned_to_initial_screening: 'Returned to Screening',
  lab_request_authored: 'Lab request created',
  lab_tests_added: 'Lab test(s) added',
  queued_to_lab: 'Queued to Lab',
}

export type LabActivityRow = {
  id: number
  headline: string
  stage_label: string
  action_by: string | null
  action_at: string | null
  notes: string | null
  detail: string | null
}

function parseJsonValues(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  return null
}

function formatDetail(audit: EncounterAudit): string | null {
  const values = parseJsonValues(audit.newValues)
  if (!values) return null

  if (Array.isArray(values.tests) && values.tests.length) {
    return values.tests.join(', ')
  }

  if (Array.isArray(values.sample_types) && values.sample_types.length) {
    return values.sample_types.join(', ')
  }

  if (typeof values.test_name === 'string' && values.test_name.trim()) {
    return values.test_name
  }

  if (typeof values.lab_request_number === 'string' && values.lab_request_number.trim()) {
    return values.lab_request_number
  }

  if (typeof values.count === 'number' && values.count > 0) {
    return `${values.count} item(s)`
  }

  return null
}

export function labActivityHeadline(actionName: string): string {
  return (
    ACTION_LABELS[actionName] ??
    actionName
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  )
}

export function serializeLabActivity(audits: EncounterAudit[]): LabActivityRow[] {
  return audits.map((audit) => ({
    id: audit.id,
    headline: labActivityHeadline(audit.actionName),
    stage_label: EncounterStageHelper.label(audit.actionStage as EncounterStage),
    action_by: audit.actionByUser?.name ?? null,
    action_at: audit.actionAt?.toFormat('dd LLL yyyy, HH:mm') ?? null,
    notes: audit.notes,
    detail: formatDetail(audit),
  }))
}
