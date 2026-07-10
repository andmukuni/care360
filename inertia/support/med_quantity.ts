const DAY_FACTORS: Record<string, number> = { Days: 1, Weeks: 7, Months: 30, Years: 365 }

const DEFAULTS = {
  bottleMl: 100,
  dropperMl: 10,
  dropsPerMl: 20,
  puffsPerInhaler: 200,
  daysPerContainer: 30,
}

const FORM_TO_FORMULATION: Record<string, string> = {
  capsule: 'Capsules',
  tablet: 'Tablets',
  sachet: 'Sachets',
  suppository: 'Suppositories',
  pessary: 'Suppositories',
  drop: 'Drops',
  syrup: 'mL',
  suspension: 'mL',
  solution: 'mL',
  liquid: 'mL',
  injection: 'Ampoules',
  inhaler: 'Puffs',
  cream: 'Tubes',
  ointment: 'Tubes',
  gel: 'Tubes',
  lotion: 'Tubes',
  paste: 'Tubes',
  patch: 'Patches',
}

const FREQ_PRESETS: Record<string, { perDay: number; once?: boolean }> = {
  STAT: { perDay: 1, once: true },
  QHS: { perDay: 1 },
  NOCTURNAL: { perDay: 1 },
  QAM: { perDay: 1 },
  OD: { perDay: 1 },
  OM: { perDay: 1 },
  ON: { perDay: 1 },
  BD: { perDay: 2 },
  Q12H: { perDay: 2 },
  TDS: { perDay: 3 },
  QID: { perDay: 4 },
  QDS: { perDay: 4 },
  PRN: { perDay: 1 },
  QW: { perDay: 1 / 7 },
  'ONCE EVERY 2 MONTHS': { perDay: 1 / 60 },
  'ONCE EVERY 3 MONTHS': { perDay: 1 / 90 },
}

export type MedQuantityInput = {
  itemPerDose: number | string
  frequency: number | string
  frequencyUnit?: string
  duration: number | string
  durationUnit?: string
  formulation?: string
  unitStrings?: string[]
}

export type MedQuantityResult = {
  quantity: number | null
  hint: string
}

export type MedSearchLike = {
  form?: string | null
  name?: string | null
  units?: string[]
  unit_details?: { name: string; form: string | null; strength: string | null }[]
}

function presetFor(unit: string | null | undefined) {
  if (!unit) return null
  return FREQ_PRESETS[String(unit).trim().toUpperCase()] ?? null
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function days(duration: number | string, durationUnit?: string | null): number | null {
  const dur = parseFloat(String(duration)) || 0
  if (!dur) return 0
  if (durationUnit === 'Indefinite') return null
  return dur * (DAY_FACTORS[durationUnit ?? 'Days'] ?? 1)
}

export function packSizeMl(strings: string[] | undefined, minMl: number): number | null {
  let best: number | null = null
  for (const s of strings ?? []) {
    if (typeof s !== 'string') continue
    const re = /(\d+(?:\.\d+)?)\s*(mL|ml|ML|[lL](?:tr|itre|iter)?s?\b)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      let val = parseFloat(m[1])
      if (!/^m/i.test(m[2])) val *= 1000
      if (val >= minMl && (best === null || val > best)) best = val
    }
  }
  return best
}

