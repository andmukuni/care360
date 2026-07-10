import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Encounter from '#models/encounter'

/**
 * OPD Register — daily outpatient attendance report. Ported from
 * App\Http\Controllers\OpdRegisterController.
 *
 * Report-only controller: a single `index` action. The Laravel version
 * paginated; here the day's rows are returned in full to the client-side
 * DataTable.
 */
export default class OpdRegisterController {
  // GET /reports/opd-register
  async index({ request, inertia }: HttpContext) {
    const date = String(request.qs().date ?? DateTime.now().toISODate())
    let attendantType = String(request.qs().attendant_type ?? '')
    if (!['first_attendant', 're_attendant'].includes(attendantType)) {
      attendantType = ''
    }

    const dayStart = DateTime.fromISO(date).startOf('day').toSQL()!
    const dayEnd = DateTime.fromISO(date).endOf('day').toSQL()!

    const baseCount = (existing?: boolean) => {
      const q = Encounter.query()
        .where('visit_type', 'OPD')
        .whereBetween('started_at', [dayStart, dayEnd])
      if (existing === undefined) {
        q.has('registrationRecords')
      } else {
        q.whereHas('registrationRecords', (r) => {
          r.where('was_existing_patient', existing)
        })
      }
      return q.count('* as total')
    }

    const [allCount] = await baseCount()
    const [firstCount] = await baseCount(false)
    const [reCount] = await baseCount(true)

    const query = Encounter.query()
      .preload('patient')
      .preload('registrationRecords')
      .preload('triageRecords')
      .where('visit_type', 'OPD')
      .whereBetween('started_at', [dayStart, dayEnd])
      .orderBy('started_at', 'asc')

    if (attendantType === 'first_attendant') {
      query.whereHas('registrationRecords', (r) => {
        r.where('was_existing_patient', false)
      })
    } else if (attendantType === 're_attendant') {
      query.whereHas('registrationRecords', (r) => {
        r.where('was_existing_patient', true)
      })
    } else {
      query.has('registrationRecords')
    }

    const encounters = await query.limit(500)

    return inertia.render('opd-register/index', {
      date,
      attendantType: attendantType || null,
      counts: {
        all: Number((allCount as any).$extras.total),
        first_attendant: Number((firstCount as any).$extras.total),
        re_attendant: Number((reCount as any).$extras.total),
      },
      encounters: encounters.map((e) => {
        const reg = e.registrationRecords?.[0] ?? null
        const triage = e.triageRecords?.[0] ?? null
        return {
          id: e.id,
          encounter_number: e.encounterNumber,
          patient_name: e.patient?.fullName ?? null,
          patient_code: e.patient?.patientId ?? null,
          gender: e.patient?.gender ?? null,
          attendant_type: reg?.attendantType ?? null,
          was_existing_patient: reg?.wasExistingPatient ?? null,
          started_at: e.startedAt?.toFormat('dd LLL yyyy HH:mm') ?? null,
          chief_complaint: triage?.chiefComplaintBrief ?? null,
        }
      }),
    })
  }
}
