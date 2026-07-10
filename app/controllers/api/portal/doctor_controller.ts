import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import ShiftRoster from '#models/shift_roster'
import PortalDoctorsCatalog from '#services/portal/portal_doctors_catalog'
import { abort } from '#services/portal/portal_errors'

/**
 * Portal doctor directory + availability. Ported from
 * App\Http\Controllers\Api\Portal\DoctorController.
 *
 * Reuses the PortalDoctorsCatalog portal service (portal-bookable staff).
 *
 * PORT-GAP: App\Services\Appointment\ProviderAvailabilityService is not ported.
 * availability() reproduces its availableDatesForUser() inline against the shift
 * roster with the config defaults inlined (provider_shift_type = 'day',
 * provider_roles = [] i.e. no role restriction).
 */
const PROVIDER_SHIFT_TYPE = 'day'

const availabilityValidator = vine.compile(
  vine.object({
    from: vine.string().trim(),
    to: vine.string().trim(),
  })
)

export default class DoctorController {
  private readonly doctors = new PortalDoctorsCatalog()

  async index(ctx: HttpContext) {
    return ctx.response.ok({ doctors: await this.doctors.allActive() })
  }

  async show(ctx: HttpContext) {
    const doctor = await this.doctors.findActive(Number(ctx.params.doctor))

    if (!doctor) {
      abort(404)
    }

    return ctx.response.ok({ doctor })
  }

  async availability(ctx: HttpContext) {
    const doctorId = Number(ctx.params.doctor)

    if (!(await this.doctors.findActive(doctorId))) {
      abort(404)
    }

    const { from, to } = await ctx.request.validateUsing(availabilityValidator)

    const fromDate = DateTime.fromISO(from)
    const toDate = DateTime.fromISO(to)

    if (!fromDate.isValid || !toDate.isValid) {
      return ctx.response.unprocessableEntity({
        errors: {
          ...(fromDate.isValid ? {} : { from: ['The from field must be a valid date.'] }),
          ...(toDate.isValid ? {} : { to: ['The to field must be a valid date.'] }),
        },
      })
    }

    if (toDate.toISODate()! < fromDate.toISODate()!) {
      return ctx.response.unprocessableEntity({
        errors: { to: ['The to field must be a date after or equal to from.'] },
      })
    }

    return ctx.response.ok({
      dates: await this.availableDatesForUser(doctorId, fromDate, toDate),
    })
  }

  /** Reproduces ProviderAvailabilityService::availableDatesForUser(). */
  private async availableDatesForUser(
    userId: number,
    from: DateTime,
    to: DateTime
  ): Promise<string[]> {
    const fromDate = from.toISODate()!
    const toDate = to.toISODate()!

    if (fromDate > toDate) {
      return []
    }

    const rosters = await ShiftRoster.query()
      .where('userId', userId)
      .whereBetween('shiftDate', [fromDate, toDate])
      .where('shiftType', PROVIDER_SHIFT_TYPE)
      .orderBy('shiftDate', 'asc')

    const dates = rosters
      .map((roster) => (roster.shiftDate ? roster.shiftDate.toISODate() : null))
      .filter((date): date is string => date !== null)

    return [...new Set(dates)]
  }
}
