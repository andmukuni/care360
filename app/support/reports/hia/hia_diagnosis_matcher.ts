import type { HiaCatalogueEntry } from './hia_catalogue.js'
import MedicalDictionaryTerm from '#models/medical_dictionary_term'

/**
 * Maps screening diagnosis payloads to HIA catalogue ICD codes.
 * Ported from App\Support\Reports\Hia\HiaDiagnosisMatcher.
 * Also consults medical_dictionary_terms.hia_code when present.
 */
export class HiaDiagnosisMatcher {
  private readonly codeIndex: Map<string, string> = new Map()
  private readonly nameIndex: Map<string, string> = new Map()

  constructor(catalogue: HiaCatalogueEntry[]) {
    for (const entry of catalogue) {
      const code = this.normalizeCode(entry.code)
      if (code !== '') {
        this.codeIndex.set(code, entry.code)
      }
      const nameKey = this.normalizeName(entry.name)
      if (nameKey !== '') {
        this.nameIndex.set(nameKey, entry.code)
      }
    }
  }

  parseDiagnosis(raw: string | null | undefined): { text: string; icd11: string } {
    const value = String(raw ?? '').trim()
    if (value === '') {
      return { text: '', icd11: '' }
    }

    let decoded: any = null
    try {
      decoded = JSON.parse(value)
    } catch {
      decoded = null
    }

    if (decoded && typeof decoded === 'object') {
      const icd11 = String(decoded.icd11 ?? '').trim()
      const path = decoded.path ?? decoded.level3 ?? decoded.level2 ?? decoded.level1 ?? null
      if (typeof path === 'string' && path !== '') {
        return { text: path, icd11 }
      }
      if (icd11 !== '') {
        return { text: value, icd11 }
      }
    }

    return { text: value, icd11: '' }
  }

  async matchCode(rawDiagnosis: string | null | undefined): Promise<string | null> {
    const parsed = this.parseDiagnosis(rawDiagnosis)
    const icd = this.normalizeCode(parsed.icd11)
    if (icd !== '') {
      if (this.codeIndex.has(icd)) {
        return this.codeIndex.get(icd)!
      }
      for (const [norm, canonical] of this.codeIndex) {
        if (icd.startsWith(norm) || norm.startsWith(icd)) {
          return canonical
        }
      }
    }

    const textKey = this.normalizeName(parsed.text)
    if (textKey !== '' && this.nameIndex.has(textKey)) {
      return this.nameIndex.get(textKey)!
    }

    // Dictionary crosswalk: prefer explicit hia_code on matching diagnosis terms.
    try {
      if (textKey !== '' || icd !== '') {
        const term = await MedicalDictionaryTerm.query()
          .where('domain', 'diagnosis')
          .where('is_active', true)
          .whereNotNull('hia_code')
          .where((q) => {
            if (icd !== '') {
              q.whereILike('code', parsed.icd11)
            }
            if (textKey !== '') {
              q.orWhereILike('label', parsed.text).orWhereILike('synonyms', `%${parsed.text}%`)
            }
          })
          .first()
        if (term?.hiaCode) {
          const hiaNorm = this.normalizeCode(term.hiaCode)
          if (this.codeIndex.has(hiaNorm)) {
            return this.codeIndex.get(hiaNorm)!
          }
          return term.hiaCode
        }
      }
    } catch {
      // Table may not exist yet.
    }

    return null
  }

  private normalizeCode(code: string): string {
    return code.replace(/[ .]/g, '').trim().toUpperCase()
  }

  private normalizeName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase()
  }
}
