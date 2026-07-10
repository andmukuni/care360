import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import Appointment from '#models/appointment'
import Encounter from '#models/encounter'
import LabResult from '#models/lab_result'
import Patient from '#models/patient'
import PortalController from '#controllers/portal/portal_controller'
import PatientProfileService from '#services/portal/patient_profile_service'

/**
 * Patient portal profile self-service. Ported from
 * App\Http\Controllers\Portal\PatientProfileController.
 *
 * The `show` screen resolves the (possibly-switched) subject patient; all mutating
 * actions operate on the guardian (authenticated patient) only.
 */
const contactValidator = vine.compile(
  vine.object({
    phone_number: vine.string().trim().maxLength(30).optional(),
    other_cellphone: vine.string().trim().maxLength(30).optional(),
    landline: vine.string().trim().maxLength(30).optional(),
    email: vine.string().trim().email().maxLength(150),
    house_number: vine.string().trim().maxLength(50).optional(),
    road_street: vine.string().trim().maxLength(100).optional(),
    area: vine.string().trim().maxLength(100).optional(),
    city_town_village: vine.string().trim().maxLength(100).optional(),
    landmarks: vine.string().trim().maxLength(5000).optional(),
  })
)

const nextOfKinValidator = vine.compile(
  vine.object({
    next_of_kin_name: vine.string().trim().maxLength(150).optional(),
    next_of_kin_phone: vine.string().trim().maxLength(30).optional(),
    next_of_kin_relationship: vine.string().trim().maxLength(50).optional(),
  })
)

const passwordValidator = vine.compile(
  vine.object({
    current_password: vine.string(),
    password: vine.string().minLength(8).confirmed(),
  })
)

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export default class PatientProfileController extends PortalController {
  private readonly profileService = new PatientProfileService()

  async show(ctx: HttpContext) {
    const patient = await this.subjectPatient(ctx)
    const guardian = this.guardian(ctx)

    const [visits, appointments, labResults, lastVisit] = await Promise.all([
      Encounter.query().where('patientId', patient.id).count('* as total'),
      Appointment.query().where('patientId', patient.id).count('* as total'),
      LabResult.query().where('patientId', patient.id).count('* as total'),
      Encounter.query().where('patientId', patient.id).orderBy('startedAt', 'desc').first(),
    ])

    const stats = {
      visits: Number(visits[0].$extras.total),
      appointments: Number(appointments[0].$extras.total),
      labResults: Number(labResults[0].$extras.total),
      lastVisit: lastVisit?.startedAt ? lastVisit.startedAt.toISO() : null,
    }

    return ctx.inertia.render('portal/profile/show', {
      patient,
      stats,
      isOwnProfile: patient.id === guardian.id,
    })
  }

  async edit(ctx: HttpContext) {
    const patient = this.guardian(ctx)

    return ctx.inertia.render('portal/profile/edit', { patient })
  }

  async updateContact(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const validated = await ctx.request.validateUsing(contactValidator)

    const emailTaken = await Patient.query()
      .where('email', validated.email)
      .whereNot('id', guardian.id)
      .first()

    if (emailTaken) {
      ctx.session.flashErrors({ email: 'This email address is already in use.' })

      return ctx.response.redirect().back()
    }

    await this.profileService.updateContact(guardian, {
      phoneNumber: nullIfEmpty(validated.phone_number),
      otherCellphone: nullIfEmpty(validated.other_cellphone),
      landline: nullIfEmpty(validated.landline),
      email: validated.email,
      houseNumber: nullIfEmpty(validated.house_number),
      roadStreet: nullIfEmpty(validated.road_street),
      area: nullIfEmpty(validated.area),
      cityTownVillage: nullIfEmpty(validated.city_town_village),
      landmarks: nullIfEmpty(validated.landmarks),
    })

    ctx.session.flash('success', 'Your contact details were updated.')

    return ctx.response.redirect('/portal/profile')
  }

  async updateNextOfKin(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const validated = await ctx.request.validateUsing(nextOfKinValidator)

    await this.profileService.updateNextOfKin(guardian, {
      next_of_kin_name: nullIfEmpty(validated.next_of_kin_name),
      next_of_kin_phone: nullIfEmpty(validated.next_of_kin_phone),
      next_of_kin_relationship: nullIfEmpty(validated.next_of_kin_relationship),
    })

    ctx.session.flash('success', 'Next of kin details were updated.')

    return ctx.response.redirect('/portal/profile')
  }

  async updatePassword(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    const validated = await ctx.request.validateUsing(passwordValidator)

    const currentValid =
      guardian.password !== null &&
      (await hash.use('laravel_bcrypt').verify(guardian.password, validated.current_password))

    if (!currentValid) {
      ctx.session.flashErrors({ current_password: 'Current password is incorrect.' })

      return ctx.response.redirect().back()
    }

    // The withAuthFinder beforeSave hook re-hashes the plain password on save.
    guardian.password = validated.password
    await guardian.save()

    ctx.session.flash('success', 'Password updated successfully.')

    return ctx.response.redirect('/portal/profile')
  }

  async updatePhoto(ctx: HttpContext) {
    const guardian = this.guardian(ctx)

    const file = ctx.request.file('profile_photo', {
      size: '4mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!file || !file.isValid) {
      ctx.session.flashErrors({
        profile_photo: file?.errors?.[0]?.message ?? 'Please upload a valid image (jpg, png or webp, max 4MB).',
      })

      return ctx.response.redirect().back()
    }

    await this.profileService.updatePhoto(guardian, file)

    ctx.session.flash('success', 'Profile photo updated.')

    return ctx.response.redirect('/portal/profile')
  }

  async removePhoto(ctx: HttpContext) {
    const guardian = this.guardian(ctx)
    await this.profileService.removePhoto(guardian)

    ctx.session.flash('success', 'Profile photo removed.')

    return ctx.response.redirect('/portal/profile')
  }
}
