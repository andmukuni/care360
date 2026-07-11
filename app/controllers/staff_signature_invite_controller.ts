import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import StaffSignatureInvite from '#models/staff_signature_invite'
import { saveStaffSignatureFromDataUrl } from '#support/save_staff_signature'
import { signatureInviteUrl } from '#support/signature_invite_url'
import { publicStorageUrl } from '#support/public_storage_url'

const storeSignatureValidator = vine.compile(
  vine.object({
    signature_image: vine.string().trim(),
  })
)

type InviteContext = {
  invite: StaffSignatureInvite
  user: User
}

/** Drop outstanding links when a new one is generated (only one pending link per user). */
async function cancelPendingInvites(userId: number): Promise<void> {
  await StaffSignatureInvite.query().where('user_id', userId).whereNull('completed_at').delete()
}

async function createInvite(
  targetUser: User,
  createdBy: User | null,
  request: HttpContext['request']
): Promise<StaffSignatureInvite> {
  await cancelPendingInvites(targetUser.id)

  return StaffSignatureInvite.create({
    userId: targetUser.id,
    token: randomBytes(32).toString('hex'),
    createdBy: createdBy?.id ?? null,
    // Column is required; value is not used for expiry — links stay open until signed.
    expiresAt: DateTime.fromObject({ year: 2099, month: 12, day: 31 }, { zone: 'utc' }),
  })
}

function invitePayload(invite: StaffSignatureInvite, request: HttpContext['request']) {
  return {
    url: signatureInviteUrl(request, invite.token),
  }
}

async function findInviteByToken(token: string): Promise<InviteContext | null> {
  const invite = await StaffSignatureInvite.query().where('token', token).first()
  if (!invite) {
    return null
  }

  const user = await User.find(invite.userId)
  if (!user) {
    return null
  }

  return { invite, user }
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

function alreadySignedPayload(invite: StaffSignatureInvite, user: User) {
  const signatureUrl = publicStorageUrl(user.signaturePath)
  return capturePayload(invite, user, {
    already_signed: true,
    signature_url: signatureUrl,
    signed_at: formatSignedAt(invite.completedAt),
  })
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
    const context = await findInviteByToken(params.token)
    if (!context) {
      return inertia.render('signatures/invalid')
    }

    const { invite, user } = context
    if (!invite.isPending() || publicStorageUrl(user.signaturePath)) {
      return inertia.render('signatures/capture', alreadySignedPayload(invite, user))
    }

    return inertia.render('signatures/capture', capturePayload(invite, user))
  }

  /**
   * POST /sign/:token — save a drawn signature (public).
   */
  async store({ params, request, inertia }: HttpContext) {
    const context = await findInviteByToken(params.token)
    if (!context) {
      return inertia.render('signatures/invalid')
    }

    const { invite, user } = context
    if (!invite.isPending() || publicStorageUrl(user.signaturePath)) {
      return inertia.render('signatures/capture', alreadySignedPayload(invite, user))
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
