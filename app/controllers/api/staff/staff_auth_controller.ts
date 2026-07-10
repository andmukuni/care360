import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'

/**
 * Token-based authentication for the registration-desk desktop app.
 *
 * Ported from App\Http\Controllers\Api\Staff\StaffAuthController. Issues a
 * Sanctum-compatible personal access token (via the custom
 * SanctumAccessTokensProvider) to staff (User) accounts that hold
 * registration-desk access. Per-action authorisation is still enforced by the
 * permission middleware on each route.
 */
const DESK_PERMISSIONS = [
  'registration.search-patient',
  'registration.create-encounter',
  'registration.queue-to-triage',
]

const DESK_ROLES = ['registration-clerk', 'super-admin']

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
    device_name: vine.string().maxLength(120).optional(),
  })
)

export default class StaffAuthController {
  async login({ request, response }: HttpContext) {
    const { email, password, device_name } = await request.validateUsing(loginValidator)

    const generic = 'These credentials do not match our records.'

    const user = await User.query().where('email', email).first()

    if (!user || !user.password || !(await hash.use('laravel_bcrypt').verify(user.password, password))) {
      return response.unprocessableEntity({ errors: { email: [generic] } })
    }

    if (!(await this.hasDeskAccess(user))) {
      return response.unprocessableEntity({
        errors: {
          email: ['This account does not have registration-desk access. Contact an administrator.'],
        },
      })
    }

    // One token per device; replace any prior token for the same device.
    const deviceName = device_name ?? 'registration-desk'
    await User.accessTokens.deleteAll(user, deviceName)
    const token = await User.accessTokens.create(user, ['*'], { name: deviceName })

    return response.ok({
      token: token.value!.release(),
      staff: await this.staffPayload(user),
    })
  }

  async me({ auth, response }: HttpContext) {
    const user = auth.use('api').user as User

    return response.ok({ staff: await this.staffPayload(user) })
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.use('api').user as User
    const token = user.currentAccessToken
    if (token) {
      await User.accessTokens.delete(user, token.identifier)
    }

    return response.ok({ message: 'Logged out.' })
  }

  private async hasDeskAccess(user: User): Promise<boolean> {
    return (await user.hasAnyRole(DESK_ROLES)) || (await user.hasAnyPermission(DESK_PERMISSIONS))
  }

  private async staffPayload(user: User): Promise<Record<string, unknown>> {
    return {
      id: user.id,
      name: user.name,
      title: user.title,
      email: user.email,
      roles: await user.getRoleNames(),
      permissions: await user.getPermissionNames(),
    }
  }
}
