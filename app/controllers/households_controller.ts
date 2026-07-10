import type { HttpContext } from '@adonisjs/core/http'
import { randomInt } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { TdltsBarcodeGenerator } from '#support/tdlts_barcode_generator'
import {
  findAllHouseholdRows,
  findHouseholdRowByRef,
  findPatientRowByRef,
} from '#support/ref_resolvers'
import ReferenceDataInvalidator from '#services/cache/reference_data_invalidator'

const now = () => DateTime.now().toSQL({ includeOffset: false })!

type ExtractionResult = { status: 'created' | 'updated' | 'skipped'; message: string }

const storeValidator = vine.compile(
  vine.object({
    head_of_house: vine.string().trim().maxLength(200),
    nrc_number: vine.string().trim().maxLength(50).nullable().optional(),
    phone_number: vine.string().trim().maxLength(30).nullable().optional(),
    village: vine.string().trim().maxLength(100).nullable().optional(),
    town: vine.string().trim().maxLength(100).nullable().optional(),
    household_type: vine.string().trim().maxLength(100).nullable().optional(),
    subscription_plan: vine.string().trim().maxLength(100).nullable().optional(),
    subscription_fee: vine.number().min(0).nullable().optional(),
    payment_method: vine.string().trim().maxLength(100).nullable().optional(),
    payment_status: vine.string().trim().maxLength(100).nullable().optional(),
    transaction_code: vine.string().trim().maxLength(100).nullable().optional(),
  })
)

const memberValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().maxLength(200),
    gender: vine.enum(['Male', 'Female', 'male', 'female']).nullable().optional(),
    date_of_birth: vine.string().trim().nullable().optional(),
    phone_number: vine.string().trim().maxLength(30).nullable().optional(),
    nrc_number: vine.string().trim().maxLength(50).nullable().optional(),
    relationship_to_head: vine.enum(['Head', 'Member']).nullable().optional(),
  })
)

const linkMemberValidator = vine.compile(
  vine.object({
    existing_patient_ref: vine.string().trim().maxLength(100),
    relationship_to_head: vine.enum(['Head', 'Member']).nullable().optional(),
  })
)

const transferValidator = vine.compile(
  vine.object({
    target_household_id: vine.string().trim().maxLength(100),
    transfer_as_head: vine.boolean().optional(),
  })
)

function nullifyEmptyStrings(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? null : value
  }
  return out
}

/**
 * Staff household management. Ported from
 * App\Http\Controllers\HouseholdsController.
 *
 * Households and their patient members are resolved by a business `{ref}`
 * (barcode / household_id / numeric id) exactly like the Laravel controller.
 * DataTables JSON endpoints are collapsed into `index`/`show` which return the
 * full ordered rows for client-side tables. The `search*` methods remain JSON
 * (used by select2-style member pickers).
 *
 * NOTE (deferral): the Laravel `extractHeadPatients` dispatched a queued Bus
 * batch (ExtractHouseholdHeadPatientJob). No queue/batch system is wired in the
 * Adonis app, so extraction runs synchronously here and the status endpoint
 * reports an already-finished pseudo-batch.
 */
export default class HouseholdsController {
  private async findHouseholdByRef(ref: string) {
    return findHouseholdRowByRef(ref)
  }

  private async findPatientByRef(ref: string) {
    return findPatientRowByRef(ref)
  }

  private patientBelongsToHousehold(patientRow: any, householdRow: any): boolean {
    const patientHouseholdId = String(patientRow.household_id ?? '')
    const householdId = String(householdRow.household_id ?? '')
    if (patientHouseholdId !== '' && patientHouseholdId === householdId) return true

    const patientHead = String(patientRow.household_head_of_house ?? '').trim().toLowerCase()
    const householdHead = String(householdRow.head_of_house ?? '').trim().toLowerCase()
    return patientHead !== '' && householdHead !== '' && patientHead === householdHead
  }

