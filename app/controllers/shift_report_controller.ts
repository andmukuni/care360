import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Encounter from '#models/encounter'
import ShiftReport from '#models/shift_report'
import ShiftRoster from '#models/shift_roster'
import User from '#models/user'
import { USER_MORPH_TYPE } from '#services/auth/rbac_service'
import { rosterAssignmentValidator, prefillRosterValidator } from '#validators/staff/report_validators'

interface ShiftDefinition {
  label: string
  start: string
  end: string
}

/**
 * Shift management + roster. Ported from App\Http\Controllers\ShiftReportController.
 *
 * The Laravel ShiftEngine and ShiftRosterPrefillService have no Adonis
 * counterparts (they live under app/services, outside this worker's ownership),
 * so their logic is ported inline here. Shift definitions mirror
 * `config/shifts.php`.
 */
export default class ShiftReportController {
  private readonly definitions: Record<string, ShiftDefinition> = {
    day: { label: 'Day Shift', start: '07:00', end: '18:59' },
    night: { label: 'Night Shift', start: '19:00', end: '06:59' },
  }

  async index(ctx: HttpContext) {
    const { request, inertia } = ctx
    const weekStart = this.resolveWeekStart(String(request.qs().week_start ?? ''))
    const weekEnd = weekStart.plus({ days: 6 })
    const weekDays = this.weekDays(weekStart)

    const currentShift = this.shiftForMoment(DateTime.now())
    const today = DateTime.now().toISODate()!

    const totalReports = await this.count(ShiftReport.query())
    const staffIds = await this.shiftStaffIds()

    const patientsTodayRow = await db
      .from('shift_reports')
      .whereRaw('DATE(report_date) = ?', [today])
      .sum('total_patients_seen as total')
      .first()
    const patientsMonthRow = await db
      .from('shift_reports')
      .whereBetween('report_date', [
        DateTime.now().startOf('month').toISODate()!,
        DateTime.now().endOf('month').toISODate()!,
      ])
      .sum('total_patients_seen as total')
      .first()

    const summary = {
      total_reports: totalReports,
      total_staff: staffIds.length,
      patients_today: Number(patientsTodayRow?.total ?? 0),
      patients_this_month: Number(patientsMonthRow?.total ?? 0),
    }

    const rosterRows = await ShiftRoster.query()
      .preload('user')
      .preload('assignedByUser')
      .whereBetween('shift_date', [weekStart.toISODate()!, weekEnd.toISODate()!])
      .orderBy('shift_date')
      .orderBy('shift_type')
      .orderBy('start_time')
      .orderBy('id')

    const rosterAssignments: Record<string, ReturnType<typeof this.mapRoster>[]> = {}
    for (const row of rosterRows) {
      const key = row.shiftDate.toISODate()!
      ;(rosterAssignments[key] ??= []).push(this.mapRoster(row))
    }

    const staffCandidates = (
      await User.query().whereIn('id', staffIds.length ? staffIds : [0]).orderBy('name')
    ).map((u) => ({ id: u.id, name: u.name, email: u.email, profile_photo_path: u.profilePhotoPath }))

    let currentShiftRoster: ReturnType<typeof this.mapRoster>[] = []
    if (currentShift) {
      let currentShiftDate = today
      if (currentShift.key === 'night') {
        const [endHour, endMinute] = currentShift.end.split(':').map((n) => Number.parseInt(n, 10))
        const now = DateTime.now()
        const nowMinutes = now.hour * 60 + now.minute
        if (nowMinutes <= endHour * 60 + endMinute) {
          currentShiftDate = now.minus({ days: 1 }).toISODate()!
        }
      }
      const rows = await ShiftRoster.query()
        .preload('user')
        .whereRaw('DATE(shift_date) = ?', [currentShiftDate])
        .where('shift_type', currentShift.key)
        .orderBy('id')
      currentShiftRoster = rows.map((r) => this.mapRoster(r))
    }

    const rosterDaySummary: Record<string, Record<string, number>> = {}
    for (const day of weekDays) {
      const dayKey = day.toISODate()!
      const rows = rosterAssignments[dayKey] ?? []
      const entry: Record<string, number> = { total_count: rows.length }
      for (const shiftKey of Object.keys(this.definitions)) {
        entry[`${shiftKey}_count`] = rows.filter((r) => r.shift_type === shiftKey).length
      }
      rosterDaySummary[dayKey] = entry
    }

    const allRosterRows = Object.values(rosterAssignments).flat()
    const weeklyRosterTotals = {
      assignments: allRosterRows.length,
      staff: new Set(allRosterRows.map((r) => r.user_id).filter(Boolean)).size,
    }

    const prefillWeekStart = weekStart.plus({ weeks: 1 }).startOf('week')

    return inertia.render('reports/shifts/index', {
      summary,
      currentShift,
      shiftDefinitions: this.definitions,
      staffCandidates,
      rosterAssignments,
      currentShiftRoster,
      weekStart: weekStart.toISODate(),
      weekEnd: weekEnd.toISODate(),
      weekDays: weekDays.map((d) => d.toISODate()),
      rosterDaySummary,
      weeklyRosterTotals,
      prefillWeekStart: prefillWeekStart.toISODate(),
      prefillWeekEnd: prefillWeekStart.plus({ days: 6 }).toISODate(),
      prevWeekStart: weekStart.minus({ weeks: 1 }).toISODate(),
      nextWeekStart: weekStart.plus({ weeks: 1 }).toISODate(),
    })
  }

