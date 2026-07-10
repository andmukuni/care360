import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import Patient from '#models/patient'
import Encounter from '#models/encounter'
import Appointment from '#models/appointment'
import LabResult from '#models/lab_result'
import PatientProfileService from '#services/portal/patient_profile_service'
import { patientResource } from './auth_controller.js'

/**
 * Patient self-service profile. Ported from
 * App\Http\Controllers\Api\Portal\ProfileController. Reuses PatientProfileService
 * so contact / next-of-kin / photo updates flow through the same auditing and
 * persistence logic as the web portal.
 */
const contactValidator = vine.compile(
  vine.object({
    phone_number: vine.string().trim().maxLength(30).nullable().optional(),
    other_cellphone: vine.string().trim().maxLength(30).nullable().optional(),
    landline: vine.string().trim().maxLength(30).nullable().optional(),
    email: vine.string().trim().email().maxLength(150),
    house_number: vine.string().trim().maxLength(50).nullable().optional(),
    road_street: vine.string().trim().maxLength(100).nullable().optional(),
    area: vine.string().trim().maxLength(100).nullable().optional(),
    city_town_village: vine.string().trim().maxLength(100).nullable().optional(),
    landmarks: vine.string().trim().maxLength(5000).nullable().optional(),
  })
)

const nextOfKinValidator = vine.compile(
  vine.object({
    next_of_kin_name: vine.string().trim().maxLength(150).nullable().optional(),
    next_of_kin_phone: vine.string().trim().maxLength(30).nullable().optional(),
    next_of_kin_relationship: vine.string().trim().maxLength(50).nullable().optional(),
  })
)

const passwordValidator = vine.compile(
  vine.object({
    current_password: vine.string(),
    password: vine.string().minLength(8).confirmed(),
  })
)

export default class ProfileController {
  private readonly profileService = new PatientProfileService()

  async show(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient

    const lastVisit = await Encounter.query()
      .where('patientId', patient.id)
      .orderBy('startedAt', 'desc')
      .first()

    return ctx.response.ok({
      patient: await patientResource(patient),
      stats: {
        visits: await count(Encounter.query().where('patientId', patient.id)),
        appointments: await count(Appointment.query().where('patientId', patient.id)),
        lab_results: await count(LabResult.query().where('patientId', patient.id)),
        last_visit: lastVisit?.startedAt ? lastVisit.startedAt.toISO() : null,
      },
    })
  }

  async updateContact(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const validated = await ctx.request.validateUsing(contactValidator)

    const duplicate = await Patient.query()
      .where('email', validated.email)
      .whereNot('id', patient.id)
      .first()

    if (duplicate) {
      return ctx.response.unprocessableEntity({
        errors: { email: ['The email has already been taken.'] },
      })
    }

    // PatientProfileService.updateContact merges Lucid attribute names, so map the
    // validated snake_case payload to camelCase and only include keys the client
    // actually sent (mirrors Laravel's $patient->update($validated)).
    const attrs: Record<string, unknown> = { email: validated.email }
    assign(attrs, 'phoneNumber', validated.phone_number)
    assign(attrs, 'otherCellphone', validated.other_cellphone)
    assign(attrs, 'landline', validated.landline)
    assign(attrs, 'houseNumber', validated.house_number)
    assign(attrs, 'roadStreet', validated.road_street)
    assign(attrs, 'area', validated.area)
    assign(attrs, 'cityTownVillage', validated.city_town_village)
    assign(attrs, 'landmarks', validated.landmarks)

    const updated = await this.profileService.updateContact(patient, attrs)

    return ctx.response.ok({
      message: 'Your contact details were updated.',
      patient: await patientResource(updated),
    })
  }

  async updateNextOfKin(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const validated = await ctx.request.validateUsing(nextOfKinValidator)

    const updated = await this.profileService.updateNextOfKin(patient, {
      next_of_kin_name: validated.next_of_kin_name ?? null,
      next_of_kin_phone: validated.next_of_kin_phone ?? null,
      next_of_kin_relationship: validated.next_of_kin_relationship ?? null,
    })

    return ctx.response.ok({
      message: 'Next of kin details were updated.',
      patient: await patientResource(updated),
    })
  }

  async updatePassword(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient
    const validated = await ctx.request.validateUsing(passwordValidator)

    if (
      !patient.password ||
      !(await hash.use('laravel_bcrypt').verify(patient.password, validated.current_password))
    ) {
      return ctx.response.unprocessableEntity({
        errors: { current_password: ['Current password is incorrect.'] },
      })
    }

    // Setting the plain password triggers the model's hashing hook on save.
    patient.password = validated.password
    await patient.save()

    return ctx.response.ok({ message: 'Password updated successfully.' })
  }

  async updatePhoto(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient

    const file = ctx.request.file('profile_photo', {
      size: '4mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!file || !file.isValid) {
      return ctx.response.unprocessableEntity({
        errors: {
          profile_photo: file?.errors.map((error) => error.message) ?? [
            'The profile photo field is required.',
          ],
        },
      })
    }

    const updated = await this.profileService.updatePhoto(patient, file)

    return ctx.response.ok({
      message: 'Profile photo updated.',
      patient: await patientResource(updated),
    })
  }

  async removePhoto(ctx: HttpContext) {
    const patient = ctx.auth.use('patient_api').user as Patient

    const updated = await this.profileService.removePhoto(patient)

    return ctx.response.ok({
      message: 'Profile photo removed.',
      patient: await patientResource(updated),
    })
  }
}

function assign(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value
  }
}

async function count(query: any): Promise<number> {
  const result = await query.count('* as total')
  return Number(result[0].$extras.total)
}
