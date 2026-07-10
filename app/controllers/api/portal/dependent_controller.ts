import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import Patient from '#models/patient'
import PatientDependent from '#models/patient_dependent'
import HouseholdMemberService from '#services/portal/household_member_service'
import PatientDependentResolver from '#services/portal/patient_dependent_resolver'
import { ageFromDob, patientHousehold, patientResource, sameHousehold } from './auth_controller.js'
import { subjectPatient } from './lab_controller.js'

/**
 * Dependent / household management. Ported from
 * App\Http\Controllers\Api\Portal\DependentController.
 */
const storeValidator = vine.compile(
  vine.object({
    patient_id: vine.string().trim().maxLength(50),
    relationship: vine.string().trim().maxLength(50),
    verification: vine.string().trim().maxLength(50),
  })
)

export default class DependentController {
  private readonly dependentResolver = new PatientDependentResolver()
  private readonly householdMembers = new HouseholdMemberService()

  async index(ctx: HttpContext) {
    const guardian = ctx.auth.use('patient_api').user as Patient
    const subject = await subjectPatient(ctx, this.dependentResolver)

    const canManageHousehold = await this.householdMembers.canManageHouseholdMembers(guardian)
    const householdMemberRows = await this.householdMembers.membersInSameHousehold(guardian)

    const links = await this.dependentResolver.allDependentLinks(guardian)
    const dependents = await this.dependentResolver.resolveDependents(links)

    return ctx.response.ok({
      guardian: await patientResource(guardian),
      viewing_patient: await patientResource(subject),
      viewing_dependent: Number(subject.id) !== Number(guardian.id),
      is_household_head: canManageHousehold,
      household_members: await Promise.all(
        householdMemberRows.map((member) =>
          this.householdMemberResource(member, guardian, canManageHousehold, canManageHousehold)
        )
      ),
      dependents: await Promise.all(
        links.map((link) =>
          this.patientDependentResource(link, dependents.get(link.dependentPatientId) ?? null, guardian)
        )
      ),
    })
  }

  async store(ctx: HttpContext) {
    const guardian = ctx.auth.use('patient_api').user as Patient
    const validated = await ctx.request.validateUsing(storeValidator)

    const dependent = await Patient.query().where('patientId', validated.patient_id).first()

    if (!dependent) {
      return ctx.response.unprocessableEntity({
        errors: { patient_id: ['No patient was found with that Patient ID.'] },
      })
    }

    if (Number(dependent.id) === Number(guardian.id)) {
      return ctx.response.unprocessableEntity({
        errors: { patient_id: ['You cannot add yourself as a dependent.'] },
      })
    }

    const supplied = validated.verification.trim().toLowerCase()
    const nrc = String(dependent.nrcNumber ?? '').trim().toLowerCase()
    const matchesNrc = nrc !== '' && supplied === nrc

    let matchesDob = false
    if (dependent.dateOfBirth) {
      const parsed = DateTime.fromISO(validated.verification)
      matchesDob = parsed.isValid && parsed.toISODate() === dependent.dateOfBirth.toISODate()
    }

    if (!matchesNrc && !matchesDob) {
      return ctx.response.unprocessableEntity({
        errors: {
          verification: ['The NRC or date of birth does not match our records for that Patient ID.'],
        },
      })
    }

    const alreadyLinked = await PatientDependent.query()
      .where('guardianPatientId', guardian.id)
      .where('dependentPatientId', dependent.id)
      .first()

    if (alreadyLinked) {
      return ctx.response.unprocessableEntity({
        errors: { patient_id: ['You have already added this dependent.'] },
      })
    }

    const link = await PatientDependent.create({
      guardianPatientId: guardian.id,
      dependentPatientId: dependent.id,
      relationship: validated.relationship,
      canViewRecords: false,
      canBookAppointments: false,
      authorizedAt: null,
      authorizedBy: null,
    })

    return ctx.response.created({
      message: 'Dependent request submitted. The hospital will review and approve access.',
      dependent: await this.patientDependentResource(link, dependent, guardian),
    })
  }

  async switch(ctx: HttpContext) {
    const guardian = ctx.auth.use('patient_api').user as Patient
    const dependent = await Patient.findOrFail(ctx.params.dependent)
    const tokenId = currentTokenId(guardian)

    if (tokenId !== null) {
      await this.dependentResolver.switchToForApi(guardian, dependent, tokenId)
    } else {
      await this.dependentResolver.switchTo(guardian, dependent, ctx.session)
    }

    return ctx.response.ok({
      message: `Now viewing records for ${dependent.fullName}.`,
      viewing_patient: await patientResource(dependent),
      viewing_dependent: true,
    })
  }

  async clear(ctx: HttpContext) {
    const guardian = ctx.auth.use('patient_api').user as Patient
    const tokenId = currentTokenId(guardian)

    if (tokenId !== null) {
      this.dependentResolver.clearApiContext(tokenId)
    } else {
      this.dependentResolver.clearContext(ctx.session)
    }

    return ctx.response.ok({
      message: 'Viewing your own records.',
      viewing_patient: await patientResource(guardian),
      viewing_dependent: false,
    })
  }

  /** Reproduces App\Http\Resources\Portal\PatientDependentResource. */
  private async patientDependentResource(
    link: PatientDependent,
    dependent: Patient | null,
    guardian: Patient
  ): Promise<Record<string, unknown>> {
    const household = dependent ? await patientHousehold(dependent) : null

    return {
      id: link.id,
      relationship: link.relationship,
      can_view_records: Boolean(link.canViewRecords),
      can_book_appointments: Boolean(link.canBookAppointments),
      authorized_at: link.authorizedAt ? link.authorizedAt.toISO() : null,
      status: link.canViewRecords ? 'approved' : 'pending',
      same_household_as_guardian: sameHousehold(guardian, dependent),
      household,
      dependent: dependent
        ? {
            id: dependent.id,
            patient_number: dependent.patientId,
            full_name: dependent.fullName,
            gender: dependent.gender,
            household,
          }
        : null,
    }
  }

  /** Reproduces App\Http\Resources\Portal\HouseholdMemberResource. */
  private async householdMemberResource(
    member: Patient,
    guardian: Patient,
    isHead: boolean,
    canBook: boolean
  ): Promise<Record<string, unknown>> {
    const household = await patientHousehold(member)
    const canView = isHead && this.householdMembers.householdMemberRecordsViewableByHead(member)
    const age = ageFromDob(member.dateOfBirth)

    return {
      id: member.id,
      patient_number: member.patientId,
      full_name: member.fullName,
      gender: member.gender,
      age,
      relationship_to_head: member.relationshipToHead,
      role_label: (household?.role_label as string | null | undefined) ?? null,
      source: 'household',
      can_view_records: canView,
      records_restricted_reason:
        isHead && !canView
          ? age !== null && age > HouseholdMemberService.MAX_VIEWABLE_MEMBER_AGE
            ? 'age_limit'
            : null
          : null,
      can_book_appointments: canBook,
      household,
      same_household_as_guardian: sameHousehold(guardian, member),
    }
  }
}

function currentTokenId(guardian: Patient): number | null {
  return guardian.currentAccessToken ? Number(guardian.currentAccessToken.identifier) : null
}