  async timeline(ctx: HttpContext) {
    const { request, inertia, response } = ctx
    const selectedShift = this.normalizeShiftType(String(request.qs().shift ?? '')) ?? null
    const weekStartInput = String(request.qs().week_start ?? '')
    const selectedMonth = String(request.qs().month ?? '').trim()

    let weekStart = this.resolveWeekStart(weekStartInput)
    if (weekStartInput === '' && selectedMonth !== '') {
      const monthStart = DateTime.fromISO(`${selectedMonth}-01`)
      if (monthStart.isValid) {
        weekStart = monthStart.startOf('week')
      }
    }
    const weekEnd = weekStart.plus({ days: 6 })
    const weekDays = this.weekDays(weekStart)

    const weeklyEncounters = await Encounter.query()
      .select('id', 'started_at', 'started_by')
      .whereBetween('started_at', [
        weekStart.startOf('day').toSQL()!,
        weekEnd.endOf('day').toSQL()!,
      ])
      .orderBy('started_at')

    const daySummaries: Record<string, any> = {}
    for (const day of weekDays) {
      daySummaries[day.toISODate()!] = {
        total_patients: 0,
        report_count: 0,
        staff_count: 0,
        day_patients: 0,
        night_patients: 0,
        _staff: new Set<number>(),
      }
    }

    const slotsByUserAndDay: Record<number, Record<string, Record<string, { shift_type: string; patients: number }>>> =
      {}

    for (const encounter of weeklyEncounters) {
      if (!encounter.startedAt) {
        continue
      }
      const startedAt = encounter.startedAt
      const dayKey = startedAt.toISODate()!
      const shift = this.shiftForMoment(startedAt)
      const shiftKey = shift?.key ?? null

      if (!shiftKey || (selectedShift && shiftKey !== selectedShift) || !daySummaries[dayKey]) {
        continue
      }

      daySummaries[dayKey].total_patients++
      daySummaries[dayKey].report_count++
      if (shiftKey === 'night') {
        daySummaries[dayKey].night_patients++
      } else {
        daySummaries[dayKey].day_patients++
      }

      if (encounter.startedBy) {
        const startedBy = encounter.startedBy
        daySummaries[dayKey]._staff.add(startedBy)
        const byUser = (slotsByUserAndDay[startedBy] ??= {})
        const byDay = (byUser[dayKey] ??= {})
        const slot = (byDay[shiftKey] ??= { shift_type: shiftKey, patients: 0 })
        slot.patients++
      }
    }

    const encounterStaffIds = Object.keys(slotsByUserAndDay).map((id) => Number.parseInt(id, 10))

    for (const key of Object.keys(daySummaries)) {
      daySummaries[key].staff_count = daySummaries[key]._staff.size
      delete daySummaries[key]._staff
    }

    const staffUsers = await this.timelineStaffUsers(encounterStaffIds)
    const staffBoardRows = staffUsers.map((user) => {
      const daySlotMap = slotsByUserAndDay[user.id] ?? {}
      let assignedDays = 0
      let encounterCount = 0
      const daySlots: Record<string, { shift_type: string; patients: number }[]> = {}
      for (const day of weekDays) {
        const dayKey = day.toISODate()!
        const slots = Object.values(daySlotMap[dayKey] ?? {})
        daySlots[dayKey] = slots
        if (slots.length) {
          assignedDays++
          encounterCount += slots.reduce((sum, s) => sum + s.patients, 0)
        }
      }
      return {
        user: { id: user.id, name: user.name, email: user.email, profile_photo_path: user.profilePhotoPath },
        slots: daySlots,
        assigned_days: assignedDays,
        encounter_count: encounterCount,
      }
    })

    const weeklyTotals = {
      patients: Object.values(daySummaries).reduce((sum: number, d: any) => sum + d.total_patients, 0),
      reports: Object.values(daySummaries).reduce((sum: number, d: any) => sum + d.report_count, 0),
      staff: new Set(encounterStaffIds).size,
    }

    const prefillWeekStart = weekStart.plus({ weeks: 1 }).startOf('week')

    const payload = {
      selectedShift,
      selectedMonth,
      shiftDefinitions: this.definitions,
      weekStart: weekStart.toISODate(),
      weekEnd: weekEnd.toISODate(),
      weekDays: weekDays.map((d) => d.toISODate()),
      prefillWeekStart: prefillWeekStart.toISODate(),
      prefillWeekEnd: prefillWeekStart.plus({ days: 6 }).toISODate(),
      daySummaries,
      staffBoardRows,
      weeklyTotals,
      prevWeekStart: weekStart.minus({ weeks: 1 }).toISODate(),
      nextWeekStart: weekStart.plus({ weeks: 1 }).toISODate(),
    }

    if (request.accepts(['html', 'json']) === 'json') {
      return response.json(payload)
    }

    return inertia.render('reports/shifts/timeline', payload)
  }

