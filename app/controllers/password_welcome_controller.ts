import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import { CachedSessionUserProvider } from '#services/auth/cached_session_user_provider'
import { landingPathForRoles } from '#support/staff/role_nav_profiles'

const changePasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(6).confirmed(),
  })
)

/**
 * Post-login password choice for staff reset to the shared default.
 * Users may set a new password or explicitly keep the current one.
 */
export default class PasswordWelcomeController {
  private async landingPath(user: User): Promise<string> {
    const roleNames = await user.getRoleNames()
    return landingPathForRoles(roleNames)
  }

  async show({ auth, response, inertia }: HttpContext) {
    const user = auth.user as User
    if (!user.mustChangePassword) {
      return response.redirect(await this.landingPath(user))
    }

    return inertia.render('auth/password_welcome', {
      userName: user.name,
    })
  }

  async keep({ auth, response, session }: HttpContext) {
    const user = auth.user as User
    user.mustChangePassword = false
    await user.save()

    session.flash('success', 'You chose to keep your current password.')
    return response.redirect(await this.landingPath(user))
  }

  async change({ auth, request, response, session }: HttpContext) {
    const user = auth.user as User
    const data = await request.validateUsing(changePasswordValidator)

    // withAuthFinder beforeSave hook hashes the plain password.
    user.password = data.password
    user.mustChangePassword = false
    await user.save()

    session.flash('success', 'Password updated successfully.')
    return response.redirect(await this.landingPath(user))
  }
}
