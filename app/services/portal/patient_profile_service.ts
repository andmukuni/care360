import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Patient from '#models/patient'
import PatientAuditService from '#services/portal/patient_audit_service'

export interface NextOfKinInput {
  next_of_kin_name?: string | null
  next_of_kin_phone?: string | null
  next_of_kin_relationship?: string | null
}

/**
 * Patient-portal profile self-service (contact, next of kin, photo).
 *
 * Ported from App\Services\Portal\PatientProfileService.
 *
 * PORT-GAP:
 *  - updateContact() merges the validated payload directly; unlike Laravel's
 *    snake_case `$patient->update($validated)`, callers must pass Lucid attribute
 *    names (camelCase, e.g. `phoneNumber`, `email`).
 *  - Photos are stored under public/storage/patient-profile-photos/{id} via node
 *    fs (Laravel used Storage::disk('public')). App\Services\Images\ProfilePhotoOptimizer
 *    has no AdonisJS equivalent (no image library installed), so the resize/quality
 *    step is skipped — same limitation as users:compress-profile-photos.
 */
export default class PatientProfileService {
  constructor(private readonly auditService: PatientAuditService = new PatientAuditService()) {}

  async updateContact(patient: Patient, validated: Record<string, any>): Promise<Patient> {
    patient.merge(validated)
    await patient.save()

    await this.auditService.record(patient, 'profile.contact_updated')

    await patient.refresh()

    return patient
  }

  async updateNextOfKin(patient: Patient, validated: NextOfKinInput): Promise<Patient> {
    patient.merge({
      nextOfKinName: validated.next_of_kin_name ?? null,
      nextOfKinPhone: validated.next_of_kin_phone ?? null,
      nextOfKinRelationship: validated.next_of_kin_relationship ?? null,
    })
    await patient.save()

    await this.auditService.record(patient, 'profile.next_of_kin_updated')

    await patient.refresh()

    return patient
  }

  async updatePhoto(patient: Patient, file: MultipartFile): Promise<Patient> {
    await this.deleteStoredPhoto(patient)

    const relativeDir = `patient-profile-photos/${patient.id}`
    const fileName = `${randomUUID()}.${file.extname}`
    await file.move(app.makePath('public/storage', relativeDir), { name: fileName, overwrite: true })

    // PORT-GAP: ProfilePhotoOptimizer::optimizePublicPath(maxEdge: 640, quality: 78)
    // has no AdonisJS equivalent; the uploaded file is stored as-is.
    patient.merge({ profilePhotoPath: `${relativeDir}/${fileName}` })
    await patient.save()

    await this.auditService.record(patient, 'profile.photo_updated')

    await patient.refresh()

    return patient
  }

  async removePhoto(patient: Patient): Promise<Patient> {
    await this.deleteStoredPhoto(patient)
    patient.merge({ profilePhotoPath: null })
    await patient.save()

    await this.auditService.record(patient, 'profile.photo_removed')

    await patient.refresh()

    return patient
  }

  private async deleteStoredPhoto(patient: Patient): Promise<void> {
    if (patient.profilePhotoPath) {
      const absolutePath = app.makePath('public/storage', patient.profilePhotoPath)
      if (existsSync(absolutePath)) {
        await rm(absolutePath, { force: true })
      }
    }
  }
}