  async storeRosterAssignment(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const shiftTypes = Object.keys(this.definitions)
    const validated = await request.validateUsing(rosterAssignmentValidator)

    const shiftType = this.normalizeShiftType(validated.shift_type)
    if (!shiftType || !shiftTypes.includes(shiftType)) {
      session.flash('error', 'Invalid shift type.')
      return response.redirect().back()
    }

    const [startHour, startMinute] = validated.start_time.split(':').map((n) => Number.parseInt(n, 10))
    const [endHour, endMinute] = validated.end_time.split(':').map((n) => Number.parseInt(n, 10))
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute

    if (startMinutes === endMinutes) {
      session.flash('error', 'End time must be different from start time.')
      return response.redirect().back()
    }

    const definition = this.definitions[shiftType]
    const [defStartH, defStartM] = definition.start.split(':').map((n) => Number.parseInt(n, 10))
    const [defEndH, defEndM] = definition.end.split(':').map((n) => Number.parseInt(n, 10))
    const defCrossesMidnight = defEndH * 60 + defEndM < defStartH * 60 + defStartM

    if (defCrossesMidnight && endMinutes >= startMinutes) {
      session.flash('error', `${definition.label} must cross midnight (end time should be earlier than start time).`)
      return response.redirect().back()
    }
    if (!defCrossesMidnight && endMinutes <= startMinutes) {
      session.flash('error', `${definition.label} end time must be after start time.`)
      return response.redirect().back()
    }

    const userExists = await User.find(validated.user_id)
    if (!userExists) {
      session.flash('error', 'Selected staff member does not exist.')
      return response.redirect().back()
    }

    const crossShiftConflict = await ShiftRoster.query()
      .whereRaw('DATE(shift_date) = ?', [validated.shift_date])
      .where('user_id', validated.user_id)
      .whereNot('shift_type', shiftType)
      .first()

    if (crossShiftConflict) {
      session.flash('error', 'This staff member is already assigned to another shift on this date.')
      return response.redirect().back()
    }

    await ShiftRoster.updateOrCreate(
      {
        shiftDate: DateTime.fromISO(validated.shift_date),
        shiftType,
        userId: validated.user_id,
      },
      {
        startTime: validated.start_time,
        endTime: validated.end_time,
        notes: validated.notes ?? null,
        assignedBy: auth.user?.id ?? null,
      }
    )

    session.flash('success', 'Shift roster updated.')
    return response.redirect().back()
  }

  async destroyRosterAssignment(ctx: HttpContext) {
    const { params, response, session } = ctx
    const roster = await ShiftRoster.find(params.shiftRoster)
    if (roster) {
      await roster.delete()
    }
    session.flash('success', 'Shift assignment removed.')
    return response.redirect().back()
  }

  async prefillRosterWeek(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const validated = await request.validateUsing(prefillRosterValidator)

    const weekStart = this.resolveWeekStart(validated.week_start ?? '')
    const result = await this.prefillWeek(weekStart, auth.user?.id ?? null)

    let message = `Auto-prefill complete for ${result.week_start} to ${result.week_end}: ${result.created} assignment(s) created`
    message += result.skipped > 0 ? `, ${result.skipped} slot(s) could not be filled.` : '.'

    session.flash('success', message)

    const path = (validated.return_to ?? 'index') === 'timeline' ? '/reports/shifts/timeline' : '/reports/shifts'
    return response.redirect().toPath(`${path}?week_start=${weekStart.toISODate()}`)
  }

  // ── shift engine (ported from ShiftEngine) ────────────────────────────────

