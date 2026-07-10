import Patient from '#models/patient'

/**
 * Searches for an existing patient using multiple identifiers.
 * Returns matching Patient records. Does NOT create patients.
 * Ported from App\Actions\Encounter\SearchPatientAction.
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
      const exactBuilder = Patient.query()
      if (normalizedSex) {
        exactBuilder.whereRaw('LOWER(gender) = ?', [normalizedSex])
      }

      const exactMatches = await exactBuilder
        .where((sub) => {
          sub.where('patient_id', q).orWhere('barcode', q)
          if (q.includes('/')) {
            sub.orWhere('nrc_number', q)
          }
        })
        .limit(20)

      if (exactMatches.length > 0) {
        return exactMatches
      }
    }

    return builder
      .where((sub) => {
        sub
          .where('patient_id', q)
          .orWhere('barcode', q)
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
}
