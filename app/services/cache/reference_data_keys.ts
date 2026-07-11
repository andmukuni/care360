export const REFDATA_TAGS = {
  patients: 'patients',
  households: 'households',
  medications: 'medications',
  testTypes: 'test_types',
} as const

export type RefDataTag = (typeof REFDATA_TAGS)[keyof typeof REFDATA_TAGS]

export interface PatientRefAliases {
  id?: number | string | null
  patientId?: string | null
  barcode?: string | null
}

export interface HouseholdRefAliases {
  id?: number | string | null
  householdId?: string | null
  barcode?: string | null
}

function normalizeRef(ref: string | number | null | undefined): string | null {
  if (ref === null || ref === undefined) return null
  const value = String(ref).trim()
  return value === '' ? null : value
}

export function patientRefKeys(aliases: PatientRefAliases): string[] {
  const keys = new Set<string>()
  const id = normalizeRef(aliases.id)
  const patientId = normalizeRef(aliases.patientId)
  const barcode = normalizeRef(aliases.barcode)

  if (id) keys.add(`refdata:patients:ref:${id}`)
  if (patientId) keys.add(`refdata:patients:ref:${patientId}`)
  if (barcode) keys.add(`refdata:patients:ref:${barcode}`)

  return [...keys]
}

export function householdRefKeys(aliases: HouseholdRefAliases): string[] {
  const keys = new Set<string>()
  const id = normalizeRef(aliases.id)
  const householdId = normalizeRef(aliases.householdId)
  const barcode = normalizeRef(aliases.barcode)

  if (id) keys.add(`refdata:households:ref:${id}`)
  if (householdId) keys.add(`refdata:households:ref:${householdId}`)
  if (barcode) keys.add(`refdata:households:ref:${barcode}`)

  return [...keys]
}

export function lookupCodeKey(code: string): string {
  return `refdata:lookup:code:${code.trim()}`
}

export function medicationIdKey(id: number | string): string {
  return `refdata:medications:id:${id}`
}

export function testTypeIdKey(id: number | string): string {
  return `refdata:test_types:id:${id}`
}

export const REFDATA_KEYS = {
  patientsAll: 'refdata:patients:all',
  patientsKpis: 'refdata:patients:kpis',
  householdsAll: 'refdata:households:all',
  medicationsAll: 'refdata:medications:all',
  medicationsCategories: 'refdata:medications:categories',
  testTypesAll: 'refdata:test_types:all',
  testTypesCategories: 'refdata:test_types:categories',
} as const

export function patientAliasesFromRow(row: Record<string, unknown>): PatientRefAliases {
  return {
    id: row.id as number | string | null | undefined,
    patientId: (row.patient_id ?? row.patientId) as string | null | undefined,
    barcode: row.barcode as string | null | undefined,
  }
}

export function householdAliasesFromRow(row: Record<string, unknown>): HouseholdRefAliases {
  return {
    id: row.id as number | string | null | undefined,
    householdId: (row.household_id ?? row.householdId) as string | null | undefined,
    barcode: row.barcode as string | null | undefined,
  }
}

export function patientAliasesFromModel(model: {
  id: number
  patientId: string
  barcode?: string | null
}): PatientRefAliases {
  return {
    id: model.id,
    patientId: model.patientId,
    barcode: model.barcode ?? null,
  }
}

export function householdAliasesFromModel(model: {
  id: number
  householdId: string
  barcode?: string | null
}): HouseholdRefAliases {
  return {
    id: model.id,
    householdId: model.householdId,
    barcode: model.barcode ?? null,
  }
}
