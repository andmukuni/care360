import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import Role from '#models/role'
import Encounter from '#models/encounter'
import PharmacyPrescription from '#models/pharmacy_prescription'
import PharmacyDispense from '#models/pharmacy_dispense'
import LabResult from '#models/lab_result'
import CalendarEvent from '#models/calendar_event'
import RbacService, { USER_MORPH_TYPE } from '#services/auth/rbac_service'
import { publicStorageUrl } from '#support/public_storage_url'

/**
 * Staff user management + self-service profile.
 * Ported from App\Http\Controllers\UserController.
 *
 * The Laravel jQuery DataTables JSON endpoint (`datatable`) is collapsed into
 * `index`, which returns the full ordered user list for the shared client-side
 * DataTable. Role assignment writes go straight to the Spatie `model_has_roles`
 * pivot (scoped to the `App\\Models\\User` morph). Profile-photo uploads are
 * stored under `public/storage/profile-photos` (served at `/storage/...`);
 * image optimisation is deferred (no image library is installed in this app).
 */
function portalDisplayName(user: { title: string | null; name: string }): string {
  const title = (user.title ?? '').trim()
  return title !== '' ? `${title} ${user.name}` : user.name
}

async function syncUserRoles(user: User, roleNames: string[]): Promise<void> {
  const rows = roleNames.length
    ? await db.from('roles').whereIn('name', roleNames).select('id')
    : []

  await db
    .from('model_has_roles')
    .where('model_type', USER_MORPH_TYPE)
    .where('model_id', user.id)
    .delete()

  if (rows.length) {
    await db.table('model_has_roles').multiInsert(
      rows.map((r) => ({ role_id: r.id, model_type: USER_MORPH_TYPE, model_id: user.id }))
    )
  }

  RbacService.forget(user)
}

async function canManageRolesOnUsers(user: User | undefined | null): Promise<boolean> {
  if (!user) return false
  if (await user.isLegacyUserWithoutRbac()) return true
  if (await user.hasAnyPermission(['users.write', 'settings.manage'])) return true
  return user.hasRole('super-admin')
}

const storeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(255),
    email: vine.string().trim().email(),
    password: vine.string().minLength(8).confirmed(),
  })
)

const updateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(255),
    title: vine.string().trim().maxLength(40).nullable().optional(),
    specialty: vine.string().trim().maxLength(120).nullable().optional(),
    bio: vine.string().trim().maxLength(5000).nullable().optional(),
    email: vine.string().trim().email(),
  })
)

const rolesValidator = vine.compile(
  vine.object({
    roles: vine.array(vine.string()).optional(),
  })
)

