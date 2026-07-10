import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import CalendarEvent from '#models/calendar_event'

/**
 * Staff calendar. Ported from App\Http\Controllers\CalendarController.
 *
 * The Laravel views (calendar.index / calendar.manage) rendered a Blade month
 * grid; here index/adminIndex hand the ordered event list plus month metadata
 * to Inertia pages that build the grid client-side. events()/show() keep their
 * JSON shape for the AJAX event-detail widget. The `forMonth` scope is inlined
 * as a date-range filter so it works across DB engines.
 */
const EVENT_TYPES: Record<string, string> = {
  appointment: 'Appointment',
  meeting: 'Meeting',
  reminder: 'Reminder',
  other: 'Other',
}

const TIME_RE = /^\d{2}:\d{2}$/

const eventValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(200),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    event_date: vine.string().trim(),
    start_time: vine.string().trim().regex(TIME_RE).nullable().optional(),
    end_time: vine.string().trim().regex(TIME_RE).nullable().optional(),
    event_type: vine.enum(Object.keys(EVENT_TYPES) as ['appointment', 'meeting', 'reminder', 'other']),
    location: vine.string().trim().maxLength(200).nullable().optional(),
  })
)

function formatEvent(event: CalendarEvent) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    event_date: event.eventDate?.toFormat('yyyy-MM-dd') ?? null,
    start_time: event.startTime,
    end_time: event.endTime,
    event_type: event.eventType,
    location: event.location,
    created_by: event.createdBy,
  }
}

function clampMonth(rawYear: unknown, rawMonth: unknown): { year: number; month: number } {
  let year = Number(rawYear)
  let month = Number(rawMonth)
  if (!Number.isFinite(year)) year = DateTime.now().year
  if (!Number.isFinite(month)) month = DateTime.now().month
  year = Math.max(2000, Math.min(2100, Math.trunc(year)))
  month = Math.max(1, Math.min(12, Math.trunc(month)))
  return { year, month }
}

function monthQuery(year: number, month: number) {
  const start = DateTime.local(year, month, 1).startOf('month')
  const end = start.endOf('month')
  return CalendarEvent.query().whereBetween('event_date', [
    start.toFormat('yyyy-MM-dd'),
    end.toFormat('yyyy-MM-dd'),
  ])
}

export default class CalendarController {
  async index({ auth, request, inertia }: HttpContext) {
    const qs = request.qs()
    const { year, month } = clampMonth(qs.year ?? DateTime.now().year, qs.month ?? DateTime.now().month)

    const current = DateTime.local(year, month, 1)
    const prev = current.minus({ months: 1 })
    const next = current.plus({ months: 1 })

    const events = await monthQuery(year, month).orderBy('event_date').orderBy('start_time')

    const upcoming = await CalendarEvent.query()
      .where('event_date', '>=', DateTime.now().toFormat('yyyy-MM-dd'))
      .orderBy('event_date')
      .orderBy('start_time')
      .limit(8)

    const user = auth.use('web').user!
    const isAdmin = await user.hasRole('super-admin')

    return inertia.render('calendar/index', {
      year,
      month,
      monthLabel: current.toFormat('LLLL yyyy'),
      prev: { year: prev.year, month: prev.month },
      next: { year: next.year, month: next.month },
      events: events.map(formatEvent),
      upcoming: upcoming.map(formatEvent),
      isAdmin,
      eventTypes: EVENT_TYPES,
      currentUserId: user.id,
    })
  }

