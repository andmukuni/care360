import type { HttpContext } from '@adonisjs/core/http'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'

/**
 * Patient portal authentication. Ported from
 * App\Http\Controllers\Portal\PatientAuthController.
 *
 * Uses the `patient` session guard. Login enforces the portal eligibility rules
 * (portal enabled, not deceased, active status, password set). Password reset is
 * backed by the `patient_password_reset_tokens` table (Laravel-compatible:
 * email / hashed token / created_at, 60 minute expiry).
 *
 * NOTE: the original controller records portal audit events via
 * PatientAuditService and emails the reset link. Audit logging and mail
 * delivery are wired in later migration phases; the token is persisted here so
 * the reset flow is functional.
 */
const RESET_TOKEN_EXPIRY_MINUTES = 60

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

const emailValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
  })
)

const resetValidator = vine.compile(
  vine.object({
    token: vine.string(),
    email: vine.string().email(),
    password: vine.string().minLength(8).confirmed(),
  })
)

export default class PatientAuthController {
  async showLogin({ auth, response, inertia }: HttpContext) {
    if (await auth.use('patient').check()) {
      return response.redirect('/portal')
    }

    return inertia.render('portal/login')
  }

  async login({ request, response, auth, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const patient = await Patient.query().where('email', email).first()

    if (!patient || !patient.portalEnabled) {
      session.flashErrors({
        email: 'These credentials do not match our records or portal access is not enabled.',
      })
      session.flashOnly(['email'])

      return response.redirect().back()
    }

    if (patient.isDeceased || (patient.status && patient.status !== 'active')) {
      session.flashErrors({
        email: 'Your portal access is not available. Please contact the hospital.',
      })
      session.flashOnly(['email'])

      return response.redirect().back()
    }

    if (!patient.password) {
      session.flashErrors({
        email: 'Please use the invitation link sent to your email to set your password first.',
      })
      session.flashOnly(['email'])

      return response.redirect().back()
    }

    let authenticated: Patient
    try {
      authenticated = await Patient.verifyCredentials(email, password)
    } catch {
      session.flashErrors({ email: 'These credentials do not match our records.' })
      session.flashOnly(['email'])

      return response.redirect().back()
    }

    await auth.use('patient').login(authenticated)
    session.regenerate()

    return response.redirect('/portal')
  }

  async logout({ auth, session, response }: HttpContext) {
    await auth.use('patient').logout()
    session.clear()

    return response.redirect('/portal/login')
  }

  async showForgotPassword({ inertia }: HttpContext) {
    return inertia.render('portal/forgot_password')
  }

  async sendResetLink({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(emailValidator)

    const patient = await Patient.query().where('email', email).first()

    if (!patient || !patient.portalEnabled) {
      session.flashErrors({
        email: 'We could not find a portal account with that email address.',
      })

      return response.redirect().back()
    }

    // Generate a reset token, store its hash and (in a later phase) email the
    // plain token to the patient. Existing tokens for the email are replaced.
    const plainToken = randomBytes(32).toString('hex')
    const hashedToken = await hash.make(plainToken)

    await db.from('patient_password_reset_tokens').where('email', email).delete()
    await db.table('patient_password_reset_tokens').insert({
      email,
      token: hashedToken,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    session.flash('status', 'We have emailed your password reset link.')

    return response.redirect().back()
  }

  async showResetPassword({ params, request, inertia }: HttpContext) {
    return inertia.render('portal/reset_password', {
      token: params.token,
      email: request.input('email', ''),
      isActivation: request.input('activation') === '1' || request.input('activation') === 'true',
    })
  }

  async resetPassword({ request, response, session }: HttpContext) {
    const { token, email, password } = await request.validateUsing(resetValidator)

    const record = await db.from('patient_password_reset_tokens').where('email', email).first()

    const tokenValid = record ? await hash.verify(record.token, token) : false
    const notExpired =
      record &&
      DateTime.fromJSDate(new Date(record.created_at)).diffNow('minutes').minutes >
        -RESET_TOKEN_EXPIRY_MINUTES

    if (!record || !tokenValid || !notExpired) {
      session.flashErrors({ email: 'This password reset token is invalid.' })

      return response.redirect().back()
    }

    const patient = await Patient.query().where('email', email).first()

    if (!patient) {
      session.flashErrors({ email: 'We could not find a portal account with that email address.' })

      return response.redirect().back()
    }

    // The withAuthFinder beforeSave hook hashes the plain password on save.
    patient.password = password
    patient.rememberToken = randomBytes(30).toString('hex')
    patient.emailVerifiedAt = patient.emailVerifiedAt ?? DateTime.now()
    patient.portalEnabled = true
    await patient.save()

    await db.from('patient_password_reset_tokens').where('email', email).delete()

    session.flash('status', 'Your password has been reset.')

    return response.redirect('/portal/login')
  }
}