export default class UsersController {
  async index({ auth, inertia }: HttpContext) {
    const authUser = auth.use('web').user!
    const canManageRoles = await canManageRolesOnUsers(authUser)

    const roles = await Role.query().orderBy('name').select('name')

    const users = await User.query()
      .preload('roles', (q) => q.wherePivot('model_type', USER_MORPH_TYPE).select('id', 'name'))
      .orderBy('name')

    return inertia.render('users/index', {
      users: users.map((u) => ({
        id: u.id,
        name: portalDisplayName(u),
        raw_name: u.name,
        title: u.title,
        email: u.email,
        specialty: u.specialty,
        is_portal_bookable: Boolean(u.isPortalBookable),
        profile_photo_url: publicStorageUrl(u.profilePhotoPath),
        roles: u.roles.map((r) => r.name).sort(),
        created_at: u.createdAt?.toFormat('dd LLL yyyy') ?? null,
        is_self: u.id === authUser.id,
      })),
      roles: roles.map((r) => r.name),
      canManageRoles,
      canManagePortal: canManageRoles,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(storeValidator)

    const existing = await User.query().where('email', payload.email).first()
    if (existing) {
      session.flashErrors({ email: 'The email has already been taken.' })
      return response.redirect().back()
    }

    const user = new User()
    user.name = payload.name
    user.email = payload.email
    user.password = payload.password
    await user.save()

    const role = await Role.firstOrCreate({ name: 'records-officer' }, { name: 'records-officer', guardName: 'web' })
    await db.table('model_has_roles').insert({
      role_id: role.id,
      model_type: USER_MORPH_TYPE,
      model_id: user.id,
    })

    session.flash('success', 'User created successfully.')
    return response.redirect().toPath('/users')
  }

  async show({ params, inertia }: HttpContext) {
    const user = await User.findOrFail(params.user)
    return inertia.render('users/show', await this.buildProfilePayload(user))
  }

  async edit({ params, inertia }: HttpContext) {
    const user = await User.findOrFail(params.user)
    return inertia.render('users/edit', { user: this.editPayload(user) })
  }

  async update(ctx: HttpContext) {
    const user = await User.findOrFail(ctx.params.user)
    const applied = await this.applyProfileUpdate(ctx, user)
    if (!applied) return

    ctx.session.flash('success', 'Profile updated successfully.')
    return ctx.response.redirect().toPath(`/users/${user.id}`)
  }

  async destroy({ auth, params, response, session }: HttpContext) {
    const user = await User.findOrFail(params.user)

    if (user.id === auth.use('web').user!.id) {
      session.flash('error', 'You cannot delete your own account.')
      return response.redirect().back()
    }

    await db.from('model_has_roles').where('model_type', USER_MORPH_TYPE).where('model_id', user.id).delete()
    await db
      .from('model_has_permissions')
      .where('model_type', USER_MORPH_TYPE)
      .where('model_id', user.id)
      .delete()
    await user.delete()
    const { CachedSessionUserProvider } = await import('#services/auth/cached_session_user_provider')
    CachedSessionUserProvider.forgetUser(user.id)

    session.flash('success', 'User deleted successfully.')
    return response.redirect().toPath('/users')
  }

  async togglePortalBookable({ auth, params, response, session }: HttpContext) {
    if (!(await canManageRolesOnUsers(auth.use('web').user))) {
      return response.forbidden('Forbidden')
    }

    const user = await User.findOrFail(params.user)
    user.isPortalBookable = !user.isPortalBookable
    await user.save()

    const message = user.isPortalBookable
      ? `${portalDisplayName(user)} is now visible on the patient portal.`
      : `${portalDisplayName(user)} was removed from the patient portal.`

    session.flash('success', message)
    return response.redirect().back()
  }

  async updateRoles({ auth, params, request, response, session }: HttpContext) {
    if (!(await canManageRolesOnUsers(auth.use('web').user))) {
      return response.forbidden('Forbidden')
    }

    const user = await User.findOrFail(params.user)
    const { roles } = await request.validateUsing(rolesValidator)

    const valid = roles?.length
      ? (await db.from('roles').whereIn('name', roles).select('name')).map((r) => String(r.name))
      : []

    await syncUserRoles(user, valid)

    session.flash('success', `Roles updated for ${user.name}.`)
    return response.redirect().toPath('/users')
  }

  // ── Self-service profile (current authenticated user) ─────────────────────

  async profile({ auth, inertia }: HttpContext) {
    const user = auth.use('web').user!
    return inertia.render('profile/show', await this.buildProfilePayload(user))
  }

  async editProfile({ auth, inertia }: HttpContext) {
    const user = auth.use('web').user!
    return inertia.render('profile/edit', { user: this.editPayload(user) })
  }

  async updateProfile(ctx: HttpContext) {
    const user = ctx.auth.use('web').user!
    const applied = await this.applyProfileUpdate(ctx, user)
    if (!applied) return

    ctx.session.flash('success', 'Profile updated successfully.')
    return ctx.response.redirect().toPath('/profile')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private editPayload(user: User) {
    return {
      id: user.id,
      name: user.name,
      title: user.title,
      specialty: user.specialty,
      bio: user.bio,
      email: user.email,
      is_portal_bookable: Boolean(user.isPortalBookable),
      profile_photo_path: user.profilePhotoPath,
      profile_photo_url: publicStorageUrl(user.profilePhotoPath),
      signature_path: user.signaturePath,
      signature_url: publicStorageUrl(user.signaturePath),
    }
  }

  /**
   * Validate + persist the editable profile fields (shared by admin update and
   * self-service updateProfile). Returns false when it has already issued a
   * redirect (validation failure), true when the save succeeded.
   */
  private async applyProfileUpdate(ctx: HttpContext, user: User): Promise<boolean> {
    const { request, response, session } = ctx
    const payload = await request.validateUsing(updateValidator)

    const emailTaken = await User.query()
      .where('email', payload.email)
      .whereNot('id', user.id)
      .first()
    if (emailTaken) {
      session.flashErrors({ email: 'The email has already been taken.' })
      response.redirect().back()
      return false
    }

    const password = request.input('password')
    if (password) {
      if (String(password).length < 8) {
        session.flashErrors({ password: 'The password must be at least 8 characters.' })
        response.redirect().back()
        return false
      }
      if (String(password) !== request.input('password_confirmation')) {
        session.flashErrors({ password: 'The password confirmation does not match.' })
        response.redirect().back()
        return false
      }
      user.password = String(password)
    }

    user.name = payload.name
    user.title = payload.title ?? null
    user.specialty = payload.specialty ?? null
    user.bio = payload.bio ?? null
    user.isPortalBookable = request.input('is_portal_bookable', false) ? true : false
    user.email = payload.email

    const removePhoto = Boolean(request.input('remove_profile_photo', false))
    if (removePhoto && user.profilePhotoPath) {
      user.profilePhotoPath = null
    }

    const photo = request.file('profile_photo', {
      size: '4mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })
    if (photo && photo.isValid) {
      const dir = app.makePath('public/storage/profile-photos')
      mkdirSync(dir, { recursive: true })
      const fileName = `${randomUUID()}.${photo.extname}`
      await photo.move(dir, { name: fileName, overwrite: true })
      user.profilePhotoPath = `profile-photos/${fileName}`
    }

    const removeSignature = Boolean(request.input('remove_signature', false))
    if (removeSignature && user.signaturePath) {
      user.signaturePath = null
    }

    const signature = request.file('signature', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })
    if (signature && signature.isValid) {
      const dir = app.makePath('public/storage/staff-signatures')
      mkdirSync(dir, { recursive: true })
      const fileName = `${randomUUID()}.${signature.extname}`
      await signature.move(dir, { name: fileName, overwrite: true })
      user.signaturePath = `staff-signatures/${fileName}`
    }

    await user.save()
    const { CachedSessionUserProvider } = await import('#services/auth/cached_session_user_provider')
    CachedSessionUserProvider.forgetUser(user.id)
    return true
  }

  /**
   * Build the activity-profile payload (counts + merged timeline). Mirrors the
   * Laravel show() view data; the per-source relations that the Adonis User
   * model does not declare are queried directly against their foreign keys.
   */
  private async buildProfilePayload(user: User) {
    const uid = user.id

    const count = async (query: any): Promise<number> => {
      const [row] = await query.count('* as total')
      return Number(row?.total ?? row?.$extras?.total ?? 0)
    }

    const [
      encountersStarted,
      encountersClosed,
      prescriptions,
      dispenses,
      labRecorded,
      labVerified,
      calendarEvents,
    ] = await Promise.all([
      count(db.from('encounters').where('started_by', uid).whereNull('deleted_at')),
      count(db.from('encounters').where('closed_by', uid).whereNull('deleted_at')),
      count(db.from('pharmacy_prescriptions').where('prescribed_by', uid)),
      count(db.from('pharmacy_dispenses').where('dispensed_by', uid)),
      count(db.from('lab_results').where('recorded_by', uid)),
      count(db.from('lab_results').where('verified_by', uid)),
      count(db.from('calendar_events').where('created_by', uid)),
    ])

    const SOURCE_LIMIT = 100
    const timeline: {
      type: string
      label: string
      sub: string
      ref: string
      date: string | null
      icon: string
      color: string
    }[] = []

    const started = await Encounter.query()
      .where('startedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('started_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const e of started) {
      timeline.push({
        type: 'encounter_started',
        label: 'Started encounter',
        sub: e.patient?.fullName ?? 'Unknown patient',
        ref: e.encounterNumber ?? `#${e.id}`,
        date: (e.startedAt ?? e.createdAt)?.toISO() ?? null,
        icon: 'door',
        color: 'blue',
      })
    }

    const closed = await Encounter.query()
      .where('closedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('closed_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const e of closed) {
      timeline.push({
        type: 'encounter_closed',
        label: 'Closed encounter',
        sub: e.patient?.fullName ?? 'Unknown patient',
        ref: e.encounterNumber ?? `#${e.id}`,
        date: (e.closedAt ?? e.updatedAt)?.toISO() ?? null,
        icon: 'check',
        color: 'green',
      })
    }

    const scripts = await PharmacyPrescription.query()
      .where('prescribedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('prescribed_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const p of scripts) {
      timeline.push({
        type: 'prescription',
        label: 'Wrote prescription',
        sub: p.patient?.fullName ?? 'Unknown patient',
        ref: p.prescriptionNumber ?? `#${p.id}`,
        date: (p.prescribedAt ?? p.createdAt)?.toISO() ?? null,
        icon: 'pill',
        color: 'purple',
      })
    }

    const disp = await PharmacyDispense.query()
      .where('dispensedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('created_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const d of disp) {
      timeline.push({
        type: 'dispense',
        label: 'Dispensed medication',
        sub: d.patient?.fullName ?? 'Unknown patient',
        ref: `#${d.id}`,
        date: d.createdAt?.toISO() ?? null,
        icon: 'bag',
        color: 'orange',
      })
    }

    const recorded = await LabResult.query()
      .where('recordedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('result_recorded_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const r of recorded) {
      timeline.push({
        type: 'lab_recorded',
        label: 'Recorded lab result',
        sub: r.patient?.fullName ?? 'Unknown patient',
        ref: `#${r.id}`,
        date: (r.resultRecordedAt ?? r.createdAt)?.toISO() ?? null,
        icon: 'flask',
        color: 'teal',
      })
    }

    const verified = await LabResult.query()
      .where('verifiedBy', uid)
      .preload('patient', (q) => q.select('id', 'full_name'))
      .orderBy('verified_at', 'desc')
      .limit(SOURCE_LIMIT)
    for (const r of verified) {
      timeline.push({
        type: 'lab_verified',
        label: 'Verified lab result',
        sub: r.patient?.fullName ?? 'Unknown patient',
        ref: `#${r.id}`,
        date: (r.verifiedAt ?? r.updatedAt)?.toISO() ?? null,
        icon: 'shield',
        color: 'indigo',
      })
    }

    const cal = await CalendarEvent.query()
      .where('createdBy', uid)
      .orderBy('event_date', 'desc')
      .limit(SOURCE_LIMIT)
    for (const ev of cal) {
      timeline.push({
        type: 'calendar',
        label: 'Created calendar event',
        sub: ev.title,
        ref: ev.eventType,
        date: ev.createdAt?.toISO() ?? null,
        icon: 'calendar',
        color: 'rose',
      })
    }

    timeline.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

    return {
      user: {
        id: user.id,
        name: portalDisplayName(user),
        raw_name: user.name,
        title: user.title,
        specialty: user.specialty,
        bio: user.bio,
        email: user.email,
        is_portal_bookable: Boolean(user.isPortalBookable),
        profile_photo_url: publicStorageUrl(user.profilePhotoPath),
        roles: await user.getRoleNames(),
      },
      stats: {
        encountersStarted,
        encountersClosed,
        prescriptions,
        dispenses,
        labRecorded,
        labVerified,
        calendarEvents,
      },
      timeline,
    }
  }
}
