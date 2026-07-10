import type { HttpContext } from '@adonisjs/core/http'
import PortalController from '#controllers/portal/portal_controller'
import PortalDoctorsCatalog from '#services/portal/portal_doctors_catalog'

/**
 * Portal doctor directory. Ported from Portal\PatientDoctorController.
 */
export default class PatientDoctorController extends PortalController {
  private doctors = new PortalDoctorsCatalog()

  async index(ctx: HttpContext) {
    return ctx.inertia.render('portal/doctors/index', {
      patient: await this.subjectPatient(ctx),
      doctors: await this.doctors.allActive(),
    })
  }

  async show(ctx: HttpContext) {
    const doctor = await this.doctors.findActive(Number(ctx.params.doctor))
    if (!doctor) {
      return ctx.response.notFound('Doctor not found.')
    }

    return ctx.inertia.render('portal/doctors/show', {
      patient: await this.subjectPatient(ctx),
      doctor,
    })
  }
}