function puffsPerDevice(strings: string[] | undefined): number | null {
  for (const s of strings ?? []) {
    const m = typeof s === 'string' && s.match(/(\d+)\s*(?:dose|doses|puff|puffs)/i)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

export function formulationForForm(form: string | null | undefined): string | null {
  return FORM_TO_FORMULATION[String(form ?? '').toLowerCase()] ?? null
}

export function detectFormulation(med: MedSearchLike): string {
  const forms: string[] = []
  for (const u of med.unit_details ?? []) {
    if (u?.form) forms.push(u.form)
  }
  if (med.form) forms.push(med.form)
  for (const f of forms) {
    const mapped = FORM_TO_FORMULATION[String(f).toLowerCase()]
    if (mapped) return mapped
  }

  const haystack = [med.form ?? '']
    .concat(Array.isArray(med.units) ? med.units : [])
    .concat([med.name ?? ''])
    .join(' ')
    .toLowerCase()

  if (/capsule/.test(haystack)) return 'Capsules'
  if (/tablet|tab\b/.test(haystack)) return 'Tablets'
  if (/sachet/.test(haystack)) return 'Sachets'
  if (/suppositor|pessar/.test(haystack)) return 'Suppositories'
  if (/lozenge/.test(haystack)) return 'Lozenges'
  if (/drop/.test(haystack)) return 'Drops'
  if (/\bml\b|syrup|suspension|solution|elixir|linctus/.test(haystack)) return 'mL'
  if (/injection|ampoule|amp\b/.test(haystack)) return 'Ampoules'
  if (/vial/.test(haystack)) return 'Vials'
  if (/insulin/.test(haystack)) return 'Units'
  if (/puff|inhaler|mdi|turbuhaler|accuhaler/.test(haystack)) return 'Puffs'
  if (/patch/.test(haystack)) return 'Patches'
  if (/cream|ointment|gel|lotion|paste|tube/.test(haystack)) return 'Tubes'
  return 'Tablets'
}

export function computeMedQuantity(input: MedQuantityInput): MedQuantityResult {
  const ipd = parseFloat(String(input.itemPerDose)) || 0
  const preset = presetFor(input.frequencyUnit)
  let freq = parseFloat(String(input.frequency)) || 0
  let d = days(input.duration, input.durationUnit)
  let freqText = `${freq}/day`
  let once = false

  if (preset) {
    freq = preset.perDay
    freqText = String(input.frequencyUnit).trim()
    if (preset.once) {
      once = true
      freq = 1
      d = 1
    }
  }

  if (!once && d === null) {
    return { quantity: null, hint: 'Indefinite course — enter quantity manually' }
  }
  if (!ipd || !freq || !d) {
    return { quantity: null, hint: 'Fill in dose, frequency & duration to auto-calculate' }
  }

  const doseDesc = once ? 'single dose' : `${freqText} × ${d} day(s)`
  const f = String(input.formulation ?? '').toLowerCase()
  const strings = input.unitStrings ?? []

  if (f === 'ml' || f === 'syrup' || f === 'suspension' || f === 'solution') {
    const totalMl = ipd * freq * d
    const bottle = packSizeMl(strings, 30) || DEFAULTS.bottleMl
    const qty = Math.max(1, Math.ceil(totalMl / bottle))
    return {
      quantity: qty,
      hint: `${ipd} mL × ${doseDesc} = ${round1(totalMl)} mL → ${qty} bottle(s) of ${bottle} mL`,
    }
  }

  if (f === 'drops' || f === 'drop') {
    const totalMl = (ipd * freq * d) / DEFAULTS.dropsPerMl
    const bottle = packSizeMl(strings, 2) || DEFAULTS.dropperMl
    const qty = Math.max(1, Math.ceil(totalMl / bottle))
    return {
      quantity: qty,
      hint: `${ipd} drop(s) × ${doseDesc} ≈ ${round1(totalMl)} mL → ${qty} dropper bottle(s)`,
    }
  }

  if (f === 'puffs' || f === 'puff' || f === 'inhaler') {
    const totalPuffs = ipd * freq * d
    const per = puffsPerDevice(strings) || DEFAULTS.puffsPerInhaler
    const qty = Math.max(1, Math.ceil(totalPuffs / per))
    return {
      quantity: qty,
      hint: `${round1(totalPuffs)} puff(s) ÷ ${per} per inhaler → ${qty} inhaler(s)`,
    }
  }

  if (['tubes', 'tube', 'g', 'cream', 'ointment', 'gel', 'lotion', 'paste'].includes(f)) {
    const qty = once ? 1 : Math.max(1, Math.ceil(d / DEFAULTS.daysPerContainer))
    return {
      quantity: qty,
      hint: once
        ? 'Single application → 1 tube/container'
        : `${d} day(s) of application → ${qty} tube(s)/container(s)`,
    }
  }

  const qty = Math.ceil(ipd * freq * d)
  const label = input.formulation || 'unit(s)'
  return {
    quantity: qty,
    hint: `${ipd} ${label} × ${doseDesc} = ${qty} ${label}`,
  }
}

export const MedQuantity = {
  compute: computeMedQuantity,
  days,
  packSizeMl,
  detectFormulation,
  formulationForForm,
  frequencyPreset: presetFor,
}
