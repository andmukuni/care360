import { DateTime } from 'luxon'
import Household from '#models/household'
import Patient from '#models/patient'

/**
 * Household membership rules used by the patient portal dependent resolver.
 *
 * Ported from App\Services\Households\HouseholdMemberService.
 *
 * PORT-GAP: in Laravel this lives under App\Services\Households. It is placed here
 * under services/portal/ because this port may only create files under
 * app/services/portal/**. Ideally it belongs at app/services/households/.
 */
export default class HouseholdMemberService {
  /** Household heads may only view health records for members at or below this age. */
  static readonly MAX_VIEWABLE_MEMBER_AGE = 16

  async membersInSameHousehold(patient: Patient): Promise<Patient[]> {
    const householdId = String(patient.householdId ?? '').trim()

    if (householdId === '') {
      return []
    }

    return Patient.query()
      .where('householdId', householdId)
      .whereNot('id', patient.id)
      .where((query) => {
        query.where('isDeceased', false).orWhereNull('isDeceased')
      })
      .orderByRaw("CASE WHEN LOWER(COALESCE(relationship_to_head, '')) = 'head' THEN 0 ELSE 1 END")
      .orderBy('fullName')
  }

  async isHouseholdHead(patient: Patient): Promise<boolean> {
    if (String(patient.relationshipToHead ?? '').trim().toLowerCase() === 'head') {
      return true
    }

    const householdId = String(patient.householdId ?? '').trim()

    if (householdId === '') {
      return false
    }

    const row = await Household.query().where('householdId', householdId).first()

    if (!row) {
      return false
    }

    const headName = String(row.headOfHouse ?? '').trim().toLowerCase()
    const patientName = String(patient.fullName ?? '').trim().toLowerCase()

    return headName !== '' && headName === patientName
  }

  async canManageHouseholdMembers(patient: Patient): Promise<boolean> {
    return this.isHouseholdHead(patient)
  }

  /**
   * Whether a household head may view this member's health records (minors only).
   */
  householdMemberRecordsViewableByHead(member: Patient): boolean {
    if (member.isDeceased) {
      return false
    }

    const age = this.ageInYears(member.dateOfBirth)

    if (age === null) {
      return true
    }

    return age <= HouseholdMemberService.MAX_VIEWABLE_MEMBER_AGE
  }

  async canHouseholdHeadViewMemberRecords(guardian: Patient, member: Patient): Promise<boolean> {
    if (!(await this.canManageHouseholdMembers(guardian))) {
      return false
    }

    if (Number(guardian.id) === Number(member.id)) {
      return true
    }

    if (
      String(guardian.householdId ?? '').trim() === '' ||
      String(member.householdId ?? '').trim() === '' ||
      guardian.householdId !== member.householdId
    ) {
      return false
    }

    return this.householdMemberRecordsViewableByHead(member)
  }

  private ageInYears(dob: DateTime | null): number | null {
    if (!dob) {
      return null
    }

    return Math.floor(DateTime.now().diff(dob, 'years').years)
  }
}
