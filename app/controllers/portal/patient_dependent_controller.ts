import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import Household from '#models/household'
import Patient from '#models/patient'
import PatientDependent from '#models/patient_dependent'
import HouseholdMemberService from '#services/portal/household_member_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'

/**
 * Patient portal dependents / household members. Ported from
 * App\Http\Controllers\Portal\PatientDependentController.
 *
 * PORT-GAP: App\Services\Households\HouseholdMemberService lives at
 * app/services/portal/household_member_service.ts in this port, and the Laravel
 * App\Support\Households\PatientHouseholdPresenter has no AdonisJS equivalent, so
 * its household summary logic is inlined below (householdSummary()). The Laravel
 * PatientDependent model's `dependent` (belongsTo Patient) relation is not
 * declared on the Lucid model, so dependent patients are resolved via
 * PatientDependentResolver.resolveDependents().
 */
const HEAD_VIEWABLE_MAX_AGE = HouseholdMemberService.MAX_VIEWABLE_MEMBER_AGE

const storeValidator = vine.compile(
  vine.object({
    patient_id: vine.string().trim().maxLength(50),
    relationship: vine.string().trim().maxLength(50),
    verification: vine.string().trim().maxLength(50),
  })
)

interface HouseholdSummary {
  household_id: string
  head_of_house: string | null
  relationship_to_head: string | null
  role_label: string | null
  village: string | null
  town: string | null
  location_label: string | null
  display_label: string
}

export default class PatientDependentController {
  private readonly dependentResolver = new PatientDependentResolver()
  private readonly householdMembers = new HouseholdMemberService()

  private guardian(ctx: HttpContext): Patient {
    return ctx.auth.use('patient').user!
  }

  private subjectPatient(ctx: HttpContext): Promise<Patient> {
    return this.dependentResolver.viewingPatient(this.guardian(ctx), ctx.session)
  }

  async index(ctx: HttpContext) {
    const { inertia } = ctx
    const guardian = this.guardian(ctx)

    const links = await this.dependentResolver.allDependentLinks(guardian)
    const dependentMap = await this.dependentResolver.resolveDependents(links)
    const viewingPatient = await this.subjectPatient(ctx)
    const guardianHousehold = await this.householdSummary(guardian)
    const members = await this.householdMembers.membersInSameHousehold(guardian)
    const isHouseholdHead = await this.householdMembers.canManageHouseholdMembers(guardian)

    const householdMembers = await Promise.all(
      members.map(async (member) => {
        const canView = isHouseholdHead && this.householdMembers.householdMemberRecordsViewableByHead(member)
        const age = this.ageInYears(member.dateOfBirth)
        const ageRestricted =
          isHouseholdHead && !canView && age !== null && age > HEAD_VIEWABLE_MAX_AGE

        return {
          id: member.id,
          full_name: member.fullName,
          patient_id: member.patientId,
          relationship_to_head: member.relationshipToHead,
          age,
          household: await this.householdSummary(member),
          can_view: canView,
          age_restricted: ageRestricted,
          is_viewing: viewingPatient.id === member.id,
        }
      })
    )

    const dependents = await Promise.all(
      links
        .map((link) => ({ link, dependent: dependentMap.get(link.dependentPatientId) ?? null }))
        .filter((entry) => entry.dependent !== null)
        .map(async ({ link, dependent }) => {
          const dep = dependent as Patient

          return {
            id: link.id,
            relationship: link.relationship,
            can_view_records: link.canViewRecords,
            dependent: {
              id: dep.id,
              full_name: dep.fullName,
              patient_id: dep.patientId,
            },
            household: await this.householdSummary(dep),
            same_household: this.sameHousehold(guardian, dep),
            is_viewing: viewingPatient.id === dep.id,
          }
        })
    )

    return inertia.render('portal/dependents/index', {
      guardian: {
        id: guardian.id,
        full_name: guardian.fullName,
        patient_id: guardian.patientId,
      },
      viewingPatient: { id: viewingPatient.id, full_name: viewingPatient.fullName },
      guardianHousehold,
      householdMembers,
      dependents,
      isHouseholdHead,
    })
  }

  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const guardian = this.guardian(ctx)

    const validated = await request.validateUsing(storeValidator)

    const dependent = await Patient.query().where('patientId', validated.patient_id).first()

