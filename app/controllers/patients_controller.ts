import type { HttpContext } from '@adonisjs/core/http'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'
import { TdltsBarcodeGenerator } from '#support/tdlts_barcode_generator'
import { findPatientRowByRef } from '#support/ref_resolvers'
import ReferenceDataInvalidator from '#services/cache/reference_data_invalidator'
import ReferenceDataCache from '#services/cache/reference_data_cache'
import { notificationService, NOTIFIABLE_PATIENT } from '#services/notifications/notification_service'
import { PortalInvitationNotification } from '../notifications/portal_invitation_notification.js'

const now = () => DateTime.now().toSQL({ includeOffset: false })!

const emptyToNull = (value: unknown): string | null => {
  const v = String(value ?? '').trim()
  return v === '' ? null : v
}

const digitsOnly = (value: unknown): string => String(value ?? '').replace(/\D+/g, '')

const normalizePhone = (value: unknown): string | null => {
  const raw = emptyToNull(value)
  if (raw === null) return null
  const hasLeadingPlus = raw.startsWith('+')
  const digits = digitsOnly(raw)
  if (digits === '') return null
  return (hasLeadingPlus ? '+' : '') + digits
}

const buildPhone = (code: unknown, number: unknown): string | null => {
  const numberDigits = digitsOnly(number)
  if (numberDigits === '') return null
  const normalizedCode = String(code ?? '').trim()
  if (normalizedCode === '') return numberDigits
  return normalizedCode + numberDigits.replace(/^0+/, '')
}

/**
 * Convert every empty-string value in a plain object to null so VineJS
 * `.nullable()` fields collapse cleanly (mirrors Laravel's `nullable`).
 */
function nullifyEmptyStrings(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? null : value
  }
  return out
}

const storeValidator = vine.compile(
  vine.object({
    first_name: vine.string().trim().maxLength(100),
    surname: vine.string().trim().maxLength(100),
    date_of_birth: vine.string().trim(),
    gender: vine.enum(['Male', 'Female']),
    no_nrc: vine.boolean().optional(),
    nrc_number: vine.string().trim().maxLength(50).nullable().optional(),
    country: vine.string().trim().maxLength(10),
    no_cellphone: vine.boolean().optional(),
    cellphone: vine.string().trim().maxLength(30).nullable().optional(),
    phone_code: vine.string().trim().maxLength(10).nullable().optional(),
    other_phone_code: vine.string().trim().maxLength(10).nullable().optional(),
    other_cellphone: vine.string().trim().maxLength(30).nullable().optional(),
    landline_code: vine.string().trim().maxLength(10).nullable().optional(),
    landline: vine.string().trim().maxLength(30).nullable().optional(),
    email: vine.string().trim().email().maxLength(150).nullable().optional(),
    home_language: vine.string().trim().maxLength(50),
    born_in_zambia: vine.enum(['Yes', 'No']),
    province_of_birth: vine.string().trim().maxLength(50),
    district_of_birth: vine.string().trim().maxLength(50),
    place_of_birth: vine.string().trim().maxLength(100).nullable().optional(),
    marital_status: vine.string().trim().maxLength(30).nullable().optional(),
    spouse_first_name: vine.string().trim().maxLength(100).nullable().optional(),
    spouse_surname: vine.string().trim().maxLength(100).nullable().optional(),
    occupation: vine.string().trim().maxLength(100).nullable().optional(),
    art_number: vine.string().trim().maxLength(50).nullable().optional(),
    nupn: vine.string().trim().maxLength(80).nullable().optional(),
    blood_group: vine.string().trim().maxLength(10).nullable().optional(),
    allergies: vine.string().trim().maxLength(5000).nullable().optional(),
    house_number: vine.string().trim().maxLength(50).nullable().optional(),
    road_street: vine.string().trim().maxLength(100).nullable().optional(),
    area: vine.string().trim().maxLength(100).nullable().optional(),
    city_town_village: vine.string().trim().maxLength(100).nullable().optional(),
    landmarks: vine.string().trim().maxLength(5000).nullable().optional(),
    registration_date: vine.string().trim(),
    wizard_step: vine.number().min(1).max(3).optional(),
  })
)

const updateValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().maxLength(200),
    date_of_birth: vine.string().trim(),
    gender: vine.enum(['Male', 'Female']),
    nrc_number: vine.string().trim().maxLength(50).nullable().optional(),
    country: vine.string().trim().maxLength(10).nullable().optional(),
    phone_number: vine.string().trim().maxLength(30).nullable().optional(),
    email: vine.string().trim().email().maxLength(150).nullable().optional(),
    other_cellphone: vine.string().trim().maxLength(30).nullable().optional(),
    landline: vine.string().trim().maxLength(30).nullable().optional(),
    house_number: vine.string().trim().maxLength(50).nullable().optional(),
    road_street: vine.string().trim().maxLength(100).nullable().optional(),
    area: vine.string().trim().maxLength(100).nullable().optional(),
    city_town_village: vine.string().trim().maxLength(100).nullable().optional(),
    landmarks: vine.string().trim().maxLength(5000).nullable().optional(),
    marital_status: vine.string().trim().maxLength(30).nullable().optional(),
    spouse_first_name: vine.string().trim().maxLength(100).nullable().optional(),
    spouse_surname: vine.string().trim().maxLength(100).nullable().optional(),
    home_language: vine.string().trim().maxLength(50).nullable().optional(),
    born_in_zambia: vine.enum(['Yes', 'No']).nullable().optional(),
    province_of_birth: vine.string().trim().maxLength(50).nullable().optional(),
    district_of_birth: vine.string().trim().maxLength(50).nullable().optional(),
    place_of_birth: vine.string().trim().maxLength(100).nullable().optional(),
    occupation: vine.string().trim().maxLength(100).nullable().optional(),
    art_number: vine.string().trim().maxLength(50).nullable().optional(),
    nupn: vine.string().trim().maxLength(80).nullable().optional(),
    blood_group: vine.string().trim().maxLength(10).nullable().optional(),
    allergies: vine.string().trim().maxLength(5000).nullable().optional(),
    status: vine.enum(['active', 'inactive']),
    is_deceased: vine.boolean().optional(),
    deceased_at: vine.string().trim().nullable().optional(),
    deceased_notes: vine.string().trim().maxLength(5000).nullable().optional(),
    portal_enabled: vine.boolean().optional(),
  })
)

const portalPasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8).confirmed(),
  })
)

/**
 * Staff patient management. Ported from App\Http\Controllers\PatientsController.
 *
 * The Laravel controller resolved patients via a business `{ref}` (patient_id /
 * barcode / numeric id) using raw DB queries; that lookup is replicated here.
 * jQuery DataTables JSON endpoints are collapsed into `index`, which returns a
 * paginated patient list with server-side search and filters.
 */
export default class PatientsController {
  /**
   * Resolve a patient row by its business ref (patient_id, barcode or numeric
   * id). Mirrors the Laravel raw-query route-model binding.
   */
  private async findByRef(ref: string) {
    return findPatientRowByRef(ref)
  }

  private async buildHouseholdLookup(householdIds: string[], householdHeads: string[] = []) {
    const ids = [...new Set(householdIds.filter((id) => id !== ''))]
    const heads = [...new Set(householdHeads.filter((h) => h !== ''))]

    const byId: Record<string, any> = {}
    const byHead: Record<string, any> = {}

    if (ids.length === 0 && heads.length === 0) {
      return { byId, byHead }
    }

    const rows = await db
      .from('households')
      .where((q) => {
        if (ids.length > 0) q.whereIn('household_id', ids)
        if (heads.length > 0) q.orWhereIn('head_of_house', heads)
      })

    for (const row of rows) {
      const id = String(row.household_id ?? '')
      if (id !== '') byId[id] = row
      const head = String(row.head_of_house ?? '')
      if (head !== '') byHead[head.toLowerCase()] = row
    }

    return { byId, byHead }
  }

