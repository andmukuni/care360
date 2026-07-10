import vine from '@vinejs/vine'

/**
 * Validators for the staff Reports hub. Ported from the inline `$request->validate`
 * rules in App\Http\Controllers\ReportController and ShiftReportController.
 *
 * `report_type` membership (against ReportCatalogue::exportableKeys) and the
 * `end_date >= start_date` / attendant-type enum checks are enforced in the
 * controller after this structural pass, so this stays catalogue-agnostic.
 */
export const reportExportValidator = vine.compile(
  vine.object({
    report_type: vine.string().trim(),
    start_date: vine.string().trim(),
    end_date: vine.string().trim(),
    attendant_type: vine.string().trim().nullable().optional(),
  })
)

export const rosterAssignmentValidator = vine.compile(
  vine.object({
    shift_date: vine.string().trim(),
    shift_type: vine.string().trim(),
    user_id: vine.number(),
    start_time: vine.string().trim().regex(/^\d{2}:\d{2}$/),
    end_time: vine.string().trim().regex(/^\d{2}:\d{2}$/),
    notes: vine.string().trim().maxLength(1000).nullable().optional(),
  })
)

export const prefillRosterValidator = vine.compile(
  vine.object({
    week_start: vine.string().trim().nullable().optional(),
    return_to: vine.enum(['index', 'timeline'] as const).optional(),
  })
)
