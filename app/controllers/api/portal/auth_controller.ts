import type { HttpContext } from '@adonisjs/core/http'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'
import PatientAuditService from '#services/portal/patient_audit_service'
import { TdltsBarcodeGenerator } from '#support/tdlts_barcode_generator'

/**
 * Token-based authentication for the patient mobile app.
 *
 * Ported from App\Http\Controllers\Api\Portal\AuthController. Mirrors the
 * eligibility rules enforced by the web PatientAuthController (not deceased,
 * active status, password set), but issues a Sanctum-compatible personal access
 * token (via SanctumAccessTokensProvider) instead of starting a session.
 *
 * PORT-GAP: Laravel's brand-new patient creation used
 * App\Actions\Encounter\RegisterOrAttachPatientAction. That action is not ported
 * (no equivalent under app/services/encounter/). register() therefore does a
 * best-effort minimal create here, reproducing the action's no-household path
 * (patient number via TdltsBarcodeGenerator). Password reset delivery + the
 * `patients` password broker are not wired: forgotPassword always returns the
 * neutral message and resetPassword is backed by the
 * patient_password_reset_tokens table (Laravel-compatible schema).
 */
const RESET_TOKEN_EXPIRY_MINUTES = 60

const registerValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().maxLength(255),
    email: vine.string().trim().email().maxLength(255),
    phone_number: vine.string().trim().maxLength(30).nullable().optional(),
    gender: vine.enum(['Male', 'Female', 'Other']).nullable().optional(),
    // PORT-GAP: Laravel enforced `date|before:today`; kept as a lenient string here.
    date_of_birth: vine.string().trim().nullable().optional(),
    password: vine.string().minLength(8).confirmed(),
    device_name: vine.string().trim().maxLength(120).nullable().optional(),
  })
)

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string(),
    device_name: vine.string().trim().maxLength(120).nullable().optional(),
  })
)

const emailValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
  })
)

const resetValidator = vine.compile(
  vine.object({
    token: vine.string(),
    email: vine.string().trim().email(),
    password: vine.string().minLength(8).confirmed(),
  })
)

export default class AuthController {
  private readonly auditService = new PatientAuditService()

  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const existing = await Patient.query().where('email', data.email).first()

    if (existing && existing.password) {
      return response.unprocessableEntity({
        errors: {
          email: ['An account already exists for this email. Please sign in or use forgot password.'],
        },
      })
    }

    let patient: Patient

    if (existing) {
      // Pre-registered (staff-created) record with no password: claim it and
      // backfill any demographics the patient supplied that were missing.
      existing.fullName = existing.fullName || data.full_name
      existing.phoneNumber = existing.phoneNumber || (data.phone_number ?? null)
      existing.gender = existing.gender || (data.gender ?? null)
      if (!existing.dateOfBirth && data.date_of_birth) {
        existing.dateOfBirth = DateTime.fromISO(data.date_of_birth)
      }
      // Setting the plain password triggers the model's hashing hook on save.
      existing.password = data.password
      existing.status = existing.status || 'active'
      existing.emailVerifiedAt = existing.emailVerifiedAt ?? DateTime.now()
      await existing.save()
      patient = existing
    } else {
      // Brand-new patient: create with a proper patient number. Portal access
      // stays OFF until a staff member approves the sign-up.
      const latest = await Patient.query().orderBy('id', 'desc').first()
      const nextId = latest ? latest.id + 1 : 1

      patient = new Patient()
      patient.patientId = TdltsBarcodeGenerator.generate('P', nextId)
      patient.fullName = data.full_name
      patient.gender = data.gender ?? null
      patient.dateOfBirth = data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : null
      patient.phoneNumber = data.phone_number ?? null
      patient.email = data.email
      patient.password = data.password
      patient.portalEnabled = false
      patient.status = 'active'
      patient.emailVerifiedAt = DateTime.now()
      await patient.save()

      patient.barcode = patient.barcode || TdltsBarcodeGenerator.generate('P', String(patient.id))
      await patient.save()
    }

    const deviceName = data.device_name ?? 'mobile'
    await Patient.accessTokens.deleteAll(patient, deviceName)
    const token = await Patient.accessTokens.create(patient, ['*'], { name: deviceName })

