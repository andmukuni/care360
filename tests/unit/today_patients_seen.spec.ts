import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { todayCalendarRange } from '#support/dashboard/today_patients_seen'

test.group('today_patients_seen', () => {
  test('todayCalendarRange spans midnight to end of day in clinic timezone', ({ assert }) => {
    const now = DateTime.fromISO('2026-08-03T15:30:00', { zone: 'Africa/Lusaka' })
    const { dayStart, dayEnd } = todayCalendarRange('Africa/Lusaka', now)

    assert.equal(dayStart.toISO(), '2026-08-03T00:00:00.000+02:00')
    assert.equal(dayEnd.toISO(), '2026-08-03T23:59:59.999+02:00')
  })

  test('next calendar day starts at midnight', ({ assert }) => {
    const lateNight = DateTime.fromISO('2026-08-03T23:50:00', { zone: 'Africa/Lusaka' })
    const afterMidnight = DateTime.fromISO('2026-08-04T00:10:00', { zone: 'Africa/Lusaka' })

    assert.equal(todayCalendarRange('Africa/Lusaka', lateNight).dayStart.toISODate(), '2026-08-03')
    assert.equal(todayCalendarRange('Africa/Lusaka', afterMidnight).dayStart.toISODate(), '2026-08-04')
  })
})
