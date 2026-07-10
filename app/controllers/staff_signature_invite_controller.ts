import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import StaffSignatureInvite from '#models/staff_signature_invite'
import { saveStaffSignatureFromDataUrl } from '#support/save_staff_signature'
import { signatureInviteUrl } from '#support/signature_invite_url'

const INVITE_TTL_DAYS = 7

const storeSignatureValidator = vine.compile(
  vine.object({
    signature_image: vine.string().trim(),
  })
)

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

async function findActiveInvite(token: string): Promise<StaffSignatureInvite | null> {
  const invite = await StaffSignatureInvite.query().where('token', token).preload('user').first()
  if (!invite || !invite.isActive()) {
    return null
  }
  return invite
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
    const invite = await findActiveInvite(params.token)
    if (!invite) {
      return inertia.render('signatures/invalid')
    }

    return inertia.render('signatures/capture', {
      token: invite.token,
      staff_name: invite.user.name,
    })
  }

  /**
   * POST /sign/:token — save a drawn signature (public).
   */
  async store({ params, request, inertia }: HttpContext) {
    const invite = await findActiveInvite(params.token)
    if (!invite) {
      return inertia.render('signatures/invalid')
    }

    const { signature_image: signatureImage } = await request.validateUsing(storeSignatureValidator)
    const relativePath = saveStaffSignatureFromDataUrl(signatureImage)

    if (!relativePath) {
      return inertia.render('signatures/capture', {
        token: invite.token,
        staff_name: invite.user.name,
        error_message: 'Please draw your signature before saving.',
      })
    }

    const user = invite.user
    user.signaturePath = relativePath
    await user.save()

    invite.completedAt = DateTime.now()
    await invite.save()

    const { CachedSessionUserProvider } = await import('#services/auth/cached_session_user_provider')
    CachedSessionUserProvider.forgetUser(user.id)

    return inertia.render('signatures/capture', {
      token: invite.token,
      staff_name: user.name,
      saved: true,
    })
  }
}
