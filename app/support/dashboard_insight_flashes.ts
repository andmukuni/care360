import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type InsightTone = 'teal' | 'sky' | 'amber' | 'rose' | 'violet' | 'emerald' | 'neutral'

export interface InsightFlash {
  id: string
  eyebrow: string
  headline: string
  detail: string
  metric?: string
  tone: InsightTone
  href?: string
}

const SYMPTOM_LABELS: Record<string, string> = {
  cough: 'cough',
  fever: 'fever',
  lethargy: 'lethargy',
  weight_loss: 'weight loss',
  blood_stained_sputum: 'blood-stained sputum',
  shortness_of_breath: 'shortness of breath',
  chest_pain: 'chest pain',
  night_sweats: 'night sweats',
  fatigue: 'fatigue',
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

function genderLabel(raw: string | null | undefined): string {
  const g = String(raw ?? '').toLowerCase()
  if (g === 'male') return 'Male'
  if (g === 'female') return 'Female'
  return 'Other'
}

/**
 * Builds rotating dashboard insight flashes from live clinical data.
 * Each flash is only included when the underlying signal is meaningful.
 */
export default class DashboardInsightFlashes {
  static async build(): Promise<InsightFlash[]> {
    try {
      return await this.buildUnsafe()
    } catch {
      return [
        {
          id: 'calm-floor',
          eyebrow: 'Floor status',
          headline: 'Care cycle insights are warming up',
          detail: 'Live clinical signals will appear here as encounters, screening, and lab data flow in',
          tone: 'neutral',
          href: '/registration',
        },
      ]
    }
  }

  private static async buildUnsafe(): Promise<InsightFlash[]> {
    const flashes: InsightFlash[] = []
    const since7d = DateTime.now().minus({ days: 7 }).toSQL({ includeOffset: false })!
    const since30d = DateTime.now().minus({ days: 30 }).toSQL({ includeOffset: false })!

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch {
        return fallback
      }
    }

    const [
      genderActive,
      priorityActive,
      visitTypes,
      feverToday,
      labWeek,
      symptoms30d,
      pediatricScreening,
      presumptiveTb,
      stageBottleneck,
    ] = await Promise.all([
      safe(() => this.activeByGender(), { male: 0, female: 0, other: 0 }),
      safe(() => this.priorityLoad(), { urgent: 0, emergency: 0 }),
      safe(() => this.visitTypeMix(), { top: null, summary: 'no visit types tagged yet' }),
      safe(() => this.feverByGenderToday(), { total: 0, male: 0, female: 0 }),
      safe(() => this.labQuality(since7d), {
        total: 0,
        normal: 0,
        abnormal: 0,
        critical: 0,
        inconclusive: 0,
      }),
      safe(() => this.symptomLeaders(since30d), { top: null, contrast: null }),
      safe(() => this.pediatricScreeningLoad(), { total: 0, pediatric: 0, adult: 0 }),
      safe(() => this.presumptiveTbToday(), 0),
      safe(() => this.stageBottleneck(), null),
    ])

    // ── Active encounters by gender ──────────────────────────────────────────
    const maleActive = genderActive.male
    const femaleActive = genderActive.female
    const activeTotal = maleActive + femaleActive + genderActive.other
    if (activeTotal > 0) {
      const leadGender = maleActive >= femaleActive ? 'Male' : 'Female'
      const leadCount = Math.max(maleActive, femaleActive)
      const leadShare = pct(leadCount, activeTotal)
      flashes.push({
        id: 'active-by-gender',
        eyebrow: 'Active encounters',
        headline: `${leadGender} patients lead the floor`,
        detail: `${maleActive} male · ${femaleActive} female currently in the care cycle`,
        metric: `${leadShare}%`,
        tone: leadGender === 'Male' ? 'sky' : 'violet',
        href: '/registration',
      })
    }

    // ── Symptom leaders by gender (30d) ──────────────────────────────────────
    if (symptoms30d.top) {
      const { gender, symptom, count, genderTotal } = symptoms30d.top
      const share = pct(count, genderTotal)
      const label = SYMPTOM_LABELS[symptom] ?? symptom.replace(/_/g, ' ')
      flashes.push({
        id: `symptom-${gender}-${symptom}`,
        eyebrow: 'Symptom signal · 30 days',
        headline: `${genderLabel(gender)} patients show elevated ${label}`,
        detail: `${count} of ${genderTotal} screened ${genderLabel(gender).toLowerCase()} cases reported ${label}`,
        metric: `${share}%`,
        tone: symptom === 'cough' || symptom === 'fever' ? 'amber' : 'rose',
        href: '/screening/queue',
      })
    }

    if (symptoms30d.contrast) {
      const { gender, highSymptom, highCount, lowNote } = symptoms30d.contrast
      const highLabel = SYMPTOM_LABELS[highSymptom] ?? highSymptom.replace(/_/g, ' ')
      flashes.push({
        id: `symptom-contrast-${gender}`,
        eyebrow: 'Clinical pattern',
        headline: `${genderLabel(gender)} cohort: high ${highLabel}, ${lowNote}`,
        detail: `${highCount} recent ${highLabel} reports — watch triage and screening queues`,
        tone: 'amber',
        href: '/triage/queue',
      })
    }

    // ── Lab quality (7d) ─────────────────────────────────────────────────────
    if (labWeek.total > 0) {
      const normalShare = pct(labWeek.normal, labWeek.total)
      const abnormalShare = pct(labWeek.abnormal + labWeek.critical, labWeek.total)
      if (normalShare >= 60) {
        flashes.push({
          id: 'lab-normal-strong',
          eyebrow: 'Lab quality · 7 days',
          headline: 'Most results landing in the normal range',
          detail: `${labWeek.normal} normal · ${labWeek.abnormal} abnormal · ${labWeek.critical} critical of ${labWeek.total} results`,
          metric: `${normalShare}%`,
          tone: 'emerald',
          href: '/lab/queue',
        })
      } else {
        flashes.push({
          id: 'lab-abnormal-watch',
          eyebrow: 'Lab quality · 7 days',
          headline: 'Abnormal / critical results need attention',
          detail: `${labWeek.abnormal + labWeek.critical} flagged of ${labWeek.total} results (${abnormalShare}%)`,
          metric: `${abnormalShare}%`,
          tone: 'rose',
          href: '/lab/queue',
        })
      }

      if (labWeek.critical > 0) {
        flashes.push({
          id: 'lab-critical',
          eyebrow: 'Critical alerts',
          headline: `${labWeek.critical} critical lab result${labWeek.critical === 1 ? '' : 's'} this week`,
          detail: 'Prioritise screening review and clinician follow-up for flagged cases',
          metric: String(labWeek.critical),
          tone: 'rose',
          href: '/screening-review/queue',
        })
      }
    }

    // ── Fever from triage today ──────────────────────────────────────────────
    if (feverToday.total > 0) {
      const lead = feverToday.female >= feverToday.male ? 'Female' : 'Male'
      const leadN = Math.max(feverToday.female, feverToday.male)
      flashes.push({
        id: 'fever-today',
        eyebrow: 'Triage vitals · today',
        headline: `${feverToday.total} febrile patient${feverToday.total === 1 ? '' : 's'} recorded today`,
        detail: `${lead} patients account for ${leadN} of today’s fever readings (≥ 38°C)`,
        metric: String(feverToday.total),
        tone: 'amber',
        href: '/triage/queue',
      })
    }

    // ── Priority pressure ────────────────────────────────────────────────────
    if (priorityActive.urgent + priorityActive.emergency > 0) {
      flashes.push({
        id: 'priority-pressure',
        eyebrow: 'Queue pressure',
        headline: `${priorityActive.urgent + priorityActive.emergency} urgent / emergency cases open`,
        detail: `${priorityActive.emergency} emergency · ${priorityActive.urgent} urgent still active in the cycle`,
        metric: String(priorityActive.urgent + priorityActive.emergency),
        tone: 'rose',
        href: '/registration',
      })
    }

    // ── Visit type mix ───────────────────────────────────────────────────────
    if (visitTypes.top) {
      flashes.push({
        id: 'visit-type-lead',
        eyebrow: 'Visit mix · active',
        headline: `${visitTypes.top.type} is the busiest visit type`,
        detail: `${visitTypes.top.count} active ${visitTypes.top.type} encounters — ${visitTypes.summary}`,
        metric: String(visitTypes.top.count),
        tone: 'teal',
        href: '/registration',
      })
    }

    // ── Pediatric screening load ─────────────────────────────────────────────
    if (pediatricScreening.total > 0) {
      const pedShare = pct(pediatricScreening.pediatric, pediatricScreening.total)
      flashes.push({
        id: 'pediatric-screening',
        eyebrow: 'Screening queue',
        headline:
          pedShare >= 40
            ? 'Pediatric load is elevated in screening'
            : 'Adult patients dominate the screening queue',
        detail: `${pediatricScreening.pediatric} pediatric · ${pediatricScreening.adult} adult currently screening`,
        metric: `${pedShare}%`,
        tone: pedShare >= 40 ? 'violet' : 'sky',
        href: '/screening/queue',
      })
    }

    // ── Presumptive TB ───────────────────────────────────────────────────────
    if (presumptiveTb > 0) {
      flashes.push({
        id: 'presumptive-tb',
        eyebrow: 'TB awareness · today',
        headline: `${presumptiveTb} presumptive TB case${presumptiveTb === 1 ? '' : 's'} flagged today`,
        detail: 'Ensure sputum pathways and infection-control steps stay on track',
        metric: String(presumptiveTb),
        tone: 'amber',
        href: '/reports/presumptive-tb',
      })
    }

    // ── Stage bottleneck ─────────────────────────────────────────────────────
    if (stageBottleneck) {
      flashes.push({
        id: 'stage-bottleneck',
        eyebrow: 'Flow bottleneck',
        headline: `${stageBottleneck.label} is holding the most patients`,
        detail: `${stageBottleneck.count} active encounters waiting or in progress at this stage`,
        metric: String(stageBottleneck.count),
        tone: 'teal',
        href: stageBottleneck.href,
      })
    }

    // Always keep at least one calm fallback so the carousel never looks empty.
    if (flashes.length === 0) {
      flashes.push({
        id: 'calm-floor',
        eyebrow: 'Floor status',
        headline: 'Care cycle looks quiet right now',
        detail: 'No strong clinical signals yet — new encounters will light up insights here',
        tone: 'neutral',
        href: '/registration',
      })
    }

    return flashes.slice(0, 8)
  }

  private static async activeByGender(): Promise<{ male: number; female: number; other: number }> {
    const rows = await db
      .from('encounters as e')
      .join('patients as p', 'p.id', 'e.patient_id')
      .whereNull('e.deleted_at')
      .whereNotIn('e.current_status', ['completed', 'cancelled'])
      .select(db.raw("LOWER(COALESCE(p.gender, 'other')) as gender"))
      .countDistinct('e.id as total')
      .groupByRaw("LOWER(COALESCE(p.gender, 'other'))")

    const out = { male: 0, female: 0, other: 0 }
    for (const row of rows) {
      const g = String(row.gender)
      const n = Number(row.total)
      if (g === 'male') out.male = n
      else if (g === 'female') out.female = n
      else out.other += n
    }
    return out
  }

  private static async priorityLoad(): Promise<{ urgent: number; emergency: number }> {
    const rows = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereNotIn('current_status', ['completed', 'cancelled'])
      .whereIn('priority_level', ['urgent', 'emergency', 'stat', 'high'])
      .select('priority_level')
      .count('* as total')
      .groupBy('priority_level')

    let urgent = 0
    let emergency = 0
    for (const row of rows) {
      const level = String(row.priority_level).toLowerCase()
      const n = Number(row.total)
      if (level === 'emergency' || level === 'stat') emergency += n
      else urgent += n
    }
    return { urgent, emergency }
  }

  private static async visitTypeMix(): Promise<{
    top: { type: string; count: number } | null
    summary: string
  }> {
    const rows = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereNotIn('current_status', ['completed', 'cancelled'])
      .whereNotNull('visit_type')
      .where('visit_type', '<>', '')
      .select('visit_type')
      .count('* as total')
      .groupBy('visit_type')
      .orderBy('total', 'desc')

    if (!rows.length) return { top: null, summary: 'no visit types tagged yet' }

    const top = { type: String(rows[0].visit_type), count: Number(rows[0].total) }
    const summary = rows
      .slice(0, 3)
      .map((r) => `${r.visit_type} ${r.total}`)
      .join(' · ')
    return { top, summary }
  }

  private static async feverByGenderToday(): Promise<{ total: number; male: number; female: number }> {
    const today = DateTime.now().toISODate()!
    const rows = await db
      .from('triage_records as tr')
      .join('patients as p', 'p.id', 'tr.patient_id')
      .whereRaw('DATE(tr.triage_at) = ?', [today])
      .where('tr.temperature', '>=', 38)
      .select(db.raw("LOWER(COALESCE(p.gender, 'other')) as gender"))
      .count('* as total')
      .groupByRaw("LOWER(COALESCE(p.gender, 'other'))")

    const out = { total: 0, male: 0, female: 0 }
    for (const row of rows) {
      const n = Number(row.total)
      out.total += n
      if (String(row.gender) === 'male') out.male = n
      if (String(row.gender) === 'female') out.female = n
    }
    return out
  }

  private static async labQuality(since: string): Promise<{
    total: number
    normal: number
    abnormal: number
    critical: number
    inconclusive: number
  }> {
    const rows = await db
      .from('lab_results')
      .whereNotNull('interpretation')
      .where('result_recorded_at', '>=', since)
      .select('interpretation')
      .count('* as total')
      .groupBy('interpretation')

    const out = { total: 0, normal: 0, abnormal: 0, critical: 0, inconclusive: 0 }
    for (const row of rows) {
      const key = String(row.interpretation).toLowerCase()
      const n = Number(row.total)
      out.total += n
      if (key === 'normal') out.normal = n
      else if (key === 'abnormal') out.abnormal = n
      else if (key === 'critical') out.critical = n
      else if (key === 'inconclusive') out.inconclusive = n
    }
    return out
  }

  private static async symptomLeaders(since: string): Promise<{
    top: { gender: string; symptom: string; count: number; genderTotal: number } | null
    contrast: { gender: string; highSymptom: string; highCount: number; lowNote: string } | null
  }> {
    // tb_symptoms is stored as a JSON array string; use jsonb containment-safe expand.
    const result = await db.rawQuery(
      `
      SELECT LOWER(COALESCE(p.gender, 'other')) AS gender,
             symptom.key AS symptom,
             COUNT(*)::int AS cases
      FROM screening_records sr
      JOIN patients p ON p.id = sr.patient_id
      JOIN encounters e ON e.id = sr.encounter_id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN sr.tb_symptoms IS NULL OR btrim(sr.tb_symptoms) = '' THEN '[]'::jsonb
          WHEN left(btrim(sr.tb_symptoms), 1) = '[' THEN sr.tb_symptoms::jsonb
          ELSE '[]'::jsonb
        END
      ) AS symptom(key)
      WHERE sr.screening_type = 'initial'
        AND e.deleted_at IS NULL
        AND COALESCE(sr.screening_started_at, e.started_at) >= ?
      GROUP BY LOWER(COALESCE(p.gender, 'other')), symptom.key
      ORDER BY cases DESC
      LIMIT 40
      `,
      [since]
    )

    const list: Array<{ gender: string; symptom: string; count: number }> = (
      (result as any).rows ??
      result ??
      []
    ).map((r: any) => ({
      gender: String(r.gender),
      symptom: String(r.symptom),
      count: Number(r.cases),
    }))

    if (!list.length) return { top: null, contrast: null }

    const genderTotals: Record<string, number> = {}
    for (const row of list) {
      genderTotals[row.gender] = (genderTotals[row.gender] ?? 0) + row.count
    }

    const topRow = list[0]
    const top = {
      gender: topRow.gender,
      symptom: topRow.symptom,
      count: topRow.count,
      genderTotal: genderTotals[topRow.gender] ?? topRow.count,
    }

    // Contrast: for the gender with the highest single symptom, note if normal-ish lab share is low
    // or if another common "good" signal is weak — here we phrase around low fever/cough counterpart.
    const genderRows = list.filter((r) => r.gender === topRow.gender)
    const high = genderRows[0]
    const cough = genderRows.find((r) => r.symptom === 'cough')
    const fever = genderRows.find((r) => r.symptom === 'fever')
    let lowNote = 'watch for secondary symptoms'
    if (high.symptom === 'cough' && (fever?.count ?? 0) < high.count * 0.4) {
      lowNote = 'relatively low fever reports'
    } else if (high.symptom === 'fever' && (cough?.count ?? 0) < high.count * 0.4) {
      lowNote = 'relatively low cough reports'
    } else if (genderRows.length >= 2 && genderRows[1].count < high.count * 0.5) {
      const second = SYMPTOM_LABELS[genderRows[1].symptom] ?? genderRows[1].symptom
      lowNote = `lower ${second} volume`
    }

    const contrast =
      high.count >= 3
        ? {
            gender: high.gender,
            highSymptom: high.symptom,
            highCount: high.count,
            lowNote,
          }
        : null

    return { top, contrast }
  }

  private static async pediatricScreeningLoad(): Promise<{
    total: number
    pediatric: number
    adult: number
  }> {
    const result = await db.rawQuery(
      `
      SELECT
        CASE
          WHEN p.date_of_birth IS NOT NULL
            AND p.date_of_birth > (CURRENT_DATE - INTERVAL '5 years')
          THEN 'pediatric'
          ELSE 'adult'
        END AS category,
        COUNT(*)::int AS total
      FROM encounters e
      JOIN patients p ON p.id = e.patient_id
      WHERE e.deleted_at IS NULL
        AND e.current_stage = 'screening'
        AND e.current_status IN ('queued', 'in_progress')
      GROUP BY 1
      `
    )

    const out = { total: 0, pediatric: 0, adult: 0 }
    for (const row of (result as any).rows ?? result ?? []) {
      const n = Number(row.total)
      out.total += n
      if (String(row.category) === 'pediatric') out.pediatric = n
      else out.adult = n
    }
    return out
  }

  private static async presumptiveTbToday(): Promise<number> {
    const today = DateTime.now().toISODate()!
    const row = await db
      .from('screening_records')
      .whereNotNull('presumptive_tb_case_no')
      .where('presumptive_tb_case_no', '<>', '')
      .whereRaw('DATE(COALESCE(screening_started_at, created_at)) = ?', [today])
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }

  private static async stageBottleneck(): Promise<{
    label: string
    count: number
    href: string
  } | null> {
    const labels: Record<string, { label: string; href: string }> = {
      registration: { label: 'Registration', href: '/registration' },
      triage: { label: 'Triage', href: '/triage/queue' },
      screening: { label: 'Screening', href: '/screening/queue' },
      lab: { label: 'Lab', href: '/lab/queue' },
      screening_review: { label: 'Screening Review', href: '/screening-review/queue' },
      pharmacy: { label: 'Pharmacy', href: '/pharmacy/queue' },
      treatment_room: { label: 'Treatment Room', href: '/treatment-room/queue' },
    }

    const row = await db
      .from('encounters')
      .whereNull('deleted_at')
      .whereNotIn('current_status', ['completed', 'cancelled'])
      .whereNot('current_stage', 'completed')
      .select('current_stage')
      .count('* as total')
      .groupBy('current_stage')
      .orderBy('total', 'desc')
      .first()

    if (!row || Number(row.total) <= 0) return null
    const meta = labels[String(row.current_stage)]
    if (!meta) return null
    return { label: meta.label, count: Number(row.total), href: meta.href }
  }
}
