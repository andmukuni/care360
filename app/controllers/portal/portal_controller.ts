import type { HttpContext } from '@adonisjs/core/http'
import Patient from '#models/patient'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'

/**
 * Base controller for the patient portal web pages. Ported from the Laravel
 * App\Http\Controllers\Portal\Concerns\ResolvesPortalPatient trait.
 *
 * `guardian` is always the authenticated (logged-in) patient. `subjectPatient`
 * is the patient currently being viewed — the guardian themselves, or an
 * approved dependent they have switched into via the dependent resolver
 * (session-backed viewing context).
 */
export default abstract class PortalController {
  protected dependentResolver = new PatientDependentResolver()

  protected guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user as Patient
  }

  protected async subjectPatient(ctx: HttpContext): Promise<Patient> {
    return this.dependentResolver.viewingPatient(this.guardian(ctx), ctx.session)
  }
}