  private async generateHouseholdId(): Promise<string> {
    let candidate = ''
    do {
      candidate = `HH-${DateTime.now().toFormat('yyyyLLdd')}-${String(randomInt(0, 9999)).padStart(4, '0')}`
    } while (await db.from('households').where('household_id', candidate).first())
    return candidate
  }

  private async generatePatientId(): Promise<string> {
    let candidate = ''
    do {
      candidate = TdltsBarcodeGenerator.generate('P')
    } while (await db.from('patients').where('patient_id', candidate).first())
    return candidate
  }

  /**
   * Ensure exactly one 'Head' member per household, matching the Laravel
   * rebalanceHouseholdHead(). Runs inside the provided transaction.
   */
  private async rebalanceHouseholdHead(
    trx: TransactionClientContract,
    householdId: string,
    preferredHeadDbId: number | null = null
  ): Promise<void> {
    const members = await trx
      .from('patients')
      .where('household_id', householdId)
      .orderByRaw("CASE WHEN lower(relationship_to_head) = 'head' THEN 0 ELSE 1 END")
      .orderBy('source_created_at')
      .orderBy('id')

    if (members.length === 0) {
      await trx
        .from('households')
        .where('household_id', householdId)
        .update({ head_of_house: null, updated_at: now() })
      return
    }

    let selectedHead: any = null
    if (preferredHeadDbId !== null) {
      selectedHead = members.find((m) => Number(m.id) === preferredHeadDbId) ?? null
    }
    if (!selectedHead) selectedHead = members[0]

    let headName = String(selectedHead.full_name ?? '').trim()
    if (headName === '') headName = 'Unknown'

    await trx
      .from('households')
      .where('household_id', householdId)
      .update({ head_of_house: headName, updated_at: now() })

    await trx
      .from('patients')
      .where('household_id', householdId)
      .update({ relationship_to_head: 'Member', household_head_of_house: headName, updated_at: now() })

    await trx
      .from('patients')
      .where('id', selectedHead.id)
      .update({ relationship_to_head: 'Head', updated_at: now() })
  }

  /**
   * Synchronous port of HouseholdHeadExtractionService::extractFromHouseholdRow.
   */
  private async extractHeadFromHouseholdRow(householdRow: any): Promise<ExtractionResult> {
    const householdId = String(householdRow.household_id ?? '').trim()
    const headName = String(householdRow.head_of_house ?? '').trim()

    if (householdId === '' || headName === '') {
      return { status: 'skipped', message: 'Missing household ID or head name.' }
    }

    const householdBarcode = String(householdRow.barcode ?? '').trim()
    const headLookupName = headName.toLowerCase()

    return db.transaction(async (trx) => {
      let matchingMember = await trx
        .from('patients')
        .where('household_id', householdId)
        .whereRaw('lower(trim(full_name)) = ?', [headLookupName])
        .orderByRaw("CASE WHEN lower(relationship_to_head) = 'head' THEN 0 ELSE 1 END")
        .orderBy('source_created_at')
        .orderBy('id')
        .first()

      let usedStatus: ExtractionResult['status'] = 'updated'

      if (!matchingMember) {
        const patientId = await this.generatePatientId()
        const memberDbId = await trx
          .table('patients')
          .insert({
            patient_id: patientId,
            barcode: householdBarcode !== '' ? householdBarcode : TdltsBarcodeGenerator.generate('P', patientId),
            full_name: headName,
            phone_number: String(householdRow.phone_number ?? '').trim() || null,
            nrc_number: String(householdRow.nrc_number ?? '').trim() || null,
            household_id: householdId,
            household_head_of_house: headName,
            relationship_to_head: 'Head',
            source_created_at: now(),
            created_at: now(),
            updated_at: now(),
          })
          .returning('id')

        const newId = Array.isArray(memberDbId) ? (memberDbId[0] as any)?.id ?? memberDbId[0] : memberDbId
        matchingMember = await trx.from('patients').where('id', newId).first()
        usedStatus = 'created'
      } else {
        await trx
          .from('patients')
          .where('id', matchingMember.id)
          .update({
            household_id: householdId,
            household_head_of_house: headName,
            relationship_to_head: 'Head',
            barcode: householdBarcode !== '' ? householdBarcode : matchingMember.barcode,
            updated_at: now(),
          })
      }

      await this.rebalanceHouseholdHead(trx, householdId, Number(matchingMember.id))

      if (householdBarcode !== '') {
        await trx
          .from('patients')
          .where('id', matchingMember.id)
          .update({ barcode: householdBarcode, updated_at: now() })
      }

      return { status: usedStatus, message: `Head ${headName} is now linked as a patient.` }
    })
  }