  private normalizeShiftType(shiftType: string | null): string | null {
    if (shiftType === null) {
      return null
    }
    const normalized = shiftType.toLowerCase().trim()
    if (normalized === 'day' || normalized === 'day shift') return 'day'
    if (normalized === 'night' || normalized === 'night shift') return 'night'
    return normalized !== '' ? normalized : null
  }

  private shiftForMoment(moment: DateTime): { key: string; label: string; start: string; end: string } | null {
    const currentMinutes = moment.hour * 60 + moment.minute
    for (const [key, def] of Object.entries(this.definitions)) {
      const [sh, sm] = def.start.split(':').map((n) => Number.parseInt(n, 10))
      const [eh, em] = def.end.split(':').map((n) => Number.parseInt(n, 10))
      const startMinutes = sh * 60 + sm
      const endMinutes = eh * 60 + em
      const within =
        endMinutes < startMinutes
          ? currentMinutes >= startMinutes || currentMinutes <= endMinutes
          : currentMinutes >= startMinutes && currentMinutes <= endMinutes
      if (within) {
        return { key, label: def.label, start: def.start, end: def.end }
      }
    }
    return null
  }

  // ── roster prefill (ported from ShiftRosterPrefillService) ─────────────────

  private async prefillWeek(
    weekStart: DateTime,
    assignedBy: number | null
  ): Promise<{ created: number; skipped: number; week_start: string; week_end: string }> {
    const weekEnd = weekStart.plus({ days: 6 })
    const shiftKeys = Object.keys(this.definitions)

    const { slotProfiles, globalProfiles } = await this.buildHistoricalProfiles(shiftKeys)
    const fallbackStaffIds = await this.shiftStaffIds()

    const existing = await ShiftRoster.query()
      .whereBetween('shift_date', [weekStart.toISODate()!, weekEnd.toISODate()!])
      .select('shift_date', 'shift_type', 'user_id')

    const existingBySlot = new Map<string, Set<number>>()
    for (const row of existing) {
      const key = `${row.shiftDate.toISODate()}|${row.shiftType}`
      if (!existingBySlot.has(key)) existingBySlot.set(key, new Set())
      existingBySlot.get(key)!.add(row.userId)
    }

    let created = 0
    let skipped = 0
    const seed = Number.parseInt(weekStart.toFormat('kkWW'), 10) || 1

    for (let offset = 0; offset < 7; offset++) {
      const day = weekStart.plus({ days: offset })
      const dayKey = day.toISODate()!
      const dayIso = day.weekday

      for (const shiftType of shiftKeys) {
        const slotProfileKey = `${dayIso}|${shiftType}`
        const dateShiftKey = `${dayKey}|${shiftType}`

        const profile = slotProfiles[slotProfileKey] ?? null
        const globalProfile = globalProfiles[shiftType] ?? null

        const targetCount = Math.max(1, profile?.target_count ?? globalProfile?.target_count ?? 1)

        const alreadyAssigned = existingBySlot.get(dateShiftKey) ?? new Set<number>()
        let needed = targetCount - alreadyAssigned.size
        if (needed <= 0) {
          continue
        }

        let candidateIds = profile?.candidate_ids ?? globalProfile?.candidate_ids ?? fallbackStaffIds
        candidateIds = [...new Set(candidateIds)]
        if (candidateIds.length === 0) {
          skipped += needed
          continue
        }

        candidateIds = this.rotateCandidates(candidateIds, this.simpleHash(`${dateShiftKey}|${seed}`))

        if (!existingBySlot.has(dateShiftKey)) existingBySlot.set(dateShiftKey, new Set())
        const slotSet = existingBySlot.get(dateShiftKey)!

        for (const userId of candidateIds) {
          if (slotSet.has(userId)) {
            continue
          }
          await ShiftRoster.create({
            shiftDate: day,
            shiftType,
            userId,
            startTime: this.definitions[shiftType].start,
            endTime: this.definitions[shiftType].end,
            notes: 'Auto-prefilled from historical shift pattern',
            assignedBy,
          })
          slotSet.add(userId)
          created++
          needed--
          if (needed <= 0) {
            break
          }
        }

        if (needed > 0) {
          skipped += needed
        }
      }
    }

    return {
      created,
      skipped,
      week_start: weekStart.toISODate()!,
      week_end: weekEnd.toISODate()!,
    }
  }