  private normalizePatient(patient: Record<string, any>, household: Record<string, any> | null = null) {
    const householdId = String(patient.household_id ?? '')
    let phone = String(patient.phone_number ?? '')
    if (phone === '' && household) {
      phone = String(household.phone_number ?? '')
    }

    let address = ''
    if (household) {
      address = [household.village, household.town].filter((v) => v).join(', ')
    }

    return {
      id: String(patient.patient_id ?? ''),
      patientId: String(patient.patient_id ?? ''),
      fullName: String(patient.full_name ?? ''),
      gender: String(patient.gender ?? ''),
      dateOfBirth: patient.date_of_birth ? String(patient.date_of_birth) : null,
      nrcNumber: String(patient.nrc_number ?? ''),
      country: String(patient.country ?? ''),
      phoneNumber: phone,
      email: String(patient.email ?? ''),
      otherCellphone: String(patient.other_cellphone ?? ''),
      landline: String(patient.landline ?? ''),
      houseNumber: String(patient.house_number ?? ''),
      roadStreet: String(patient.road_street ?? ''),
      area: String(patient.area ?? ''),
      cityTownVillage: String(patient.city_town_village ?? ''),
      landmarks: String(patient.landmarks ?? ''),
      maritalStatus: String(patient.marital_status ?? ''),
      spouseFirstName: String(patient.spouse_first_name ?? ''),
      spouseSurname: String(patient.spouse_surname ?? ''),
      homeLanguage: String(patient.home_language ?? ''),
      bornInZambia: String(patient.born_in_zambia ?? ''),
      provinceOfBirth: String(patient.province_of_birth ?? ''),
      districtOfBirth: String(patient.district_of_birth ?? ''),
      placeOfBirth: String(patient.place_of_birth ?? ''),
      occupation: String(patient.occupation ?? ''),
      artNumber: String(patient.art_number ?? ''),
      nupn: String(patient.nupn ?? ''),
      bloodGroup: String(patient.blood_group ?? ''),
      allergies: String(patient.allergies ?? ''),
      relationshipToHead: String(patient.relationship_to_head ?? ''),
      householdId,
      barcode: String(patient.barcode || patient.patient_id || ''),
      createdAt: patient.source_created_at
        ? String(patient.source_created_at)
        : patient.created_at
          ? String(patient.created_at)
          : null,
      status: this.ucfirst(String(patient.status ?? 'active')),
      isDeceased: Boolean(patient.is_deceased),
      deceasedAt: patient.deceased_at ? String(patient.deceased_at) : null,
      deceasedNotes: String(patient.deceased_notes ?? ''),
      address,
    }
  }

