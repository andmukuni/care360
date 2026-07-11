import { DateTime } from 'luxon'
import type { Request } from '@adonisjs/core/http'
import User from '#models/user'
import StaffSignatureInvite from '#models/staff_signature_invite'
import { publicStorageUrl } from '#support/public_storage_url'
import { signatureInviteUrl } from '#support/signature_invite_url'

export type StaffSignatureMeta = {
  signature_url: string | null
  signature_signed_at: string | null
  pending_signature_invite: { url: string; expires_at: string } | null
}

export async function staffSignatureMeta(
  user: User,
  request?: Request
): Promise<StaffSignatureMeta> {
  const signatureUrl = publicStorageUrl(user.signaturePath)

  const completedInvite = await StaffSignatureInvite.query()
    .where('user_id', user.id)
    .whereNotNull('completed_at')
    .orderBy('completed_at', 'desc')
    .first()

  let pendingInvite: StaffSignatureMeta['pending_signature_invite'] = null
  if (request) {
    const invite = await StaffSignatureInvite.query()
      .where('user_id', user.id)
      .whereNull('completed_at')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .orderBy('created_at', 'desc')
      .first()

    if (invite) {
      pendingInvite = {
        url: signatureInviteUrl(request, invite.token),
        expires_at: invite.expiresAt.toISO()!,
      }
    }
  }

  return {
    signature_url: signatureUrl,
    signature_signed_at: completedInvite?.completedAt?.toFormat("dd LLL yyyy 'at' hh:mm a") ?? null,
    pending_signature_invite: pendingInvite,
  }
}
