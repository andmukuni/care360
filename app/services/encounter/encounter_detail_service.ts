import { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Encounter from '#models/encounter'

function preloadUserRoles(builder: { preload: (relation: 'roles') => unknown }) {
  builder.preload('roles')
}

export interface EncounterListFilters {
  stage?: string
  status?: string
  priority?: string
  date_from?: string
  date_to?: string
  search?: string
  attendant_type?: string
}

/**
 * Loads an encounter with the related graph needed for the profile page and
 * provides a filtered/paginated index list. Ported from
 * App\Services\Encounter\EncounterDetailService.
 *
 * Note: the Lucid Encounter model exposes plural hasMany relations (e.g.
 * screeningRecords) rather than the singular of-many relations of the Laravel
 * model, and several Laravel nested relations (registrar, nurse, clinician,
 * verifiedBy/releasedBy) are not declared on the current Lucid models. This
 * loader preloads every verified relation; the coordinator can extend the model
 * relation set if the profile page needs the missing nested authors.
 */
export class EncounterDetailService {
  async load(encounter: Encounter): Promise<Encounter> {
    await encounter.load('patient')
    await encounter.load('startedByUser', preloadUserRoles)
    await encounter.load('closedByUser', preloadUserRoles)
    await encounter.load('wardAssignedByUser', preloadUserRoles)
    await encounter.load('ward')

    await encounter.load('registrationRecords')

    await encounter.load('triageRecords', (q) => q.preload('startupMedications'))
    await encounter.load('startupMedications', (q) => {
      q.preload('recordedByUser', preloadUserRoles)
      q.preload('discontinuedByUser', preloadUserRoles)
    })

    await encounter.load('screeningRecords', (q) => {
      q.preload('screeningStaffAssignments', (s) => s.preload('user', preloadUserRoles))
      q.preload('screeningVitalRechecks', (v) => v.preload('recordedByUser', preloadUserRoles))
    })

    await encounter.load('labRequests', (q) => {
      q.preload('requestedByUser', preloadUserRoles)
      q.preload('labRequestItems')
      q.preload('labSamples', (s) => s.preload('collectedByUser', preloadUserRoles))
      q.preload('labResults', (r) => {
        r.preload('labRequestItem')
        r.preload('recordedByUser', preloadUserRoles)
        r.preload('verifiedByUser', preloadUserRoles)
        r.preload('releasedByUser', preloadUserRoles)
      })
    })

    await encounter.load('pharmacyPrescriptions', (q) => {
      q.preload('prescribedByUser', preloadUserRoles)
      q.preload('pharmacyPrescriptionItems')
    })

    await encounter.load('pharmacyDispenses', (q) => {
      q.preload('dispensedByUser', preloadUserRoles)
      q.preload('pharmacyDispenseItems')
    })

    await encounter.load('pharmacyRecommendations', (q) => q.preload('recommendedByUser', preloadUserRoles))

    await encounter.load('bedAssignments', (q) => {
      q.preload('bed')
      q.preload('admittedByUser', preloadUserRoles)
      q.preload('dischargedByUser', preloadUserRoles)
    })
    await encounter.load('dischargeSummaries', (q) => q.preload('authoredByUser', preloadUserRoles))

    await encounter.load('encounterStageLogs', (q) => {
      q.preload('startedByUser', preloadUserRoles)
      q.preload('completedByUser', preloadUserRoles)
    })
    await encounter.load('encounterQueueTransitions', (q) => {
      q.preload('queuedByUser', preloadUserRoles)
      q.preload('receivedByUser', preloadUserRoles)
    })
    await encounter.load('encounterAudits', (q) => q.preload('actionByUser', preloadUserRoles))

    return encounter
  }

  /**
   * Paginated list of encounters with minimal eager loading for the index page.
   * Supports server-side filtering and sorting.
   */
  async list(
    filters: EncounterListFilters = {},
    perPage: number = 25,
    sort: string = 'started',
    direction: string = 'desc',
    page: number = 1
  ): Promise<ModelPaginatorContract<Encounter>> {
    const allowedSorts = [
      'encounter_number',
      'patient',
      'stage',
      'status',
      'priority',
      'started',
      'started_by',
    ]
    const activeSort = allowedSorts.includes(sort) ? sort : 'started'
    const dir = direction.toLowerCase() === 'asc' ? 'asc' : 'desc'

    const query = Encounter.query()
      .preload('patient')
      .preload('startedByUser', preloadUserRoles)
      .preload('registrationRecords')

    if (filters.stage) {
      query.where('encounters.current_stage', filters.stage)
    }
    if (filters.status) {
      query.where('encounters.current_status', filters.status)
    }
    if (filters.priority) {
      query.where('encounters.priority_level', filters.priority)
    }
    if (filters.date_from) {
      query.where(
        'encounters.started_at',
        '>=',
        DateTime.fromISO(filters.date_from).startOf('day').toSQL()!
      )
    }
    if (filters.date_to) {
      query.where(
        'encounters.started_at',
        '<=',
        DateTime.fromISO(filters.date_to).endOf('day').toSQL()!
      )
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => {
        sub
          .where('encounters.encounter_number', 'like', term)
          .orWhereHas('patient', (p) => {
            p.where('full_name', 'like', term)
              .orWhere('patient_id', 'like', term)
              .orWhere('nrc_number', 'like', term)
          })
      })
    }
    if (
      filters.attendant_type &&
      ['first_attendant', 're_attendant'].includes(filters.attendant_type)
    ) {
      const wasExisting = filters.attendant_type === 're_attendant'
      query.whereHas('registrationRecords', (q) => {
        q.where('was_existing_patient', wasExisting)
      })
    }

    let joined = false
    switch (activeSort) {
      case 'patient':
        query.leftJoin('patients', 'encounters.patient_id', 'patients.id')
        query.orderBy('patients.full_name', dir)
        joined = true
        break
      case 'started_by':
        query.leftJoin(
          'users as enc_started_by_users',
          'encounters.started_by',
          'enc_started_by_users.id'
        )
        query.orderBy('enc_started_by_users.name', dir)
        joined = true
        break
      case 'encounter_number':
        query.orderBy('encounters.encounter_number', dir)
        break
      case 'stage':
        query.orderBy('encounters.current_stage', dir)
        break
      case 'status':
        query.orderBy('encounters.current_status', dir)
        break
      case 'priority':
        query.orderBy('encounters.priority_level', dir)
        break
      case 'started':
      default:
        query.orderBy('encounters.started_at', dir)
        break
    }

    if (joined) {
      query.select('encounters.*')
    }

    query.orderBy('encounters.id', 'desc')

    return query.paginate(page, perPage)
  }
}
