import type { Session } from '@adonisjs/session'
import Patient from '#models/patient'
import PatientDependent from '#models/patient_dependent'
import HouseholdMemberService from '#services/portal/household_member_service'
import { abortUnless } from '#services/portal/portal_errors'

/**
 * In-memory fallback store for the mobile API "viewing patient" context.
 *
 * PORT-GAP: Laravel used the Cache facade (Cache::put/get/forget with a 30-day TTL)
 * keyed by access-token id. No cache store is configured in this AdonisJS app, so
 * this Map is a best-effort, single-process stand-in. Replace with a persistent
 * cache (e.g. @adonisjs/cache or a DB table) for multi-process correctness.
 */
const apiViewingStore = new Map<string, number>()

/**
 * Resolves which patient (self or an authorized dependent / household member) a
 * guardian is currently viewing, and enforces view/book permissions.
 *
 * Ported from App\Services\Portal\PatientDependentResolver.
 */
export default class PatientDependentResolver {
  static readonly SESSION_KEY = 'portal_viewing_patient_id'

  private static readonly API_CACHE_PREFIX = 'portal_api_viewing:'

  constructor(private readonly householdMembers: HouseholdMemberService = new HouseholdMemberService()) {}

  // PORT-GAP: the Laravel PatientDependent model exposes a `dependent()` relation
  // (belongsTo Patient via dependent_patient_id) and the Laravel queries `with('dependent')`.
  // The AdonisJS PatientDependent model does NOT declare that relation, so it cannot
  // be eager-loaded here. The dependent-link rows are returned without the nested
  // patient; callers must resolve dependent patients by `dependentPatientId` (or the
  // relation should be added to the model). See resolveDependents() below for a helper.
  async authorizedDependents(guardian: Patient): Promise<PatientDependent[]> {
    return PatientDependent.query()
      .where('guardianPatientId', guardian.id)
      .where('canViewRecords', true)
  }

  /**
   * All dependent links for a guardian, including those still pending hospital approval.
   */
  async allDependentLinks(guardian: Patient): Promise<PatientDependent[]> {
    return PatientDependent.query()
      .where('guardianPatientId', guardian.id)
      .orderBy('createdAt', 'desc')
  }

  /**
   * Helper to resolve the dependent Patient records for a set of links, since the
   * `dependent` relation is not defined on the Lucid model (see PORT-GAP above).
   */
  async resolveDependents(links: PatientDependent[]): Promise<Map<number, Patient>> {
    const ids = links.map((link) => link.dependentPatientId)
    if (ids.length === 0) {
      return new Map()
    }

    const patients = await Patient.query().whereIn('id', ids)

    return new Map(patients.map((patient) => [patient.id, patient]))
  }

  async canViewPatient(guardian: Patient, target: Patient): Promise<boolean> {
    if (Number(guardian.id) === Number(target.id)) {
      return true
    }

    if (await this.hasApprovedDependentLink(guardian, target, 'canViewRecords')) {
      return true
    }

    return this.canManageHouseholdMember(guardian, target)
  }

  async canBookForPatient(guardian: Patient, target: Patient): Promise<boolean> {
    if (Number(guardian.id) === Number(target.id)) {
      return true
    }

    if (await this.hasApprovedDependentLink(guardian, target, 'canBookAppointments')) {
      return true
    }

    return this.canManageHouseholdMember(guardian, target)
  }

  private async hasApprovedDependentLink(
    guardian: Patient,
    target: Patient,
    permission: 'canViewRecords' | 'canBookAppointments'
  ): Promise<boolean> {
    const link = await PatientDependent.query()
      .where('guardianPatientId', guardian.id)
      .where('dependentPatientId', target.id)
      .where(permission, true)
      .first()

    return link !== null
  }

  private canManageHouseholdMember(guardian: Patient, target: Patient): Promise<boolean> {
    return this.householdMembers.canHouseholdHeadViewMemberRecords(guardian, target)
  }

  /**
   * Resolve the patient whose records are being viewed (web session context).
   */
  async viewingPatient(guardian: Patient, session: Session): Promise<Patient> {
    return this.resolveViewingPatient(guardian, session.get(PatientDependentResolver.SESSION_KEY))
  }

  /**
   * Resolve viewing patient for the mobile API (header + token cache fallback).
   */
  async viewingPatientForApi(
    guardian: Patient,
    headerPatientId: number | null,
    tokenId: number | null
  ): Promise<Patient> {
    let viewingId = headerPatientId

    if (viewingId === null && tokenId !== null) {
      viewingId = this.getApiViewingPatientId(tokenId)
    }

    return this.resolveViewingPatient(guardian, viewingId)
  }

  private async resolveViewingPatient(guardian: Patient, viewingId: unknown): Promise<Patient> {
    if (!viewingId || Number(viewingId) === Number(guardian.id)) {
      return guardian
    }

    const dependent = await Patient.find(Number(viewingId))

    if (!dependent || !(await this.canViewPatient(guardian, dependent))) {
      return guardian
    }

    return dependent
  }

  async switchTo(guardian: Patient, target: Patient, session: Session): Promise<void> {
    abortUnless(await this.canViewPatient(guardian, target), 403)

    session.put(PatientDependentResolver.SESSION_KEY, target.id)
  }

  async switchToForApi(guardian: Patient, target: Patient, tokenId: number): Promise<void> {
    abortUnless(await this.canViewPatient(guardian, target), 403)

    this.setApiViewingPatient(tokenId, Number(target.id))
  }

  clearContext(session: Session): void {
    session.forget(PatientDependentResolver.SESSION_KEY)
  }

  clearApiContext(tokenId: number): void {
    apiViewingStore.delete(this.apiCacheKey(tokenId))
  }

  getApiViewingPatientId(tokenId: number): number | null {
    const id = apiViewingStore.get(this.apiCacheKey(tokenId))

    return id !== undefined ? Number(id) : null
  }

  setApiViewingPatient(tokenId: number, patientId: number | null): void {
    if (patientId === null) {
      this.clearApiContext(tokenId)

      return
    }

    apiViewingStore.set(this.apiCacheKey(tokenId), patientId)
  }

  private apiCacheKey(tokenId: number): string {
    return PatientDependentResolver.API_CACHE_PREFIX + tokenId
  }
}
