import type Encounter from '#models/encounter'
import type TriageRecord from '#models/triage_record'
import PatientBillingService from '#services/portal/patient_billing_service'

export function patientHeaderPatient(encounter: Encounter) {
  const patient = encounter.patient
  if (!patient) return null

  return {
    id: patient.id,
    patient_id: patient.patientId,
    barcode: patient.barcode,
    full_name: patient.fullName,
    gender: patient.gender,
    date_of_birth: patient.dateOfBirth?.toISODate() ?? null,
    phone_number: patient.phoneNumber,
    nrc_number: patient.nrcNumber,
    allergies: patient.allergies,
    membership_plan: null as string | null,
    membership_plan_tier: null as number | null,
    fund_balance: null as string | null,
  }
}

export function patientHeaderEncounter(encounter: Encounter) {
  return {
    encounter_number: encounter.encounterNumber,
    stage: encounter.currentStage,
    priority: encounter.priorityLevel,
    visit_type: encounter.visitType,
    started_at: encounter.startedAt?.toFormat('dd LLL yyyy · HH:mm') ?? null,
    is_locked: encounter.isLocked,
    patient: patientHeaderPatient(encounter),
  }
}

export async function buildPatientHeaderEncounter(encounter: Encounter) {
  const header = patientHeaderEncounter(encounter)
  const patient = encounter.patient
  if (!patient?.id || !header.patient) return header

  const summaries = await new PatientBillingService().membershipSummariesForPatientIds([patient.id])
  const membership = summaries[patient.id]

  return {
    ...header,
    patient: {
      ...header.patient,
      membership_plan: membership?.membership_plan ?? null,
      membership_plan_tier: membership?.membership_plan_tier ?? null,
      fund_balance: membership?.fund_balance ?? null,
    },
  }
}

export function patientHeaderTriage(triage: TriageRecord | null | undefined) {
  if (!triage) return null

  return {
    systolic_bp: triage.systolicBp,
    diastolic_bp: triage.diastolicBp,
    pulse: triage.pulse,
    temperature: triage.temperature,
    oxygen_saturation: triage.oxygenSaturation,
    weight: triage.weight,
    bmi: triage.bmi,
    blood_sugar: triage.bloodSugar,
    respiratory_rate: triage.respiratoryRate,
  }
}

export function serializeTriageRecord(triage: TriageRecord | null | undefined) {
  if (!triage) return null

  return {
    weight: triage.weight,
    height: triage.height,
    bmi: triage.bmi,
    temperature: triage.temperature,
    pulse: triage.pulse,
    respiratory_rate: triage.respiratoryRate,
    systolic_bp: triage.systolicBp,
    diastolic_bp: triage.diastolicBp,
    oxygen_saturation: triage.oxygenSaturation,
    blood_sugar: triage.bloodSugar,
    pain_scale: triage.painScale,
    muac: triage.muac,
    muac_score: triage.muacScore,
    abdominal_circumference: triage.abdominalCircumference,
    chief_complaint_brief: triage.chiefComplaintBrief,
    startup_interventions_notes: triage.startupInterventionsNotes,
    triage_notes: triage.triageNotes,
  }
}
