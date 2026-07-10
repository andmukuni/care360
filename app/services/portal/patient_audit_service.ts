import type { Request } from '@adonisjs/core/http'
import Patient from '#models/patient'
import PatientAuditLog from '#models/patient_audit_log'

/**
 * Records patient-portal audit trail entries.
 *
 * Ported from App\Services\Portal\PatientAuditService.
 *
 * PORT-GAP: Laravel defaults `$request` to the global request() helper. AdonisJS
 * has no request global, so callers must pass the HttpContext `request` to capture
 * IP / user-agent; when omitted those columns are stored null.
 */
export default class PatientAuditService {
  async record(
    patient: Patient,
    action: string,
    resourceType: string | null = null,
    resourceId: number | null = null,
    metadata: Record<string, unknown> = {},
    request: Request | null = null
  ): Promise<PatientAuditLog> {
    return PatientAuditLog.create({
      patientId: patient.id,
      action,
      resourceType,
      resourceId,
      ipAddress: request?.ip() ?? null,
      userAgent: request?.header('user-agent') ?? null,
      metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
    })
  }
}