  private ucfirst(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  /**
   * GET /patients — paginated list with server-side search and filters.
   */
  private applyPatientIndexFilters(
    query: ReturnType<typeof db.from>,
    filters: { search: string; householdId: string; gender: string; status: string }
  ) {
    const { search, householdId, gender, status } = filters

    if (householdId !== '') {
      query.where('household_id', householdId)
    }

    if (gender !== '') {
      query.where('gender', gender)
    }

    if (status === 'deceased') {
      query.where('is_deceased', true)
    } else if (status === 'active') {
      query.where('status', 'active').where('is_deceased', false)
    } else if (status === 'inactive') {
      query.where('status', 'inactive').where('is_deceased', false)
    }

    if (search !== '') {
      const like = `%${search}%`
      query.where((q) => {
        q.whereILike('patient_id', like)
          .orWhereILike('full_name', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('nrc_number', like)
          .orWhereILike('barcode', like)
          .orWhereILike('household_id', like)
      })
    }
  }

  private normalizePatientListRow(row: Record<string, any>) {
    return {
      patientId: String(row.patient_id ?? ''),
      fullName: String(row.full_name ?? ''),
      gender: String(row.gender ?? ''),
      dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : null,
      phoneNumber: String(row.phone_number ?? ''),
      householdId: String(row.household_id ?? ''),
      barcode: String(row.barcode ?? ''),
      status: this.ucfirst(String(row.status ?? 'active')),
      isDeceased: Boolean(row.is_deceased),
    }
  }

  private async buildPatientKpis() {
    return ReferenceDataCache.patientsKpis(async () => {
      const [totalRow, activeRow, deceasedRow, householdRow] = await Promise.all([
        db.from('patients').count('* as total'),
        db
          .from('patients')
          .where('status', 'active')
          .where('is_deceased', false)
          .count('* as total'),
        db.from('patients').where('is_deceased', true).count('* as total'),
        db
          .from('patients')
          .whereNotNull('household_id')
          .where('household_id', '!=', '')
          .count('* as total'),
      ])

      const total = Number(totalRow[0]?.$extras?.total ?? totalRow[0]?.total ?? 0)
      const active = Number(activeRow[0]?.$extras?.total ?? activeRow[0]?.total ?? 0)
      const deceased = Number(deceasedRow[0]?.$extras?.total ?? deceasedRow[0]?.total ?? 0)
      const withHousehold = Number(householdRow[0]?.$extras?.total ?? householdRow[0]?.total ?? 0)

      return { total, active, deceased, withHousehold }
    })
  }

  async index({ request, inertia }: HttpContext) {
    const search = String(request.qs().search ?? '').trim()
    const householdId = String(request.qs().householdId ?? '').trim()
    const gender = String(request.qs().gender ?? '').trim()
    const status = String(request.qs().status ?? '').trim()
    const page = Math.max(1, Number(request.qs().page ?? 1) || 1)
    const perPageRaw = Number(request.qs().per_page ?? 25)
    const perPage = [15, 25, 50].includes(perPageRaw) ? perPageRaw : 25

    const filters = { search, householdId, gender, status }

    const countQuery = db.from('patients')
    this.applyPatientIndexFilters(countQuery, filters)
    const countRow = await countQuery.count('* as total')
    const filteredTotal = Number(countRow[0]?.$extras?.total ?? countRow[0]?.total ?? 0)
    const lastPage = Math.max(1, Math.ceil(filteredTotal / perPage))
    const currentPage = Math.min(page, lastPage)
    const offset = (currentPage - 1) * perPage

    const dataQuery = db
      .from('patients')
      .select(
        'patient_id',
        'full_name',
        'gender',
        'date_of_birth',
        'phone_number',
        'household_id',
        'barcode',
        'status',
        'is_deceased'
      )
    this.applyPatientIndexFilters(dataQuery, filters)

    const rows = await dataQuery
      .orderBy('source_created_at', 'desc')
      .orderBy('id', 'desc')
      .offset(offset)
      .limit(perPage)

    const patients = rows.map((row) => this.normalizePatientListRow(row))
    const kpis = await this.buildPatientKpis()
    const from = filteredTotal === 0 ? 0 : offset + 1
    const to = filteredTotal === 0 ? 0 : Math.min(offset + patients.length, filteredTotal)

    return inertia.render('patients/index', {
      patients,
      kpis,
      filters: { search, householdId, gender, status },
      pagination: {
        page: currentPage,
        perPage,
        total: filteredTotal,
        lastPage,
        from,
        to,
      },
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('patients/create', {
      today: DateTime.now().toISODate(),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await storeValidator.validate(nullifyEmptyStrings(request.all()))

    const fullName =
      `${data.first_name} ${data.surname}`.replace(/\s+/g, ' ').trim() ||
      `${data.first_name} ${data.surname}`.trim()

    const patientId =
      'P-' +
      createHash('md5')
        .update(String(Date.now() / 1000) + String(randomInt(0, 99999)))
        .digest('hex')
        .substring(0, 8)
        .toUpperCase()
    const barcode = TdltsBarcodeGenerator.generate('P', patientId)

    const noCellphone = Boolean(data.no_cellphone)
    const noNrc = Boolean(data.no_nrc)

    const phoneNumber = noCellphone ? null : buildPhone(data.phone_code ?? '+260', data.cellphone ?? null)
    const otherCellphone = buildPhone(data.other_phone_code ?? null, data.other_cellphone ?? null)
    const landline = buildPhone(data.landline_code ?? null, data.landline ?? null)
    const nrcNumber = noNrc ? null : emptyToNull(data.nrc_number)

    await db.table('patients').insert({
      patient_id: patientId,
      full_name: fullName,
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      nrc_number: nrcNumber,
      country: data.country,
      phone_number: phoneNumber || null,
      email: emptyToNull(data.email),
      other_cellphone: otherCellphone,
      landline: landline,
      house_number: emptyToNull(data.house_number),
      road_street: emptyToNull(data.road_street),
      area: emptyToNull(data.area),
      city_town_village: emptyToNull(data.city_town_village),
      landmarks: emptyToNull(data.landmarks),
      marital_status: emptyToNull(data.marital_status),
      spouse_first_name: emptyToNull(data.spouse_first_name),
      spouse_surname: emptyToNull(data.spouse_surname),
      home_language: data.home_language,
      born_in_zambia: data.born_in_zambia,
      province_of_birth: data.province_of_birth,
      district_of_birth: data.district_of_birth,
      place_of_birth: emptyToNull(data.place_of_birth),
      occupation: emptyToNull(data.occupation),
      art_number: emptyToNull(data.art_number),
      nupn: emptyToNull(data.nupn),
      blood_group: emptyToNull(data.blood_group),
      allergies: emptyToNull(data.allergies),
      barcode,
      source_created_at: data.registration_date,
      created_at: now(),
      updated_at: now(),
    })

    await ReferenceDataInvalidator.invalidatePatient({ patientId, barcode }, null)

    session.flash('success', 'Patient registered successfully.')
    return response.redirect().toPath(`/patients/${patientId}`)
  }

  async show({ params, auth, inertia, response, session }: HttpContext) {
    const ref = String(params.ref)
    const user = auth.use('web').user ?? null

    const roleNames = user ? await user.getRoleNames() : []
    const directPermissions = user ? await user.getDirectPermissionNames() : []
    const isRegistrationClerk = roleNames.includes('registration-clerk')
    const hasRbacAssignments = !!user && (roleNames.length > 0 || directPermissions.length > 0)
    const canStartEncounter =
      !!user &&
      ((hasRbacAssignments && (await user.hasPermission('registration.create-encounter'))) ||
        !hasRbacAssignments)

    const row = await this.findByRef(ref)
    if (!row) {
      session.flash('error', 'Patient details were not found for the selected row.')
      return response.redirect().toPath('/patients')
    }

    let householdRow: any = null
    if (row.household_id) {
      householdRow = await db.from('households').where('household_id', String(row.household_id)).first()
    }
    if (!householdRow && row.household_head_of_house) {
      householdRow = await db
        .from('households')
        .where('head_of_house', String(row.household_head_of_house))
        .first()
    }

    const household = householdRow
      ? {
          id: String(householdRow.household_id ?? ''),
          householdId: String(householdRow.household_id ?? ''),
          householdName: String(householdRow.head_of_house ?? '—'),
          headOfHouseName: String(householdRow.head_of_house ?? '—'),
          barcode: String(householdRow.barcode ?? ''),
          phoneNumber: String(householdRow.phone_number ?? ''),
          village: String(householdRow.village ?? ''),
          town: String(householdRow.town ?? ''),
        }
      : null

    const patient = this.normalizePatient(row, householdRow)
    const patientDbId = row.id

    const notificationRows = await db
      .from('notifications')
      .where('notifiable_type', NOTIFIABLE_PATIENT)
      .where('notifiable_id', patientDbId)
      .orderBy('created_at', 'desc')
      .limit(8)

    const patientNotifications = notificationRows.map((n) => ({
      id: String(n.id),
      type: String(n.type ?? ''),
      data: this.parseJson(n.data),
      readAt: n.read_at ? String(n.read_at) : null,
      createdAt: n.created_at ? String(n.created_at) : null,
    }))

    let recentEncounters: any[] = []
    if (!isRegistrationClerk) {
      recentEncounters = await db
        .from('encounters')
        .where('patient_id', patientDbId)
        .whereNull('deleted_at')
        .orderBy('started_at', 'desc')
        .limit(20)
        .select(
          'id',
          'encounter_number',
          'current_stage',
          'current_status',
          'priority_level',
          'visit_type',
          'started_at',
          'closed_at'
        )
    }

    const householdMembers: any[] = []
    const hhId = String(row.household_id ?? '')
    if (hhId !== '') {
      const memberRows = await db
        .from('patients')
        .where('household_id', hhId)
        .orderBy('full_name')
        .select('patient_id', 'full_name', 'gender', 'date_of_birth', 'relationship_to_head', 'phone_number')

      for (const m of memberRows) {
        householdMembers.push({
          patientId: String(m.patient_id ?? ''),
          fullName: String(m.full_name ?? ''),
          gender: String(m.gender ?? ''),
          dateOfBirth: m.date_of_birth ?? null,
          relationshipToHead: String(m.relationship_to_head ?? ''),
          phoneNumber: String(m.phone_number ?? ''),
          isSelf: m.patient_id === row.patient_id,
        })
      }
    }

    return inertia.render('patients/show', {
      patient,
      patientDbId,
      household,
      recentEncounters,
      householdMembers,
      isRegistrationClerk,
      canStartEncounter,
      patientNotifications,
    })
  }

  async edit({ params, auth, inertia, response, session }: HttpContext) {
    const user = auth.use('web').user ?? null
    const isRegistrationClerk = user ? await user.hasRole('registration-clerk') : false

    const row = await this.findByRef(String(params.ref))
    if (!row) {
      session.flash('error', 'Patient not found.')
      return response.redirect().toPath('/patients')
    }

    return inertia.render('patients/edit', {
      patient: row,
      isRegistrationClerk,
    })
  }

  async update({ params, request, auth, response, session }: HttpContext) {
    const user = auth.use('web').user ?? null
    const isRegistrationClerk = user ? await user.hasRole('registration-clerk') : false

    const row = await this.findByRef(String(params.ref))
    if (!row) {
      session.flash('error', 'Patient not found.')
      return response.redirect().toPath('/patients')
    }

    const data = await updateValidator.validate(nullifyEmptyStrings(request.all()))

    // Manual unique email check (Laravel: unique:patients,email,{id}).
    const email = emptyToNull(data.email)
    if (email !== null) {
      const clash = await db
        .from('patients')
        .where('email', email)
        .whereNot('id', row.id)
        .first()
      if (clash) {
        session.flashErrors({ email: 'This email address is already in use.' })
        session.flashAll()
        return response.redirect().back()
      }
    }

    const portalEnabled = Boolean(data.portal_enabled)
    if (portalEnabled && (email ?? '') === '') {
      session.flashErrors({ email: 'An email address is required to enable the patient portal.' })
      session.flashAll()
      return response.redirect().back()
    }

    const isDeceased = Boolean(data.is_deceased)

    const payload: Record<string, any> = {
      full_name: String(data.full_name).replace(/\s+/g, ' ').trim() || String(data.full_name).trim(),
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      nrc_number: emptyToNull(data.nrc_number),
      country: emptyToNull(data.country),
      email,
      house_number: emptyToNull(data.house_number),
      road_street: emptyToNull(data.road_street),
      area: emptyToNull(data.area),
      city_town_village: emptyToNull(data.city_town_village),
      landmarks: emptyToNull(data.landmarks),
      marital_status: emptyToNull(data.marital_status),
      spouse_first_name: emptyToNull(data.spouse_first_name),
      spouse_surname: emptyToNull(data.spouse_surname),
      home_language: emptyToNull(data.home_language),
      born_in_zambia: emptyToNull(data.born_in_zambia),
      province_of_birth: emptyToNull(data.province_of_birth),
      district_of_birth: emptyToNull(data.district_of_birth),
      place_of_birth: emptyToNull(data.place_of_birth),
      occupation: emptyToNull(data.occupation),
      art_number: emptyToNull(data.art_number),
      nupn: emptyToNull(data.nupn),
      blood_group: emptyToNull(data.blood_group),
      allergies: emptyToNull(data.allergies),
      status: data.status,
      is_deceased: isDeceased,
      deceased_at: isDeceased ? (emptyToNull(data.deceased_at) ?? null) : null,
      deceased_notes: isDeceased ? emptyToNull(data.deceased_notes) : null,
      phone_number: normalizePhone(data.phone_number),
      other_cellphone: normalizePhone(data.other_cellphone),
      landline: normalizePhone(data.landline),
      portal_enabled: portalEnabled,
    }

    // Registration clerks cannot edit clinical/biometric fields.
    if (isRegistrationClerk) {
      delete payload.art_number
      delete payload.nupn
      delete payload.blood_group
      delete payload.allergies
    }

    const previousRow = { ...row }

    await db
      .from('patients')
      .where('id', row.id)
      .update({ ...payload, updated_at: now() })

    await ReferenceDataInvalidator.patientChangedFromRow(
      { ...previousRow, ...payload, patient_id: row.patient_id, barcode: row.barcode, id: row.id },
      previousRow
    )

    session.flash('success', 'Patient updated successfully.')
    return response.redirect().toPath(`/patients/${row.patient_id}`)
  }

  async encounters({ params, auth, inertia, response, session }: HttpContext) {
    const user = auth.use('web').user ?? null
    if (user && (await user.hasRole('registration-clerk'))) {
      return response.forbidden('Registration clerks cannot access patient encounter medical history.')
    }

    const row = await this.findByRef(String(params.ref))
    if (!row) {
      session.flash('error', 'Patient not found.')
      return response.redirect().toPath('/patients')
    }

    const encounters = await db
      .from('encounters')
      .where('patient_id', row.id)
      .whereNull('deleted_at')
      .orderBy('started_at', 'desc')
      .select(
        'id',
        'encounter_number',
        'current_stage',
        'current_status',
        'priority_level',
        'visit_type',
        'started_at',
        'closed_at'
      )

    return inertia.render('patients/encounters', {
      patient: this.normalizePatient(row),
      encounters,
    })
  }

  /**
   * POST /patients/{ref}/portal-invitation
   *
   * NOTE: Laravel used Password::broker('patients')->createToken(). Here we
   * persist a hashed reset token to `patient_password_reset_tokens` (same table
   * the portal reset flow reads) and deliver the invitation via the mail
   * channel. Mail is skipped gracefully when the mailer is unconfigured.
   */
  async sendPortalInvitation({ params, request, response, session }: HttpContext) {
    const row = await this.findByRef(String(params.ref))
    if (!row) {
      session.flash('error', 'Patient not found.')
      return response.redirect().toPath('/patients')
    }

    const patient = await Patient.find(row.id)
    if (!patient) {
      return response.notFound('Patient not found.')
    }

    if (!patient.email || patient.email.trim() === '') {
      session.flashErrors({ email: 'Add an email address before sending a portal invitation.' })
      return response.redirect().back()
    }

    if (!patient.portalEnabled) {
      patient.portalEnabled = true
      await patient.save()
    }

    const plainToken = randomBytes(32).toString('hex')
    const hashedToken = await hash.make(plainToken)

    await db.from('patient_password_reset_tokens').where('email', patient.email).delete()
    await db.table('patient_password_reset_tokens').insert({
      email: patient.email,
      token: hashedToken,
      created_at: now(),
    })

    const baseUrl = request.completeUrl().replace(/\/patients\/.*/, '')
    const resetUrl = `${baseUrl}/portal/reset-password/${plainToken}?email=${encodeURIComponent(patient.email)}&activation=1`

    await notificationService.send(
      { id: patient.id, email: patient.email, fullName: patient.fullName },
      new PortalInvitationNotification(resetUrl),
      NOTIFIABLE_PATIENT
    )

    session.flash('success', `Portal invitation sent to ${patient.email}.`)
    return response.redirect().back()
  }

  /**
   * PUT /patients/{ref}/portal-password
   */
  async updatePortalPassword({ params, request, response, session }: HttpContext) {
    const { password } = await request.validateUsing(portalPasswordValidator)

    const row = await this.findByRef(String(params.ref))
    if (!row) {
      session.flash('error', 'Patient not found.')
      return response.redirect().toPath('/patients')
    }

    const patient = await Patient.find(row.id)
    if (!patient) {
      return response.notFound('Patient not found.')
    }

    if (!patient.email || patient.email.trim() === '') {
      session.flashErrors({ email: 'Add an email address before setting a portal password.' })
      return response.redirect().back()
    }

    // The withAuthFinder beforeSave hook hashes the plain password on save.
    patient.password = password
    patient.portalEnabled = true
    patient.emailVerifiedAt = patient.emailVerifiedAt ?? DateTime.now()
    await patient.save()

    session.flash('success', 'Patient portal password updated.')
    return response.redirect().back()
  }

  /**
   * POST /patients/{ref}/notifications/{notification}/read
   */
  async markNotificationRead({ params, response }: HttpContext) {
    const row = await this.findByRef(String(params.ref))
    if (!row) return response.notFound({ message: 'Patient not found.' })

    const notification = await db
      .from('notifications')
      .where('id', String(params.notification))
      .where('notifiable_type', NOTIFIABLE_PATIENT)
      .where('notifiable_id', row.id)
      .first()

    if (!notification) return response.notFound({ message: 'Notification not found.' })

    if (notification.read_at === null) {
      await db.from('notifications').where('id', notification.id).update({ read_at: now() })
    }

    return response.json({ read: true })
  }

  /**
   * POST /patients/{ref}/notifications/read-all
   */
  async markAllNotificationsRead({ params, response }: HttpContext) {
    const row = await this.findByRef(String(params.ref))
    if (!row) return response.notFound({ message: 'Patient not found.' })

    const updated = await db
      .from('notifications')
      .where('notifiable_type', NOTIFIABLE_PATIENT)
      .where('notifiable_id', row.id)
      .whereNull('read_at')
      .update({ read_at: now() })

    return response.json({ read: true, updated: Number(updated) })
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string') return (value as Record<string, unknown>) ?? {}
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
}
