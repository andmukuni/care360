import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import StaffSignatureInvite from '#models/staff_signature_invite'
import { saveStaffSignatureFromDataUrl } from '#support/save_staff_signature'
import { signatureInviteUrl } from '#support/signature_invite_url'
import { publicStorageUrl } from '#support/public_storage_url'

const INVITE_TTL_DAYS = 7

const storeSignatureValidator = vine.compile(
  vine.object({
    signature_image: vine.string().trim(),
  })
)

type ActiveInviteContext = {
  invite: StaffSignatureInvite
  user: User
}

async function invalidatePendingInvites(userId: number): Promise<void> {
  await StaffSignatureInvite.query()
    .where('user_id', userId)
    .whereNull('completed_at')
    .where('expires_at', '>', DateTime.now().toSQL()!)
    .update({ expiresAt: DateTime.now() })
}

async function createInvite(
  targetUser: User,
  createdBy: User | null,
  request: HttpContext['request']
): Promise<StaffSignatureInvite> {
  await invalidatePendingInvites(targetUser.id)

  return StaffSignatureInvite.create({
    userId: targetUser.id,
    token: randomBytes(32).toString('hex'),
    createdBy: createdBy?.id ?? null,
    expiresAt: DateTime.now().plus({ days: INVITE_TTL_DAYS }),
  })
}

function invitePayload(invite: StaffSignatureInvite, request: HttpContext['request']) {
  return {
    url: signatureInviteUrl(request, invite.token),
    expires_at: invite.expiresAt.toISO(),
  }
}

async function findActiveInvite(token: string): Promise<ActiveInviteContext | null> {
  const invite = await StaffSignatureInvite.query().where('token', token).first()
  if (!invite?.isActive()) {
    return null
  }

  const user = await User.find(invite.userId)
  if (!user) {
    return null
  }

  return { invite, user }
}

async function latestCompletedInvite(userId: number): Promise<StaffSignatureInvite | null> {
  return StaffSignatureInvite.query()
    .where('user_id', userId)
    .whereNotNull('completed_at')
    .orderBy('completed_at', 'desc')
    .first()
}

function formatSignedAt(value: DateTime | null | undefined): string | null {
  if (!value) return null
  const dt = value instanceof DateTime ? value : DateTime.fromISO(String(value))
  return dt.isValid ? dt.toFormat("dd LLL yyyy 'at' HH:mm") : null
}

function capturePayload(invite: StaffSignatureInvite, user: User, extras: Record<string, unknown> = {}) {
  return {
    token: invite.token,
    staff_name: user.name,
    staff_title: user.title,
    staff_specialty: user.specialty,
    staff_email: user.email,
    ...extras,
  }
}

export default class StaffSignatureInviteController {
  /**
   * POST /users/:user/signature-invite — generate a mobile signing link (admin).
   */
  async createForUser({ auth, params, request, response }: HttpContext) {
    const targetUser = await User.findOrFail(params.user)
    const invite = await createInvite(targetUser, auth.use('web').user, request)

    return response.json(invitePayload(invite, request))
  }

  /**
   * POST /profile/signature-invite — generate a link for the current user.
   */
  async createForSelf({ auth, request, response }: HttpContext) {
    const user = auth.use('web').user!
    const invite = await createInvite(user, user, request)

    return response.json(invitePayload(invite, request))
  }

  /**
   * GET /sign/:token — mobile signature capture page (public).
   */
  async show({ params, inertia }: HttpContext) {
    const context = await findActiveInvite(params.token)
    if (!context) {
      return inertia.render('signatures/invalid')
    }

    const { invite, user } = context
    const signatureUrl = publicStorageUrl(user.signaturePath)
    if (signatureUrl) {
      const completed = await latestCompletedInvite(user.id)
      return inertia.render(
        'signatures/capture',
        capturePayload(invite, user, {
          already_signed: true,
          signature_url: signatureUrl,
          signed_at: formatSignedAt(completed?.completedAt),
        })
      )
    }

    return inertia.render('signatures/capture', capturePayload(invite, user))
  }

  /**
   * POST /sign/:token — save a drawn signature (public).
   */
  async store({ params, request, inertia }: HttpContext) {
    const context = await findActiveInvite(params.token)
    if (!context) {
      return inertia.render('signatures/invalid')
    }

    const { invite, user } = context
    const existingSignature = publicStorageUrl(user.signaturePath)
    if (existingSignature) {
      const completed = await latestCompletedInvite(user.id)
      return inertia.render(
        'signatures/capture',
        capturePayload(invite, user, {
          already_signed: true,
          signature_url: existingSignature,
          signed_at: formatSignedAt(completed?.completedAt),
        })
      )
    }

    const { signature_image: signatureImage } = await request.validateUsing(storeSignatureValidator)
    const relativePath = saveStaffSignatureFromDataUrl(signatureImage)

    if (!relativePath) {
      return inertia.render(
        'signatures/capture',
        capturePayload(invite, user, {
          error_message: 'Please draw your signature before submitting.',
        })
      )
    }

    user.signaturePath = relativePath
    await user.save()

    invite.completedAt = DateTime.now()
    invite.signerIp = request.ip()
    invite.signerUserAgent = (request.header('user-agent') ?? '').slice(0, 500) || null
    await invite.save()

    const { CachedSessionUserProvider } = await import('#services/auth/cached_session_user_provider')
    CachedSessionUserProvider.forgetUser(user.id)

    const savedSignatureUrl = publicStorageUrl(relativePath)

    return inertia.render(
      'signatures/capture',
      capturePayload(invite, user, {
        saved: true,
        signature_url: savedSignatureUrl,
        signed_at: formatSignedAt(invite.completedAt),
      })
    )
  }
}