  async adminIndex({ auth, request, response, inertia }: HttpContext) {
    // Laravel gated this with role:super-admin. Enforced here in-controller
    // since no `role` named middleware exists in the Adonis app.
    const user = auth.use('web').user!
    if (!(await user.hasRole('super-admin'))) {
      return response.forbidden('You are not authorised to manage the calendar.')
    }

    const qs = request.qs()
    const { year, month } = clampMonth(qs.year ?? DateTime.now().year, qs.month ?? DateTime.now().month)
    const type = String(qs.type ?? '')

    const current = DateTime.local(year, month, 1)
    const prev = current.minus({ months: 1 })
    const next = current.plus({ months: 1 })

    const query = monthQuery(year, month)
      .preload('createdByUser', (q) => q.select('id', 'name'))
      .orderBy('event_date')
      .orderBy('start_time')

    if (type) {
      query.where('event_type', type)
    }

    const allEvents = await query

    return inertia.render('calendar/manage', {
      year,
      month,
      monthLabel: current.toFormat('LLLL yyyy'),
      prev: { year: prev.year, month: prev.month },
      next: { year: next.year, month: next.month },
      allEvents: allEvents.map((e) => ({
        ...formatEvent(e),
        creator: e.createdByUser?.name ?? null,
      })),
      eventTypes: EVENT_TYPES,
      type,
    })
  }

  async events({ request, response }: HttpContext) {
    const qs = request.qs()
    const { year, month } = clampMonth(qs.year ?? DateTime.now().year, qs.month ?? DateTime.now().month)

    const events = await monthQuery(year, month).orderBy('event_date').orderBy('start_time')

    return response.json({ events: events.map(formatEvent) })
  }

  async show({ params, response }: HttpContext) {
    const event = await CalendarEvent.findOrFail(params.event)
    return response.json(formatEvent(event))
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.use('web').user!
    const payload = await request.validateUsing(eventValidator)

    const eventDate = DateTime.fromISO(payload.event_date)
    if (!eventDate.isValid) {
      session.flash('error', 'Event date is required.')
      return response.redirect().back()
    }

    if (payload.start_time && payload.end_time && payload.end_time <= payload.start_time) {
      session.flash('error', 'End time must be after start time.')
      return response.redirect().back()
    }

    await CalendarEvent.create({
      title: payload.title,
      description: payload.description ?? null,
      eventDate,
      startTime: payload.start_time ?? null,
      endTime: payload.end_time ?? null,
      eventType: payload.event_type,
      location: payload.location ?? null,
      createdBy: user.id,
    })

    session.flash('success', 'Event created successfully.')
    return response.redirect().toPath(`/calendar?year=${eventDate.year}&month=${eventDate.month}`)
  }

  async update({ auth, params, request, response, session }: HttpContext) {
    const user = auth.use('web').user!
    const event = await CalendarEvent.findOrFail(params.event)
    const isAdmin = await user.hasRole('super-admin')

    if (event.createdBy !== user.id && !isAdmin) {
      return response.forbidden('You are not authorised to edit this event.')
    }

    const payload = await request.validateUsing(eventValidator)

    const eventDate = DateTime.fromISO(payload.event_date)
    if (!eventDate.isValid) {
      session.flash('error', 'Event date is required.')
      return response.redirect().back()
    }

    if (payload.start_time && payload.end_time && payload.end_time <= payload.start_time) {
      session.flash('error', 'End time must be after start time.')
      return response.redirect().back()
    }

    event.merge({
      title: payload.title,
      description: payload.description ?? null,
      eventDate,
      startTime: payload.start_time ?? null,
      endTime: payload.end_time ?? null,
      eventType: payload.event_type,
      location: payload.location ?? null,
    })
    await event.save()

    session.flash('success', 'Event updated.')
    return response.redirect().toPath(`/calendar?year=${event.eventDate.year}&month=${event.eventDate.month}`)
  }

  async destroy({ auth, params, request, response, session }: HttpContext) {
    const user = auth.use('web').user!
    const event = await CalendarEvent.findOrFail(params.event)
    const isAdmin = await user.hasRole('super-admin')

    if (event.createdBy !== user.id && !isAdmin) {
      return response.forbidden('You are not authorised to delete this event.')
    }

    await event.delete()

    if (request.accepts(['html', 'json']) === 'json') {
      return response.json({ deleted: true })
    }

    session.flash('success', 'Event deleted.')
    return response.redirect().toPath('/calendar')
  }
}