    await this.auditService.record(
      patient,
      patient.portalEnabled ? 'auth.register' : 'auth.register.pending',
      null,
      null,
      {},
      request
    )

    return response.ok({
      status: patient.portalEnabled ? 'approved' : 'pending',
      token: token.value!.release(),
      patient: await patientResource(patient),
    })
  }

  async login({ request, response }: HttpContext) {
    const { email, password, device_name } = await request.validateUsing(loginValidator)

    const generic = 'These credentials do not match our records or portal access is not enabled.'

    const patient = await Patient.query().where('email', email).first()

    // Single generic error for the common failure paths so the API does not
    // reveal whether an email exists or why access is blocked. portal_enabled is
    // intentionally NOT required — a patient awaiting approval may still sign in.
    if (!patient || patient.isDeceased || (patient.status && patient.status !== 'active')) {
      return response.unprocessableEntity({ errors: { email: [generic] } })
    }

    if (!patient.password) {
      return response.unprocessableEntity({
        errors: {
          email: ['Please use the invitation link sent to your email to set your password first.'],
        },
      })
    }

    if (!(await hash.use('laravel_bcrypt').verify(patient.password, password))) {
      return response.unprocessableEntity({ errors: { email: [generic] } })
    }

    const deviceName = device_name ?? 'mobile'
    await Patient.accessTokens.deleteAll(patient, deviceName)
    const token = await Patient.accessTokens.create(patient, ['*'], { name: deviceName })

    await this.auditService.record(patient, 'auth.login', null, null, {}, request)

    return response.ok({
      token: token.value!.release(),
      patient: await patientResource(patient),
    })
  }

  async me({ auth, response }: HttpContext) {
    const patient = auth.use('patient_api').user as Patient

    return response.ok({ data: await patientResource(patient) })
  }

  async logout({ auth, response, request }: HttpContext) {
    const patient = auth.use('patient_api').user as Patient

    await this.auditService.record(patient, 'auth.logout', null, null, {}, request)

    const token = patient.currentAccessToken
    if (token) {
      await Patient.accessTokens.delete(patient, token.identifier)
    }

    return response.ok({ message: 'Logged out.' })
  }

  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(emailValidator)

    const patient = await Patient.query().where('email', email).first()

    // Always respond 200 to avoid leaking which emails are registered.
    if (patient && patient.portalEnabled) {
      const plainToken = randomBytes(32).toString('hex')
      const hashedToken = await hash.make(plainToken)
      await db.from('patient_password_reset_tokens').where('email', email).delete()
      await db.table('patient_password_reset_tokens').insert({
        email,
        token: hashedToken,
        created_at: DateTime.now().toSQL({ includeOffset: false }),
      })
      // PORT-GAP: emailing the reset link is not wired (matches web port).
    }

    return response.ok({
      message: 'If an account exists for that email, a password reset link has been sent.',
    })
  }

  async resetPassword({ request, response }: HttpContext) {
    const { token, email, password } = await request.validateUsing(resetValidator)

    const invalid = { errors: { email: ['This password reset token is invalid.'] } }

    const record = await db.from('patient_password_reset_tokens').where('email', email).first()
    const tokenValid = record ? await hash.verify(record.token, token) : false
    const notExpired =
      record &&
      DateTime.fromJSDate(new Date(record.created_at)).diffNow('minutes').minutes >
        -RESET_TOKEN_EXPIRY_MINUTES

    if (!record || !tokenValid || !notExpired) {
      return response.unprocessableEntity(invalid)
    }

    const patient = await Patient.query().where('email', email).first()

    if (!patient) {
      return response.unprocessableEntity(invalid)
    }

    // Setting the plain password triggers the model's hashing hook on save.
    patient.password = password
    await patient.save()

    await db.from('patient_password_reset_tokens').where('email', email).delete()

    return response.ok({ message: 'Password has been reset. You can now sign in.' })
  }
}

// ── Shared portal presenters ───────────────────────────────────────────────
// The AdonisJS port has no App\Http\Resources equivalent; the JSON shapes from
// App\Http\Resources\Portal\* are reproduced as functions here and reused across
// the portal API controllers.

