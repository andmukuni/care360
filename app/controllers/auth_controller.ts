import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import DashboardController from '#controllers/dashboard_controller'

/**
 * Staff authentication. Ported from App\Http\Controllers\AuthController.
 *
 * Handles the login page render, credential login (HTML + JSON), logout and the
 * lightweight session watchdog ping. Role-based landing mirrors the Laravel
 * behaviour: registration clerks land on registration, ward nurses on beds,
 * everyone else on the dashboard.
 */
const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(6),
  })
)

export default class AuthController {
  /**
   * Where an authenticated staff user should land based on their role.
   * (Targets for other roles live in later migration phases.)
   */
  private async landingPathForUser(user: User | null): Promise<string> {
    const roleNames = user ? await user.getRoleNames() : []

    if (roleNames.includes('registration-clerk')) {
      return '/registration'
    }

    if (roleNames.includes('ward-nurse')) {
      return '/beds'
    }

    return '/dashboard'
  }

  private wantsJson({ request }: HttpContext): boolean {
    if (request.header('x-inertia')) {
      return false
    }

    const accept = request.header('accept') ?? ''
    return accept.includes('application/json') && !accept.includes('text/html')
  }

  /**
   * Lightweight JSON endpoint for the SPA-style session watchdog
   * (session-timeout modal). Also doubles as the keepalive ping.
   */
  async sessionPing({ response }: HttpContext) {
    return response.json({ ok: true })
  }

  /**
   * App entry point: send guests to login, authenticated staff to their landing page.
   */
  async home({ auth, response }: HttpContext) {
    if (await auth.use('web').check()) {
      return response.redirect(await this.landingPathForUser(auth.use('web').user ?? null))
    }

    return response.redirect('/login')
  }

  async showLogin(ctx: HttpContext) {
    const { auth, response, inertia } = ctx

    if (await auth.use('web').check()) {
      return response.redirect(await this.landingPathForUser(auth.use('web').user ?? null))
    }

    return inertia.render('auth/login')
  }

  async login(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const { email, password } = await request.validateUsing(loginValidator)
    const wantsJson = this.wantsJson(ctx)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch {
      if (wantsJson) {
        return response.unprocessableEntity({
          message: 'The provided credentials are incorrect.',
          errors: { email: ['These credentials do not match our records.'] },
        })
      }

      session.flashErrors({ login: 'Invalid email or password.' })
      session.flashAll()

      return response.redirect().back()
    }

    await auth.use('web').login(user)
    // Rotate the session id to prevent fixation (Laravel: session()->regenerate()).
    session.regenerate()

    if (wantsJson) {
      return response.json({
        message: 'Login successful.',
        csrf_token: request.csrfToken,
      })
    }

    session.flash('success', 'Login successful!')

    return response.redirect(await this.landingPathForUser(user))
  }

  /**
   * Staff dashboard. Delegates to DashboardController which builds the full
   * KPI + encounter-cycle payload (Phase 4). Role-based redirects are handled
   * there too.
   */
  async dashboard(ctx: HttpContext) {
    return new DashboardController().index(ctx)
  }

  /**
   * Reception kiosk dashboard. Ported from
   * App\Http\Controllers\AuthController::receptionDashboard — daily KPIs, recent
   * registrations/households, shift summary and a lightweight patient search.
   */
  async receptionDashboard({ request, inertia }: HttpContext) {
    const today = DateTime.now().toISODate()!

    const allowedSearchBy = ['barcode', 'nrc', 'art', 'nupn', 'cellphone', 'full_name']
    let searchBy = String(request.qs().search_by ?? 'nrc')
    if (!allowedSearchBy.includes(searchBy)) searchBy = 'nrc'

    const queryValue = String(request.qs().q ?? '').trim()
    const firstName = String(request.qs().first_name ?? '').trim()
    const lastName = String(request.qs().last_name ?? '').trim()
    const dob = String(request.qs().dob ?? '').trim()
    const gender = String(request.qs().gender ?? '').trim()

    const hasSearch =
      searchBy === 'full_name'
        ? firstName !== '' || lastName !== '' || dob !== '' || gender !== ''
        : queryValue !== ''

    const [{ count: todayRegistrations }] = await db
      .from('patients')
      .whereRaw('DATE(COALESCE(source_created_at, created_at)) = ?', [today])
      .count('* as count')
    const [{ count: todayHouseholds }] = await db
      .from('households')
      .whereRaw('DATE(COALESCE(source_created_at, created_at)) = ?', [today])
      .count('* as count')
    const shiftRow = await db
      .from('shift_reports')
      .whereRaw('DATE(report_date) = ?', [today])
      .sum('total_patients_seen as total')
      .first()
    const todayShiftPatients = Number(shiftRow?.total ?? 0)

    const recentRegistrations = await db
      .from('patients')
      .select(
        'patient_id',
        'full_name',
        'gender',
        'phone_number',
        'nrc_number',
        'date_of_birth',
        'household_head_of_house',
        'barcode',
        db.raw('COALESCE(source_created_at, created_at) as registered_at')
      )
      .orderBy('registered_at', 'desc')
      .limit(12)

    let results: any[] = []
    if (hasSearch) {
      const q = db
        .from('patients')
        .select(
          'id',
          'patient_id',
          'full_name',
          'gender',
          'date_of_birth',
          'phone_number',
          'nrc_number',
          'household_head_of_house',
          'barcode'
        )
      if (searchBy === 'full_name') {
        if (firstName !== '') q.whereILike('full_name', `%${firstName}%`)
        if (lastName !== '') q.whereILike('full_name', `%${lastName}%`)
        if (dob !== '') q.whereRaw('DATE(date_of_birth) = ?', [dob])
        if (gender !== '') q.whereRaw('LOWER(gender) = ?', [gender.toLowerCase()])
      } else if (searchBy === 'barcode') {
        q.where((sub) => sub.whereILike('barcode', `%${queryValue}%`).orWhereILike('patient_id', `%${queryValue}%`))
      } else if (searchBy === 'nrc') {
        q.whereILike('nrc_number', `%${queryValue}%`)
      } else if (searchBy === 'cellphone') {
        q.whereILike('phone_number', `%${queryValue}%`)
      } else {
        q.whereRaw('1 = 0')
      }
      results = await q.orderBy('id', 'desc').limit(25)
    }

    const recentHouseholds = await db
      .from('households')
      .select(
        'household_id',
        'head_of_house',
        'phone_number',
        'village',
        'town',
        'barcode',
        db.raw('COALESCE(source_created_at, created_at) as registered_at')
      )
      .orderBy('registered_at', 'desc')
      .limit(8)

    const shiftSummary = await db
      .from('shift_reports')
      .select('shift_type')
      .sum('total_patients_seen as total_seen')
      .groupBy('shift_type')
      .orderBy('total_seen', 'desc')

    return inertia.render('reception/dashboard', {
      todayRegistrations: Number(todayRegistrations),
      todayHouseholds: Number(todayHouseholds),
      todayShiftPatients,
      recentRegistrations,
      recentHouseholds,
      shiftSummary,
      results,
      hasSearch,
      searchBy,
      queryValue,
      firstName,
      lastName,
      dob,
      gender,
      totalRecords: results.length,
    })
  }

  async logout({ auth, session, response }: HttpContext) {
    await auth.use('web').logout()
    session.clear()
    session.flash('success', 'Logged out successfully.')

    return response.redirect('/login')
  }
}