  private normalizeHousehold(row: Record<string, any>) {
    return {
      id: String(row.household_id ?? ''),
      householdId: String(row.household_id ?? ''),
      householdName: String(row.head_of_house ?? '—'),
      headOfHouseName: String(row.head_of_house ?? '—'),
      headName: String(row.head_of_house ?? '—'),
      phoneNumber: String(row.phone_number ?? ''),
      phone: String(row.phone_number ?? ''),
      village: String(row.village ?? ''),
      town: String(row.town ?? ''),
      householdType: String(row.household_type ?? ''),
      barcode: String(row.barcode ?? ''),
      subscriptionPlan: String(row.subscription_plan ?? ''),
      subscriptionFee: row.subscription_fee ?? null,
      paymentMethod: String(row.payment_method ?? ''),
      paymentStatus: String(row.payment_status ?? 'Active'),
      status: String(row.payment_status ?? 'Active'),
      transactionCode: String(row.transaction_code ?? ''),
      nrcNumber: String(row.nrc_number ?? ''),
      createdAt: row.source_created_at
        ? String(row.source_created_at)
        : row.created_at
          ? String(row.created_at)
          : null,
    }
  }

  private normalizeMember(row: Record<string, any>) {
    return {
      id: String(row.patient_id ?? ''),
      patientId: String(row.patient_id ?? ''),
      fullName: String(row.full_name ?? ''),
      gender: String(row.gender ?? ''),
      dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : null,
      phoneNumber: String(row.phone_number ?? ''),
      nrcNumber: String(row.nrc_number ?? ''),
      householdId: String(row.household_id ?? ''),
      relationshipToHead: String(row.relationship_to_head ?? 'Member'),
      barcode: String(row.barcode || row.patient_id || ''),
      status: 'Active',
    }
  }

