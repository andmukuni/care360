import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow, ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Patient from '#models/patient'
import LabResult from '#models/lab_result'
import PatientMedicalSummaryService from '#services/portal/patient_medical_summary_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'

/**
 * Released lab results. Ported from App\Http\Controllers\Api\Portal\LabController.
 * Only results released to the patient are exposed (enforced by the service scope).
 */
export default class LabController {
  private readonly medicalSummary = new PatientMedicalSummaryService()
  private readonly dependentResolver = new PatientDependentResolver()

  async index(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const page = pageParam(ctx)

    const paginator = await this.medicalSummary.paginatedLabResults(patient, 20, page)

    return ctx.response.ok(await paginated(ctx, paginator, (r) => labResultResource(r as LabResult)))
  }

  async show(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const labResult = await LabResult.findOrFail(ctx.params.labResult)

    // Service aborts 403 unless this result belongs to the patient AND is released.
    const result = await this.medicalSummary.labResultForPatient(patient, labResult)

    return ctx.response.ok({ data: labResultResource(result) })
  }

  async report(ctx: HttpContext) {
    const patient = await subjectPatient(ctx, this.dependentResolver)
    const labResult = await LabResult.findOrFail(ctx.params.labResult)
    const result = await this.medicalSummary.labResultForPatient(patient, labResult)
    const item = result.labRequestItem ?? null

    return ctx.response.ok({
      report: {
        id: result.id,
        test_name: item?.testName ?? result.resultText ?? 'Lab result',
        test_code: item?.testCode ?? null,
        specimen_type: item?.specimenType ?? null,
        result_value: result.resultValue,
        result_text: result.resultText,
        reference_range: result.referenceRange,
        interpretation: result.interpretation,
        remarks: result.remarks,
        status: result.resultStatus,
        recorded_at: result.resultRecordedAt ? result.resultRecordedAt.toISO() : null,
        released_at: result.releasedToPatientAt ? result.releasedToPatientAt.toISO() : null,
        patient: {
          full_name: patient.fullName,
          patient_number: patient.patientId,
          gender: patient.gender,
          date_of_birth: patient.dateOfBirth ? patient.dateOfBirth.toISODate() : null,
        },
      },
    })
  }
}

// ── Shared helpers reused across the portal API controllers ─────────────────

/** Reproduces App\Http\Resources\Portal\LabResultResource. */
export function labResultResource(result: LabResult): Record<string, unknown> {
  const item = result.labRequestItem ?? null

  return {
    id: result.id,
    test_name: item?.testName ?? result.resultText ?? 'Lab result',
    test_code: item?.testCode ?? null,
    specimen_type: item?.specimenType ?? null,

    result_value: result.resultValue,
    result_text: result.resultText,
    reference_range: result.referenceRange,
    interpretation: result.interpretation,
    remarks: result.remarks,

    status: result.resultStatus,
    status_label: labelize(result.resultStatus),

    recorded_at: result.resultRecordedAt ? result.resultRecordedAt.toISO() : null,
    released_at: result.releasedToPatientAt ? result.releasedToPatientAt.toISO() : null,

    encounter_id: result.encounterId,
  }
}

/** `ucfirst(str_replace('_', ' ', $value))`, null-safe. */
export function labelize(value: string | null | undefined): string | null {
  const str = String(value ?? '')
  if (str === '') {
    return null
  }
  const replaced = str.replace(/_/g, ' ')
  return replaced.charAt(0).toUpperCase() + replaced.slice(1)
}

/** Reads the `page` query param (Lucid needs it explicitly). */
export function pageParam(ctx: HttpContext): number {
  const raw = Number(ctx.request.input('page', 1))
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1
}

/** Resolves the subject patient (self or authorized dependent) for the mobile API. */
export async function subjectPatient(
  ctx: HttpContext,
  resolver: PatientDependentResolver
): Promise<Patient> {
  const guardian = ctx.auth.use('patient_api').user as Patient
  const headerId = ctx.request.header('X-Portal-Viewing-Patient-Id')
  const parsedHeader = headerId !== undefined && headerId !== '' ? Number(headerId) : null
  const tokenId = guardian.currentAccessToken
    ? Number(guardian.currentAccessToken.identifier)
    : null

  return resolver.viewingPatientForApi(guardian, parsedHeader, tokenId)
}

/**
 * Reproduces the Laravel API-resource paginated envelope
 * ({ data, links, meta }).
 *
 * PORT-GAP: `links`/`meta.path` use root-relative URLs and `meta.links` omits
 * Laravel's ellipsis compression (all page links are listed).
 */
export async function paginated<T extends LucidRow>(
  ctx: HttpContext,
  paginator: ModelPaginatorContract<T>,
  map: (row: T) => Record<string, unknown> | Promise<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const rows = paginator.all()
  const data = await Promise.all(rows.map((row) => map(row)))

  const currentPage = paginator.currentPage
  const lastPage = paginator.lastPage
  const perPage = paginator.perPage
  const total = paginator.total
  const from = total === 0 ? null : (currentPage - 1) * perPage + 1
  const to = total === 0 ? null : (from ?? 0) + rows.length - 1

  const path = ctx.request.url()
  const pageUrl = (page: number) => `${path}?page=${page}`

  const metaLinks: Array<{ url: string | null; label: string; active: boolean }> = [
    { url: currentPage > 1 ? pageUrl(currentPage - 1) : null, label: '&laquo; Previous', active: false },
  ]
  for (let page = 1; page <= lastPage; page++) {
    metaLinks.push({ url: pageUrl(page), label: String(page), active: page === currentPage })
  }
  metaLinks.push({
    url: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    label: 'Next &raquo;',
    active: false,
  })

  return {
    data,
    links: {
      first: pageUrl(1),
      last: pageUrl(lastPage),
      prev: currentPage > 1 ? pageUrl(currentPage - 1) : null,
      next: currentPage < lastPage ? pageUrl(currentPage + 1) : null,
    },
    meta: {
      current_page: currentPage,
      from,
      last_page: lastPage,
      links: metaLinks,
      path,
      per_page: perPage,
      to,
      total,
    },
  }
}