  private async buildHistoricalProfiles(shiftKeys: string[]): Promise<{
    slotProfiles: Record<string, { target_count: number; candidate_ids: number[] }>
    globalProfiles: Record<string, { target_count: number; candidate_ids: number[] }>
  }> {
    const reports = await ShiftReport.query()
      .preload('shiftReportStaffAssignments')
      .whereNotNull('report_date')
      .whereIn('shift_type', shiftKeys)
      .orderBy('report_date')

    const slotRaw: Record<string, { counts: number[]; frequency: Map<number, number> }> = {}
    const globalRaw: Record<string, { counts: number[]; frequency: Map<number, number> }> = {}

    for (const report of reports) {
      const shiftType = this.normalizeShiftType(report.shiftType)
      if (!shiftType || !shiftKeys.includes(shiftType) || !report.reportDate) {
        continue
      }
      const staffIds = [
        ...new Set(
          report.shiftReportStaffAssignments.map((a) => a.userId).filter((id): id is number => Boolean(id))
        ),
      ]
      if (staffIds.length === 0) {
        continue
      }
      const dayIso = report.reportDate.weekday
      const slotKey = `${dayIso}|${shiftType}`

      ;(slotRaw[slotKey] ??= { counts: [], frequency: new Map() }).counts.push(staffIds.length)
      ;(globalRaw[shiftType] ??= { counts: [], frequency: new Map() }).counts.push(staffIds.length)

      for (const userId of staffIds) {
        slotRaw[slotKey].frequency.set(userId, (slotRaw[slotKey].frequency.get(userId) ?? 0) + 1)
        globalRaw[shiftType].frequency.set(userId, (globalRaw[shiftType].frequency.get(userId) ?? 0) + 1)
      }
    }

    const slotProfiles: Record<string, { target_count: number; candidate_ids: number[] }> = {}
    for (const [key, raw] of Object.entries(slotRaw)) {
      slotProfiles[key] = { target_count: this.median(raw.counts), candidate_ids: this.orderedCandidates(raw.frequency) }
    }
    const globalProfiles: Record<string, { target_count: number; candidate_ids: number[] }> = {}
    for (const [key, raw] of Object.entries(globalRaw)) {
      globalProfiles[key] = { target_count: this.median(raw.counts), candidate_ids: this.orderedCandidates(raw.frequency) }
    }

    return { slotProfiles, globalProfiles }
  }

  private median(values: number[]): number {
    if (values.length === 0) {
      return 1
    }
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 1) {
      return Math.max(1, sorted[mid])
    }
    return Math.max(1, Math.round((sorted[mid - 1] + sorted[mid]) / 2))
  }

  private orderedCandidates(frequency: Map<number, number>): number[] {
    return [...frequency.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }

  private rotateCandidates(candidateIds: number[], offset: number): number[] {
    const count = candidateIds.length
    if (count <= 1) {
      return candidateIds
    }
    const shift = offset % count
    if (shift === 0) {
      return candidateIds
    }
    return [...candidateIds.slice(shift), ...candidateIds.slice(0, shift)]
  }

  private simpleHash(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0
    }
    return hash
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private resolveWeekStart(input: string): DateTime {
    if (input.trim() !== '') {
      const parsed = DateTime.fromISO(input.trim())
      if (parsed.isValid) {
        return parsed.startOf('week')
      }
    }
    return DateTime.now().startOf('week')
  }

  private weekDays(weekStart: DateTime): DateTime[] {
    return Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }))
  }

  private async shiftStaffIds(): Promise<number[]> {
    const rows = await db
      .from('model_has_roles')
      .join('roles', 'roles.id', 'model_has_roles.role_id')
      .where('roles.name', 'shift-staff')
      .where('model_has_roles.model_type', USER_MORPH_TYPE)
      .select('model_has_roles.model_id as id')
    return rows.map((r) => Number(r.id))
  }

  private async timelineStaffUsers(encounterStaffIds: number[]): Promise<User[]> {
    const shiftStaffIds = await this.shiftStaffIds()
    const ids = [...new Set([...shiftStaffIds, ...encounterStaffIds])]
    if (ids.length === 0) {
      return []
    }
    return User.query().whereIn('id', ids).orderBy('name')
  }

  private mapRoster(row: ShiftRoster) {
    return {
      id: row.id,
      shift_date: row.shiftDate.toISODate(),
      shift_type: row.shiftType,
      user_id: row.userId,
      user: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null,
      assigned_by: row.assignedBy,
      assigned_by_user: row.assignedByUser ? { id: row.assignedByUser.id, name: row.assignedByUser.name } : null,
      start_time: row.startTime,
      end_time: row.endTime,
      notes: row.notes,
    }
  }

  private async count(query: ReturnType<typeof ShiftReport.query>): Promise<number> {
    const result = await query.count('* as total')
    return Number((result[0] as any).$extras.total)
  }
}
