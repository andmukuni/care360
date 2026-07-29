import Patient from '#models/patient'
import { findHouseholdRowByRef, findPatientRowByRef } from '#support/ref_resolvers'

/**
 * Searches for an existing patient using multiple identifiers.
 * Returns matching Patient records. Does NOT create patients.
 * Ported from App\Actions\Encounter\SearchPatientAction.
 *
 * Barcode matching is case-insensitive. If a scanned code matches a household
 * barcode but not a patient row directly, we resolve the household head patient
 * so registration desk scans keep working after (or without) exact head barcode sync.
 */
export default class SearchPatientAction {
  async handle(
    query: string,
    dateOfBirth: string | null = null,
    sex: string | null = null
  ): Promise<Patient[]> {
    const q = query.trim()
    const nameTokens = q.split(/\s+/).filter((t) => t.length > 0)
    const normalizedSex = sex ? sex.trim().toLowerCase() : null

    const builder = Patient.query()

    if (normalizedSex) {
      builder.whereRaw('LOWER(gender) = ?', [normalizedSex])
    }

    if (dateOfBirth) {
      // Name + DOB search — narrow match
      return builder
        .where('date_of_birth', dateOfBirth)
        .where((sub) => {
          sub
            .where('full_name', 'like', `%${q}%`)
            .orWhere((nameSub) => {
              for (const token of nameTokens) {
                nameSub.where('full_name', 'like', `%${token}%`)
              }
            })
            .orWhere('patient_id', q)
        })
        .limit(20)
    }

    if (!q.includes(' ')) {
      const cachedRow = await findPatientRowByRef(q)
      if (cachedRow) {
        const patient = await Patient.find(Number(cachedRow.id))
        if (patient) {
          if (normalizedSex && patient.gender?.toLowerCase() !== normalizedSex) {
            return []
          }
          return [patient]
        }
      }

      const exactBuilder = Patient.query()
      if (normalizedSex) {
        exactBuilder.whereRaw('LOWER(gender) = ?', [normalizedSex])
      }

      const exactMatches = await exactBuilder
        .where((sub) => {
          sub.whereILike('patient_id', q).orWhereILike('barcode', q)
          if (q.includes('/')) {
            sub.orWhere('nrc_number', q)
          }
        })
        .limit(20)

      if (exactMatches.length > 0) {
        return exactMatches
      }

      // Household barcode → head patient fallback (covers case/sync gaps)
      const fromHousehold = await this.resolveHeadFromHouseholdBarcode(q, normalizedSex)
      if (fromHousehold) {
        return [fromHousehold]
      }
    }

    return builder
      .where((sub) => {
        sub
          .whereILike('patient_id', q)
          .orWhereILike('barcode', q)
          .orWhere('nrc_number', 'like', `%${q}%`)
          .orWhere('phone_number', 'like', `%${q}%`)
          .orWhere('other_cellphone', 'like', `%${q}%`)
          .orWhere('landline', 'like', `%${q}%`)
          .orWhere('art_number', 'like', `%${q}%`)
          .orWhere('nupn', 'like', `%${q}%`)
          .orWhere('full_name', 'like', `%${q}%`)
          .orWhere((nameSub) => {
            for (const token of nameTokens) {
              nameSub.where('full_name', 'like', `%${token}%`)
            }
          })
      })
      .limit(20)
  }

  private async resolveHeadFromHouseholdBarcode(
    barcode: string,
    normalizedSex: string | null
  ): Promise<Patient | null> {
    const household = await findHouseholdRowByRef(barcode)
    const householdId = String(household?.household_id ?? '').trim()
    if (!householdId) return null

    const headQuery = Patient.query()
      .where('household_id', householdId)
      .whereRaw("LOWER(COALESCE(relationship_to_head, '')) = ?", ['head'])
      .orderBy('id', 'asc')

    if (normalizedSex) {
      headQuery.whereRaw('LOWER(gender) = ?', [normalizedSex])
    }

    const head = await headQuery.first()
    if (head) return head

    // Last resort: any patient linked to the household
    const anyMember = Patient.query().where('household_id', householdId).orderBy('id', 'asc')
    if (normalizedSex) {
      anyMember.whereRaw('LOWER(gender) = ?', [normalizedSex])
    }
    return anyMember.first()
  }
}