    if (!dependent) {
      session.flashErrors({ patient_id: 'No patient was found with that Patient ID.' })
      session.flashAll()

      return response.redirect().back()
    }

    if (Number(dependent.id) === Number(guardian.id)) {
      session.flashErrors({ patient_id: 'You cannot add yourself as a dependent.' })
      session.flashAll()

      return response.redirect().back()
    }

    const supplied = validated.verification.trim().toLowerCase()
    const nrc = (dependent.nrcNumber ?? '').trim().toLowerCase()
    const matchesNrc = nrc !== '' && supplied === nrc

    let matchesDob = false
    if (dependent.dateOfBirth) {
      const parsed = DateTime.fromISO(validated.verification)
      matchesDob = parsed.isValid && parsed.toISODate() === dependent.dateOfBirth.toISODate()
    }

    if (!matchesNrc && !matchesDob) {
      session.flashErrors({
        verification: 'The NRC or date of birth does not match our records for that Patient ID.',
      })
      session.flashAll()

      return response.redirect().back()
    }

    const existing = await PatientDependent.query()
      .where('guardianPatientId', guardian.id)
      .where('dependentPatientId', dependent.id)
      .first()

    if (existing) {
      session.flash('error', 'You have already added this dependent.')

      return response.redirect().back()
    }

    await PatientDependent.create({
      guardianPatientId: guardian.id,
      dependentPatientId: dependent.id,
      relationship: validated.relationship,
      canViewRecords: false,
      canBookAppointments: false,
      authorizedAt: null,
      authorizedBy: null,
    })

    session.flash('success', 'Dependent request submitted. The hospital will review and approve access.')

    return response.redirect().back()
  }

  async switch(ctx: HttpContext) {
    const { params, response, session } = ctx
    const guardian = this.guardian(ctx)

    const dependent = await Patient.findOrFail(params.dependent)
    await this.dependentResolver.switchTo(guardian, dependent, session)

    session.flash('success', `Now viewing records for ${dependent.fullName}.`)

    return response.redirect('/portal')
  }

  async clear(ctx: HttpContext) {
    const { response, session } = ctx

    this.dependentResolver.clearContext(session)

    session.flash('success', 'Viewing your own records.')

    return response.redirect('/portal')
  }

  // ── inlined PatientHouseholdPresenter ────────────────────────────────────

  private async householdSummary(patient: Patient): Promise<HouseholdSummary | null> {
    const householdId = String(patient.householdId ?? '').trim()
    if (householdId === '') {
      return null
    }

    const row = await Household.query().where('householdId', householdId).first()

    const headOfHouse = String(row?.headOfHouse ?? patient.householdHeadOfHouse ?? '').trim()
    const village = String(row?.village ?? '').trim()
    const town = String(row?.town ?? '').trim()
    const relationship = String(patient.relationshipToHead ?? '').trim()

    return {
      household_id: householdId,
      head_of_house: headOfHouse !== '' ? headOfHouse : null,
      relationship_to_head: relationship !== '' ? relationship : null,
      role_label: this.roleLabel(relationship),
      village: village !== '' ? village : null,
      town: town !== '' ? town : null,
      location_label: this.locationLabel(village, town),
      display_label: this.displayLabel(householdId, headOfHouse, relationship),
    }
  }

  private sameHousehold(a: Patient, b: Patient): boolean {
    const householdA = String(a.householdId ?? '').trim()
    const householdB = String(b.householdId ?? '').trim()

    return householdA !== '' && householdA === householdB
  }

  private roleLabel(relationship: string): string | null {
    switch (relationship.trim().toLowerCase()) {
      case 'head':
        return 'Head of household'
      case 'member':
        return 'Household member'
      default:
        return relationship !== '' ? relationship : null
    }
  }

  private locationLabel(village: string, town: string): string | null {
    const parts = [village, town].filter((part) => part !== '')

    return parts.length > 0 ? parts.join(', ') : null
  }

  private displayLabel(householdId: string, headOfHouse: string, relationship: string): string {
    const role = this.roleLabel(relationship)
    const parts = [
      householdId,
      headOfHouse !== '' ? `Head: ${headOfHouse}` : null,
      role,
    ].filter((part): part is string => Boolean(part))

    return parts.join(' · ')
  }

  private ageInYears(dob: DateTime | null): number | null {
    if (!dob) {
      return null
    }

    return Math.floor(DateTime.now().diff(dob, 'years').years)
  }
}