  /**
   * GET /households — full ordered list (with head-extraction status) for the
   * client-side DataTable.
   */
  async index({ request, inertia }: HttpContext) {
    const search = String(request.qs().search ?? '').trim()

    let rows: Record<string, any>[]

    if (search === '') {
      rows = await findAllHouseholdRows()
    } else {
      const query = db.from('households')
      const like = `%${search}%`
      query.where((q) => {
        q.whereILike('household_id', like)
          .orWhereILike('barcode', like)
          .orWhereILike('head_of_house', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('village', like)
          .orWhereILike('town', like)
          .orWhereILike('payment_status', like)
      })
      rows = await query.orderBy('source_created_at', 'desc').orderBy('id', 'desc')
    }
    let households = rows.map((r) => this.normalizeHousehold(r))

    const householdIds = households.map((h) => h.householdId.trim()).filter((id) => id !== '')

    const membersByHousehold: Record<string, string[]> = {}
    if (householdIds.length > 0) {
      const patientRows = await db
        .from('patients')
        .whereIn('household_id', householdIds)
        .select('household_id', 'full_name')
      for (const row of patientRows) {
        const hid = String(row.household_id ?? '').trim()
        if (!membersByHousehold[hid]) membersByHousehold[hid] = []
        membersByHousehold[hid].push(String(row.full_name ?? '').trim().toLowerCase())
      }
    }

    households = households.map((h) => {
      const headName = h.headOfHouseName.trim()
      if (headName === '' || headName === '—') {
        return { ...h, headExtractionStatus: 'missing', headExtractionLabel: 'Missing head' }
      }
      const members = membersByHousehold[h.householdId.trim()] ?? []
      const hasExtracted = members.includes(headName.toLowerCase())
      return {
        ...h,
        headExtractionStatus: hasExtracted ? 'extracted' : 'pending',
        headExtractionLabel: hasExtracted ? 'Already extracted' : 'Not extracted',
      }
    })

    return inertia.render('households/index', {
      households,
      total: households.length,
      search,
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('households/create')
  }

  async store({ request, response, session }: HttpContext) {
    const data = await storeValidator.validate(nullifyEmptyStrings(request.all()))

    const householdId = await this.generateHouseholdId()
    const barcode = TdltsBarcodeGenerator.generate('H', householdId)

    await db.table('households').insert({
      household_id: householdId,
      head_of_house: String(data.head_of_house).trim(),
      nrc_number: data.nrc_number ?? null,
      phone_number: data.phone_number ?? null,
      village: data.village ?? null,
      town: data.town ?? null,
      household_type: data.household_type ?? null,
      barcode,
      subscription_plan: data.subscription_plan ?? null,
      subscription_fee: data.subscription_fee ?? null,
      payment_method: data.payment_method ?? null,
      payment_status: data.payment_status ?? 'Active',
      transaction_code: data.transaction_code ?? null,
      source_created_at: now(),
      created_at: now(),
      updated_at: now(),
    })

    await ReferenceDataInvalidator.invalidateHousehold({ householdId, barcode }, null)

    session.flash('success', 'Household created successfully.')
    return response.redirect().toPath(`/households/${householdId}`)
  }

  async show({ params, inertia, response, session }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const household = this.normalizeHousehold(householdRow)
    const householdId = household.householdId
    const headName = household.headOfHouseName.trim()

    let memberRows = await db
      .from('patients')
      .where('household_id', householdId)
      .orderBy('source_created_at', 'desc')
      .orderBy('id', 'desc')

    // Imported data may not have matching household_id; fall back to head name.
    if (memberRows.length === 0 && headName !== '' && headName !== '—') {
      memberRows = await db
        .from('patients')
        .where('household_head_of_house', headName)
        .orderBy('source_created_at', 'desc')
        .orderBy('id', 'desc')
    }

    const members = memberRows.map((r) => this.normalizeMember(r))

    return inertia.render('households/show', {
      household,
      members,
      membersTotal: members.length,
    })
  }

  async storeMember({ params, request, response, session }: HttpContext) {
    const ref = String(params.ref)
    const householdRow = await this.findHouseholdByRef(ref)
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const householdId = String(householdRow.household_id ?? '')
    const existingPatientRef = String(request.input('existing_patient_ref', '')).trim()

    if (existingPatientRef !== '') {
      const validated = await linkMemberValidator.validate(nullifyEmptyStrings(request.all()))
      const patientRow = await this.findPatientByRef(validated.existing_patient_ref)
      if (!patientRow) {
        session.flash('error', 'Selected patient was not found.')
        return response.redirect().toPath(`/households/${householdId}`)
      }

      const sourceHouseholdId = String(patientRow.household_id ?? '').trim()
      if (sourceHouseholdId !== '' && sourceHouseholdId.toLowerCase() === householdId.toLowerCase()) {
        session.flash('error', 'Selected patient is already linked to this household.')
        return response.redirect().toPath(`/households/${householdId}`)
      }

      const relationship = String(validated.relationship_to_head ?? 'Member')

      await db.transaction(async (trx) => {
        await trx
          .from('patients')
          .where('id', patientRow.id)
          .update({ household_id: householdId, relationship_to_head: relationship, updated_at: now() })

        if (sourceHouseholdId !== '' && sourceHouseholdId.toLowerCase() !== householdId.toLowerCase()) {
          await this.rebalanceHouseholdHead(trx, sourceHouseholdId)
        }
        await this.rebalanceHouseholdHead(
          trx,
          householdId,
          relationship === 'Head' ? Number(patientRow.id) : null
        )
      })

      await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()

      session.flash('success', 'Patient linked to household successfully.')
      return response.redirect().toPath(`/households/${householdId}`)
    }

    const validated = await memberValidator.validate(nullifyEmptyStrings(request.all()))
    const relationship = String(validated.relationship_to_head ?? 'Member')

    await db.transaction(async (trx) => {
      const patientId = await this.generatePatientId()
      const inserted = await trx
        .table('patients')
        .insert({
          patient_id: patientId,
          barcode: TdltsBarcodeGenerator.generate('P', patientId),
          full_name: String(validated.full_name).trim(),
          gender: validated.gender ?? null,
          date_of_birth: validated.date_of_birth ?? null,
          phone_number: validated.phone_number ?? null,
          nrc_number: validated.nrc_number ?? null,
          household_id: householdId,
          relationship_to_head: relationship,
          created_at: now(),
          updated_at: now(),
        })
        .returning('id')

      const memberDbId = Array.isArray(inserted) ? (inserted[0] as any)?.id ?? inserted[0] : inserted
      await this.rebalanceHouseholdHead(
        trx,
        householdId,
        relationship === 'Head' ? Number(memberDbId) : null
      )
    })

    await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()

    session.flash('success', 'Household member added successfully.')
    return response.redirect().toPath(`/households/${householdId}`)
  }

  async updateMember({ params, request, response, session }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const householdId = String(householdRow.household_id ?? '')
    const patientRow = await this.findPatientByRef(String(params.patientRef))
    if (!patientRow || !this.patientBelongsToHousehold(patientRow, householdRow)) {
      session.flash('error', 'Selected member was not found in this household.')
      return response.redirect().toPath(`/households/${householdId}`)
    }

    const validated = await memberValidator.validate(nullifyEmptyStrings(request.all()))
    const relationship = String(
      validated.relationship_to_head ?? (patientRow.relationship_to_head || 'Member')
    )

    await db.transaction(async (trx) => {
      await trx
        .from('patients')
        .where('id', patientRow.id)
        .update({
          full_name: String(validated.full_name).trim(),
          gender: validated.gender ?? null,
          date_of_birth: validated.date_of_birth ?? null,
          phone_number: validated.phone_number ?? null,
          nrc_number: validated.nrc_number ?? null,
          household_id: householdId,
          relationship_to_head: relationship,
          updated_at: now(),
        })

      await this.rebalanceHouseholdHead(
        trx,
        householdId,
        relationship === 'Head' ? Number(patientRow.id) : null
      )
    })

    await ReferenceDataInvalidator.patientChangedFromRow(patientRow)

    session.flash('success', 'Household member updated successfully.')
    return response.redirect().toPath(`/households/${householdId}`)
  }

  async setMemberAsHead({ params, response, session }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const householdId = String(householdRow.household_id ?? '')
    const patientRow = await this.findPatientByRef(String(params.patientRef))
    if (!patientRow || !this.patientBelongsToHousehold(patientRow, householdRow)) {
      session.flash('error', 'Selected member was not found in this household.')
      return response.redirect().toPath(`/households/${householdId}`)
    }

    await db.transaction(async (trx) => {
      await trx
        .from('patients')
        .where('id', patientRow.id)
        .update({ household_id: householdId, updated_at: now() })
      await this.rebalanceHouseholdHead(trx, householdId, Number(patientRow.id))
    })

    await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()

    session.flash('success', 'Head of house updated successfully.')
    return response.redirect().toPath(`/households/${householdId}`)
  }

  async removeMember({ params, response, session }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const householdId = String(householdRow.household_id ?? '')
    const patientRow = await this.findPatientByRef(String(params.patientRef))
    if (!patientRow || !this.patientBelongsToHousehold(patientRow, householdRow)) {
      session.flash('error', 'Selected member was not found in this household.')
      return response.redirect().toPath(`/households/${householdId}`)
    }

    await db.transaction(async (trx) => {
      await trx
        .from('patients')
        .where('id', patientRow.id)
        .update({
          household_id: null,
          relationship_to_head: null,
          household_head_of_house: null,
          updated_at: now(),
        })
      await this.rebalanceHouseholdHead(trx, householdId)
    })

    await ReferenceDataInvalidator.patientChangedFromRow(patientRow)

    session.flash('success', 'Member removed from household successfully.')
    return response.redirect().toPath(`/households/${householdId}`)
  }

  async transferMember({ params, request, response, session }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const sourceHouseholdId = String(householdRow.household_id ?? '')
    const patientRow = await this.findPatientByRef(String(params.patientRef))
    if (!patientRow || !this.patientBelongsToHousehold(patientRow, householdRow)) {
      session.flash('error', 'Selected member was not found in this household.')
      return response.redirect().toPath(`/households/${sourceHouseholdId}`)
    }

    const validated = await transferValidator.validate(nullifyEmptyStrings(request.all()))
    const targetHouseholdId = String(validated.target_household_id).trim()

    if (sourceHouseholdId.toLowerCase() === targetHouseholdId.toLowerCase()) {
      session.flash('error', 'Target household must be different from the current household.')
      return response.redirect().toPath(`/households/${sourceHouseholdId}`)
    }

    const targetHousehold = await db.from('households').where('household_id', targetHouseholdId).first()
    if (!targetHousehold) {
      session.flash('error', 'Target household was not found.')
      return response.redirect().toPath(`/households/${sourceHouseholdId}`)
    }

    const asHead = Boolean(validated.transfer_as_head)

    await db.transaction(async (trx) => {
      await trx
        .from('patients')
        .where('id', patientRow.id)
        .update({
          household_id: targetHouseholdId,
          relationship_to_head: asHead ? 'Head' : 'Member',
          updated_at: now(),
        })
      await this.rebalanceHouseholdHead(trx, sourceHouseholdId)
      await this.rebalanceHouseholdHead(trx, targetHouseholdId, asHead ? Number(patientRow.id) : null)
    })

    await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()

    session.flash('success', 'Member transferred successfully.')
    return response.redirect().toPath(`/households/${sourceHouseholdId}`)
  }

  async extractHeadPatient({ params, response, session }: HttpContext) {
    const ref = String(params.ref)
    const householdRow = await this.findHouseholdByRef(ref)
    if (!householdRow) {
      session.flash('error', 'Household details were not found for the selected row.')
      return response.redirect().toPath('/households')
    }

    const result = await this.extractHeadFromHouseholdRow(householdRow)
    await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()
    const target = `/households/${String(householdRow.household_id ?? ref)}`

    if (result.status === 'skipped') {
      session.flash('error', result.message)
    } else {
      session.flash('success', result.message)
    }
    return response.redirect().toPath(target)
  }

  /**
   * POST /households/extract-head-patients
   *
   * Synchronous batch: iterates matching households and extracts each head. The
   * Laravel version dispatched a queued Bus batch; here it completes inline and
   * reports a finished pseudo-batch for the status poller.
   */
  async extractHeadPatients({ request, response, session }: HttpContext) {
    const search = String(request.input('search', '')).trim()

    const query = db.from('households')
    if (search !== '') {
      const like = `%${search}%`
      query.where((q) => {
        q.whereILike('household_id', like)
          .orWhereILike('barcode', like)
          .orWhereILike('head_of_house', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('village', like)
          .orWhereILike('town', like)
          .orWhereILike('payment_status', like)
      })
    }

    const rows = await query
      .orderBy('source_created_at', 'desc')
      .orderBy('id', 'desc')
      .select('id', 'household_id', 'head_of_house', 'barcode', 'phone_number', 'nrc_number')

    const targets = rows.filter((r) => String(r.household_id ?? '').trim() !== '')

    if (targets.length === 0) {
      const message = 'No matching households found for extraction.'
      if (request.accepts(['json'])) {
        return response.unprocessableEntity({ message })
      }
      session.flash('error', message)
      return response.redirect().toPath('/households')
    }

    let processed = 0
    let failed = 0
    for (const row of targets) {
      try {
        await this.extractHeadFromHouseholdRow(row)
      } catch {
        failed++
      }
      processed++
    }

    const batchId = `sync-${Date.now()}`

    await ReferenceDataInvalidator.invalidatePatientsAndHouseholds()

    if (request.accepts(['json'])) {
      return response.json({
        batchId,
        totalJobs: targets.length,
        pendingJobs: 0,
        processedJobs: processed,
        failedJobs: failed,
        progress: 100,
        finished: true,
        message: 'Extraction completed.',
      })
    }

    session.flash('success', `Head extraction completed for ${processed} household(s).`)
    return response.redirect().toPath('/households')
  }

  /**
   * GET /households/extract-head-patients/{batchId}/status
   *
   * Extraction is synchronous, so any batch id is reported as finished.
   */
  async extractHeadPatientsStatus({ params, response }: HttpContext) {
    return response.json({
      batchId: String(params.batchId),
      name: 'Household Head Extraction',
      totalJobs: 0,
      processedJobs: 0,
      pendingJobs: 0,
      failedJobs: 0,
      progress: 100,
      finished: true,
      cancelled: false,
    })
  }

  async printBarcodes({ request, inertia }: HttpContext) {
    const search = String(request.qs().search ?? '').trim()

    const query = db.from('households').orderBy('head_of_house').orderBy('household_id')
    if (search !== '') {
      const like = `%${search}%`
      query.where((q) => {
        q.whereILike('household_id', like)
          .orWhereILike('barcode', like)
          .orWhereILike('head_of_house', like)
          .orWhereILike('village', like)
      })
    }

    const rows = await query
    const households = rows.map((r) => this.normalizeHousehold(r))

    return inertia.render('households/barcodes', { households, search })
  }

  /**
   * GET /households/{ref}/patients/search — JSON member picker.
   */
  async searchPatients({ params, request, response }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) return response.json({ results: [] })

    const query = String(request.input('q', '')).trim()
    if (query === '') return response.json({ results: [] })

    const like = `%${query}%`
    const currentHouseholdId = String(householdRow.household_id ?? '').trim()

    const patients = await db
      .from('patients')
      .select('id', 'patient_id', 'barcode', 'full_name', 'phone_number', 'household_id')
      .where((builder) => {
        builder
          .whereILike('patient_id', like)
          .orWhereILike('barcode', like)
          .orWhereILike('full_name', like)
          .orWhereILike('phone_number', like)
          .orWhereILike('nrc_number', like)
      })
      .orderBy('full_name')
      .limit(8)

    return response.json({
      results: patients.map((patient) => {
        const patientId = String(patient.patient_id || patient.barcode || patient.id)
        const name = String(patient.full_name ?? 'Unknown patient').trim()
        const phone = String(patient.phone_number ?? '').trim()
        const alreadyInCurrent =
          currentHouseholdId !== '' &&
          String(patient.household_id ?? '').trim().toLowerCase() === currentHouseholdId.toLowerCase()

        const parts = [patientId, name]
        if (phone !== '') parts.push(phone)
        if (alreadyInCurrent) parts.push('already in this household')

        return { id: patientId, text: parts.join(' • '), disabled: alreadyInCurrent }
      }),
    })
  }

  /**
   * GET /households/{ref}/transfer-households/search — JSON household picker.
   */
  async searchTransferHouseholds({ params, request, response }: HttpContext) {
    const householdRow = await this.findHouseholdByRef(String(params.ref))
    if (!householdRow) return response.json({ results: [] })

    const query = String(request.input('q', '')).trim()
    const currentHouseholdId = String(householdRow.household_id ?? '')

    const builder = db
      .from('households')
      .select('household_id', 'head_of_house')
      .whereNot('household_id', currentHouseholdId)

    if (query !== '') {
      const like = `%${query}%`
      builder.where((b) => {
        b.whereILike('household_id', like).orWhereILike('head_of_house', like)
      })
    }

    const households = await builder.orderBy('head_of_house').orderBy('household_id').limit(4)

    return response.json({
      results: households.map((household) => ({
        id: String(household.household_id ?? ''),
        text: `${String(household.household_id ?? '')} - ${String(household.head_of_house ?? '') || 'No head set'}`,
      })),
    })
  }
}
