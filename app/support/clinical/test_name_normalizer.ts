/** Normalize lab test names for rule matching. */
const TEST_ALIASES: Record<string, string[]> = {
  'MPS RDT': ['MALARIA RDT', 'MALARIA SLIDE', 'BLOOD SLIDE (MPS)', 'MPS'],
  'HIV 1 & 2': ['HIV RDT', 'HIV 1 AND 2', 'HIV'],
  FBC: ['FULL BLOOD COUNT', 'COMPLETE BLOOD COUNT', 'CBC'],
  'PREGNANCY TEST': ['PREGNANCY RDT', 'UPT', 'HCG'],
  CREATININE: ['CREA'],
  HAEMOGLOBIN: ['HB', 'HEMOGLOBIN'],
}

export function normalizeTestName(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function testNamesMatch(ruleName: string | null, actualName: string | null): boolean {
  const rule = normalizeTestName(ruleName)
  const actual = normalizeTestName(actualName)
  if (!rule || !actual) return false
  if (rule === actual) return true

  for (const [canonical, aliases] of Object.entries(TEST_ALIASES)) {
    const set = new Set([normalizeTestName(canonical), ...aliases.map(normalizeTestName)])
    if (set.has(rule) && set.has(actual)) return true
  }

  return actual.includes(rule) || rule.includes(actual)
}

export function normalizeMatchValue(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}