/** Reproduces App\Http\Resources\Portal\PatientResource. */
export async function patientResource(patient: Patient): Promise<Record<string, unknown>> {
  const dob = patient.dateOfBirth
  const household = await patientHousehold(patient)

  return {
    id: patient.id,
    patient_number: patient.patientId,
    barcode: patient.barcode,
    full_name: patient.fullName,
    profile_photo_url: profilePhotoUrl(patient),
    gender: patient.gender,
    date_of_birth: dob ? dob.toISODate() : null,
    age: ageFromDob(dob),
    nrc_number: patient.nrcNumber,
    art_number: patient.artNumber,
    blood_group: patient.bloodGroup,
    allergies: patient.allergies,
    marital_status: patient.maritalStatus,
    occupation: patient.occupation,

    email: patient.email,
    phone_number: patient.phoneNumber,
    other_cellphone: patient.otherCellphone,
    landline: patient.landline,

    address: {
      house_number: patient.houseNumber,
      road_street: patient.roadStreet,
      area: patient.area,
      city_town_village: patient.cityTownVillage,
      landmarks: patient.landmarks,
    },

    next_of_kin: {
      name: patient.nextOfKinName,
      phone: patient.nextOfKinPhone,
      relationship: patient.nextOfKinRelationship,
    },

    status: patient.status,
    portal_enabled: Boolean(patient.portalEnabled),

    household,
  }
}

/**
 * PORT-GAP: Laravel used asset('storage/...') to produce an absolute URL. This
 * mirrors the web port and returns a root-relative /storage path.
 */
export function profilePhotoUrl(patient: Patient): string | null {
  return patient.profilePhotoPath ? `/storage/${patient.profilePhotoPath}` : null
}

export function ageFromDob(dob: DateTime | null): number | null {
  return dob ? Math.floor(DateTime.now().diff(dob, 'years').years) : null
}

/**
 * Reproduces App\Support\Households\PatientHouseholdPresenter::forPatient() +
 * App\Http\Resources\Portal\HouseholdSummaryResource (identical key set).
 */
export async function patientHousehold(
  patient: Patient | null
): Promise<Record<string, unknown> | null> {
  if (!patient) {
    return null
  }

  const householdId = String(patient.householdId ?? '').trim()
  if (householdId === '') {
    return null
  }

  const row = await db.from('households').where('household_id', householdId).first()

  const headOfHouse = String(row?.head_of_house ?? patient.householdHeadOfHouse ?? '').trim()
  const village = String(row?.village ?? '').trim()
  const town = String(row?.town ?? '').trim()
  const relationship = String(patient.relationshipToHead ?? '').trim()

  return {
    household_id: householdId,
    head_of_house: headOfHouse !== '' ? headOfHouse : null,
    relationship_to_head: relationship !== '' ? relationship : null,
    role_label: householdRoleLabel(relationship),
    village: village !== '' ? village : null,
    town: town !== '' ? town : null,
    location_label: householdLocationLabel(village, town),
    display_label: householdDisplayLabel(householdId, headOfHouse, relationship),
  }
}

export function sameHousehold(a: Patient | null, b: Patient | null): boolean {
  if (!a || !b) {
    return false
  }
  const householdA = String(a.householdId ?? '').trim()
  const householdB = String(b.householdId ?? '').trim()

  return householdA !== '' && householdA === householdB
}

function householdRoleLabel(relationship: string): string | null {
  const normalized = relationship.trim().toLowerCase()
  if (normalized === 'head') {
    return 'Head of household'
  }
  if (normalized === 'member') {
    return 'Household member'
  }
  return relationship !== '' ? relationship : null
}

function householdLocationLabel(village: string, town: string): string | null {
  const parts = [village, town].filter((part) => part !== '')
  return parts.length > 0 ? parts.join(', ') : null
}

function householdDisplayLabel(
  householdId: string,
  headOfHouse: string,
  relationship: string
): string {
  const role = householdRoleLabel(relationship)
  const parts = [householdId, headOfHouse !== '' ? `Head: ${headOfHouse}` : null, role].filter(
    (part) => part !== null && part !== ''
  )
  return parts.join(' · ')
}
