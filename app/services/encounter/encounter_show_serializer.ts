import { DateTime } from 'luxon'
import { EncounterStage, EncounterStageHelper } from '#enums/encounter_stage'
import { EncounterStatus, EncounterStatusHelper } from '#enums/encounter_status'
import Encounter from '#models/encounter'
import PharmacyPrescriptionItem from '#models/pharmacy_prescription_item'
import { serializePrescriptionItem } from '#support/encounter/prescription_item_payload'
import { dedupePrescriptionsByScreeningRecord } from '#services/encounter/encounter_records'
import { serializeLabItemsWithResults } from '#support/encounter/lab_item_payload'
import { reopenEligibility } from '#support/encounter/reopen_encounter_policy'
import User from '#models/user'

type UserBadge = { name: string; role: string | null } | null
type StageProgress = 'done' | 'current' | 'pending'
type TabStatus = 'done' | 'current' | 'empty'

const STAGE_ORDER: EncounterStage[] = [
  EncounterStage.Registration,
  EncounterStage.Triage,
  EncounterStage.Screening,
  EncounterStage.Lab,
  EncounterStage.ScreeningReview,
  EncounterStage.Pharmacy,
  EncounterStage.Completed,
]

const STAGE_STRIP: Array<{ key: EncounterStage; label: string }> = [
  { key: EncounterStage.Registration, label: 'Registration' },
  { key: EncounterStage.Triage, label: 'Triage' },
  { key: EncounterStage.Screening, label: 'Screening' },
  { key: EncounterStage.Lab, label: 'Lab' },
  { key: EncounterStage.ScreeningReview, label: 'Review' },
  { key: EncounterStage.Pharmacy, label: 'Pharmacy' },
  { key: EncounterStage.Completed, label: 'Completed' },
]

const TB_SYMPTOM_LABELS: Record<string, string> = {
  lethargy: 'Lethargy',
  cough: 'Cough',
  fever: 'Fever',
  weight_loss: 'Weight Loss',
  blood_stained_sputum: 'Blood-stained sputum',
  shortness_of_breath: 'Shortness of breath',
  chest_pain: 'Chest Pain',
  night_sweats: 'Night Sweats',
  fatigue: 'Fatigue',
}

const CYCLE_REGULARITY_LABELS: Record<string, string> = {
  regular: 'Regular',
  irregular: 'Irregular',
  absent: 'Absent (Amenorrhoea)',
}

const CONTRACEPTIVE_METHOD_LABELS: Record<string, string> = {
  oral_pill: 'Oral Contraceptive Pill',
  injectable: 'Injectable (e.g. Depo-Provera)',
  implant: 'Implant (e.g. Jadelle / Implanon)',
  iud: 'IUD / Coil',
  condom_male: 'Male Condom',
  condom_female: 'Female Condom',
  natural: 'Natural / Rhythm / LAM',
  sterilisation: 'Sterilisation (Tubal Ligation)',
  none: 'None',
  other: 'Other',
}

const CERVICAL_METHOD_LABELS: Record<string, string> = {
  via: 'VIA (Visual Inspection with Acetic Acid)',
  vili: "VILI (Visual Inspection with Lugol's Iodine)",
  pap_smear: 'Pap Smear (Cervical Cytology)',
  hpv_test: 'HPV DNA Test',
  colposcopy: 'Colposcopy',
  other: 'Other',
}

const CERVICAL_RESULT_LABELS: Record<string, string> = {
  normal: 'Normal',
  abnormal_low_grade: 'Abnormal — Low Grade (CIN 1)',
  abnormal_high_grade: 'Abnormal — High Grade (CIN 2/3)',
  suspicious_cancer: 'Suspicious of Cancer',
  inconclusive: 'Inconclusive / Inadequate Sample',
}

const TAB_ICONS: Record<string, string> = {
  overview:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  registration:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  triage:
    'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  screening:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  lab:
    'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  review: 'M13 10V3L4 14h7v7l9-11h-7z',
  pharmacy:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  workflow: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
}

export class EncounterShowSerializer {
  async serialize(encounter: Encounter) {
    const registrationRecords = [...(encounter.registrationRecords ?? [])].sort((a, b) => a.id - b.id)
    const triageRecords = [...(encounter.triageRecords ?? [])].sort((a, b) => a.id - b.id)
    const screeningRecords = [...(encounter.screeningRecords ?? [])]
    const labRequests = [...(encounter.labRequests ?? [])].sort((a, b) => a.id - b.id)
    const prescriptions = [...(encounter.pharmacyPrescriptions ?? [])].sort((a, b) => a.id - b.id)
    const dispenses = [...(encounter.pharmacyDispenses ?? [])].sort((a, b) => a.id - b.id)
    const recommendations = [...(encounter.pharmacyRecommendations ?? [])].sort((a, b) => a.id - b.id)
    const bedAssignments = [...(encounter.bedAssignments ?? [])].sort((a, b) => a.id - b.id)
    const dischargeSummaries = [...(encounter.dischargeSummaries ?? [])].sort((a, b) => b.id - a.id)
    const stageLogs = [...(encounter.encounterStageLogs ?? [])].sort((a, b) => a.id - b.id)
    const queueTransitions = [...(encounter.encounterQueueTransitions ?? [])].sort((a, b) => a.id - b.id)
    const audits = [...(encounter.encounterAudits ?? [])].sort((a, b) => a.id - b.id)

    const registration = registrationRecords[0] ?? null
    const triage = triageRecords[0] ?? null
    const initialScreening =
      screeningRecords
        .filter((record) => record.screeningType === 'initial')
        .sort((a, b) => b.id - a.id)[0] ?? null
    const reviewScreening =
      screeningRecords
        .filter((record) => record.screeningType === 'review_after_lab')
        .sort((a, b) => b.id - a.id)[0] ?? null
    const displayPrescriptions = dedupePrescriptionsByScreeningRecord(prescriptions)
    const screeningPrescriptions = initialScreening
      ? displayPrescriptions.filter(
          (prescription) => prescription.screeningRecordId === initialScreening.id
        )
      : []
    const lab = labRequests[0] ?? null
    const latestPrescription = prescriptions[prescriptions.length - 1] ?? null
    const latestDispense = dispenses[dispenses.length - 1] ?? null
    const dischargeSummary = dischargeSummaries[0] ?? null

    const userLookup = await this.getUserLookup([
      registration?.registrarId ?? null,
      triage?.nurseId ?? null,
      initialScreening?.clinicianId ?? null,
      reviewScreening?.clinicianId ?? null,
      encounter.wardAssignedBy ?? null,
    ])

    const recommendationItemLookup = await this.getRecommendationItemLookup(recommendations)

    const patient = encounter.patient
    const patientInitials = this.initials(patient?.fullName ?? 'PA')
    const wasExisting = registration?.wasExistingPatient
    const attendantLabel =
      wasExisting === null || wasExisting === undefined
        ? null
        : wasExisting
          ? 'Re-attendant'
          : 'First Attendant'

    const currentStage = encounter.currentStage
    const currentStatus = encounter.currentStatus

    const labResults = [...(lab?.labResults ?? [])]
    const labCritical = labResults.filter((item) => item.interpretation === 'critical').length
    const labAbnormal = labResults.filter((item) => item.interpretation === 'abnormal').length
    const labNormal = labResults.filter((item) => item.interpretation === 'normal').length
    const labItems = lab
      ? serializeLabItemsWithResults(lab, {
          formatDate: (value, format) => this.formatDate(value, format),
          userBadge: (user) => this.userBadge(user),
        })
      : []
    const startupMedications = this.serializeStartupMedications(encounter)

    const stageStrip = STAGE_STRIP.map((stage) => ({
      key: stage.key,
      label: stage.label,
      status: this.stageStatus(stage.key, currentStage),
    }))

    const tabs = [
      { id: 'overview', label: 'Overview', status: 'done' as TabStatus, icon: TAB_ICONS.overview },
      {
        id: 'registration',
        label: 'Registration',
        status: registration ? 'done' : 'empty',
        icon: TAB_ICONS.registration,
      },
      { id: 'triage', label: 'Triage', status: triage ? 'done' : 'empty', icon: TAB_ICONS.triage },
      {
        id: 'screening',
        label: 'Screening',
        status: initialScreening ? 'done' : 'empty',
        icon: TAB_ICONS.screening,
      },
      {
        id: 'lab',
        label: 'Lab',
        status: lab ? (lab.status === 'completed' ? 'done' : 'current') : 'empty',
        icon: TAB_ICONS.lab,
      },
      { id: 'review', label: 'Review', status: reviewScreening ? 'done' : 'empty', icon: TAB_ICONS.review },
      {
        id: 'pharmacy',
        label: 'Pharmacy',
        status: prescriptions.length ? (dispenses.length ? 'done' : 'current') : 'empty',
        icon: TAB_ICONS.pharmacy,
      },
      {
        id: 'workflow',
        label: 'Workflow',
        status: stageLogs.length ? 'done' : 'empty',
        icon: TAB_ICONS.workflow,
      },
    ]

    const screeningComplaintSections = this.compactEntries([
      { label: 'Complaints', value: initialScreening?.complaints },
      { label: 'History of Illness', value: initialScreening?.historyOfPresentingIllness },
      {
        label: 'Past Medical History',
        value: this.decodePastMedicalHistory(initialScreening?.pastMedicalHistory),
      },
      { label: 'Medication History', value: initialScreening?.medicationHistory },
      { label: 'Allergy History', value: this.decodeAllergyHistory(initialScreening?.allergyHistory) },
      {
        label: 'Chronic Conditions',
        value: this.decodeChronicConditions(initialScreening?.chronicConditions),
      },
      { label: 'Family History', value: this.decodeFamilyHistory(initialScreening?.familyHistory) },
      { label: 'Social History', value: this.decodeSocialHistory(initialScreening?.socialHistory) },
      {
        label: 'Review of Systems',
        value: this.decodeClinical(initialScreening?.reviewOfSystems),
      },
      { label: 'Constitutional Symptoms', value: initialScreening?.constitutionalSymptoms },
    ])

    const screeningExamSections = this.compactEntries([
      { label: 'Clinical Findings', value: this.decodeClinical(initialScreening?.clinicalFindings) },
      {
        label: 'Physical Examination',
        value: this.decodePhysicalExamination(initialScreening?.physicalExamination),
      },
      { label: 'Provisional Diagnosis', value: this.decodeDx(initialScreening?.provisionalDiagnosis) },
      { label: 'Final Diagnosis', value: this.decodeDx(initialScreening?.finalDiagnosis) },
      { label: 'Assessment Notes', value: initialScreening?.assessmentNotes },
      { label: 'Management Plan', value: initialScreening?.plan },
      { label: 'Treatment Plan', value: initialScreening?.treatmentPlan },
    ])

    const reviewSections = this.compactEntries([
      { label: 'Review of Systems', value: this.decodeClinical(reviewScreening?.clinicalFindings) },
      { label: 'Physical Examination', value: reviewScreening?.physicalExamination },
      { label: 'Assessment Notes', value: reviewScreening?.assessmentNotes },
      { label: 'Treatment Plan', value: reviewScreening?.plan },
      { label: 'Review Notes', value: reviewScreening?.reviewNotes },
    ])

    const tbSymptoms = this.mapTbSymptomLabels(this.parseJsonishList(initialScreening?.tbSymptoms ?? null))

    const screeningHandover = queueTransitions
      .filter(
        (transition) =>
          transition.fromStage === EncounterStage.Screening &&
          (transition.toStage === EncounterStage.Lab ||
            transition.toStage === EncounterStage.Pharmacy ||
            transition.toStage === EncounterStage.Triage)
      )
      .sort((a, b) => b.id - a.id)[0]
    const paedItems = this.compactEntries([
      {
        label: 'Birth Weight',
        value: initialScreening?.birthWeight !== null ? `${initialScreening?.birthWeight} kg` : null,
      },
      {
        label: 'Birth Length',
        value: initialScreening?.birthLength !== null ? `${initialScreening?.birthLength} cm` : null,
      },
      {
        label: 'Head Circumference',
        value:
          initialScreening?.headCircumference !== null
            ? `${initialScreening?.headCircumference} cm`
            : null,
      },
      {
        label: 'Chest Circumference',
        value:
          initialScreening?.chestCircumference !== null
            ? `${initialScreening?.chestCircumference} cm`
            : null,
      },
      { label: 'General Condition', value: initialScreening?.generalCondition },
      { label: 'Birth Outcome', value: initialScreening?.birthOutcome },
      { label: 'Delivery Time', value: initialScreening?.deliveryTime },
      {
        label: 'Breastfeeding Well',
        value: this.formatTriBool(initialScreening?.isBreastFeedingWell),
      },
      { label: 'Other Feeding Option', value: initialScreening?.otherFeedingOption },
      { label: 'Vaccination Outside', value: initialScreening?.vaccinationOutside },
      { label: 'Tetanus At Birth', value: initialScreening?.tetanusAtBirth },
      { label: 'Feeding Code', value: initialScreening?.feedingCode },
      { label: 'Feeding Comments', value: initialScreening?.feedingComments },
      {
        label: 'Immunization History',
        value: this.decodeImmunizationHistory(initialScreening?.immunizationHistory),
      },
      {
        label: 'Development History',
        value: this.decodeDevelopmentHistory(initialScreening?.developmentHistory),
      },
      { label: 'Birth Notes', value: initialScreening?.birthNotes },
    ])

    const obstetricsItems = this.compactEntries([
      {
        label: 'Cycle Regularity',
        value: this.mapEnumLabel(initialScreening?.menstrualCycleRegularity, CYCLE_REGULARITY_LABELS),
      },
      {
        label: 'Cycle Length',
        value: initialScreening?.cycleLengthDays !== null ? `${initialScreening?.cycleLengthDays} days` : null,
      },
      {
        label: 'Flow Duration',
        value:
          initialScreening?.durationOfFlowDays !== null
            ? `${initialScreening?.durationOfFlowDays} days`
            : null,
      },
      { label: 'Last Menstrual Period', value: this.formatDate(initialScreening?.lastMenstrualPeriod, 'dd LLL yyyy') },
      { label: 'Dysmenorrhoea', value: this.formatTriBool(initialScreening?.dysmenorrhoea) },
      {
        label: 'Intermenstrual Bleeding',
        value: this.formatTriBool(initialScreening?.intermenstrualBleeding),
      },
      { label: 'Post-coital Bleeding', value: this.formatTriBool(initialScreening?.postCoitalBleeding) },
      { label: 'Menstrual Notes', value: initialScreening?.menstrualNotes },
      { label: 'Gravida', value: this.text(initialScreening?.gravida) },
      { label: 'Para', value: this.text(initialScreening?.para) },
      { label: 'Abortus', value: this.text(initialScreening?.abortus) },
      { label: 'Living Children', value: this.text(initialScreening?.livingChildren) },
      { label: 'Currently Pregnant', value: this.formatTriBool(initialScreening?.currentlyPregnant) },
      {
        label: 'Expected Delivery Date',
        value: this.formatDate(initialScreening?.expectedDeliveryDate, 'dd LLL yyyy'),
      },
      {
        label: 'Previous Obstetric Complications',
        value: initialScreening?.previousObstetricComplications,
      },
      { label: 'Obstetrics Notes', value: initialScreening?.obstetricsNotes },
      { label: 'Using Contraception', value: this.formatTriBool(initialScreening?.usingContraception) },
      {
        label: 'Contraceptive Method',
        value: this.mapEnumLabel(initialScreening?.contraceptiveMethod, CONTRACEPTIVE_METHOD_LABELS),
      },
      {
        label: 'Contraceptive Method (Other)',
        value: initialScreening?.contraceptiveMethodOther,
      },
      {
        label: 'Contraceptive Duration',
        value:
          initialScreening?.contraceptiveDurationMonths !== null
            ? `${initialScreening?.contraceptiveDurationMonths} months`
            : null,
      },
      {
        label: 'Previous Contraceptive Methods',
        value: initialScreening?.previousContraceptiveMethods,
      },
      { label: 'Contraceptive Notes', value: initialScreening?.contraceptiveNotes },
      {
        label: 'Cervical Screening Done',
        value: this.formatTriBool(initialScreening?.cervicalScreeningDone),
      },
      {
        label: 'Cervical Screening Date',
        value: this.formatDate(initialScreening?.cervicalScreeningDate, 'dd LLL yyyy'),
      },
      {
        label: 'Cervical Screening Method',
        value: this.mapEnumLabel(
          initialScreening?.cervicalScreeningMethod,
          CERVICAL_METHOD_LABELS
        ),
      },
      {
        label: 'Cervical Screening Result',
        value: this.mapEnumLabel(initialScreening?.cervicalScreeningResult, CERVICAL_RESULT_LABELS),
      },
      {
        label: 'Cervical Screening Result Notes',
        value: initialScreening?.cervicalScreeningResultNotes,
      },
      {
        label: 'Cervical Treatment Done',
        value: this.formatTriBool(initialScreening?.cervicalTreatmentDone),
      },
      { label: 'Cervical Treatment Type', value: initialScreening?.cervicalTreatmentType },
      { label: 'Cervical Cancer Notes', value: initialScreening?.cervicalCancerNotes },
    ])

    return {
      id: encounter.id,
      encounter_number: encounter.encounterNumber,
      current_stage: currentStage,
      current_status: currentStatus,
      current_stage_label: EncounterStageHelper.label(currentStage),
      current_status_label: EncounterStatusHelper.label(currentStatus as EncounterStatus),
      is_locked: encounter.isLocked,
      can_reopen: reopenEligibility(encounter).allowed,
      hero: {
        initials: patientInitials,
        patient_name: patient?.fullName ?? 'Unknown Patient',
        patient_id: patient?.patientId ?? '—',
        gender: this.ucFirst(patient?.gender ?? '—'),
        birth_label:
          patient?.dateOfBirth && this.age(patient.dateOfBirth) !== null
            ? `${patient.dateOfBirth.toFormat('dd LLL yyyy')} (${this.age(patient.dateOfBirth)} yrs)`
            : '—',
        phone: patient?.phoneNumber ?? null,
        nrc: patient?.nrcNumber ?? null,
        badges: {
          encounter_number: encounter.encounterNumber,
          lock: encounter.isLocked ? '🔒 Locked' : '🟢 Open',
          lock_class: encounter.isLocked ? 'b-red' : 'b-green',
          visit_type: this.ucFirst(encounter.visitType ?? 'OPD'),
          attendant_label: attendantLabel,
          attendant_class: wasExisting ? 'b-amber' : 'b-blue',
          priority:
            encounter.priorityLevel && encounter.priorityLevel !== 'normal'
              ? `⚡ ${this.ucFirst(encounter.priorityLevel)}`
              : null,
          stage: this.ucFirst((currentStage ?? '').replaceAll('_', ' ')),
        },
        started_date: this.formatDate(encounter.startedAt, 'dd LLL yyyy'),
        started_time: this.formatDate(encounter.startedAt, 'HH:mm'),
        closed_at: this.formatDate(encounter.closedAt),
      },
      stageStrip,
      tabs,
      startup_medications: startupMedications,
      overview: {
        patient: patient
          ? {
              full_name: patient.fullName,
              patient_id: patient.patientId,
              gender: this.ucFirst(patient.gender ?? '—'),
              date_of_birth: this.formatDate(patient.dateOfBirth, 'dd LLL yyyy') ?? '—',
              age: this.age(patient.dateOfBirth) !== null ? `${this.age(patient.dateOfBirth)} years` : '—',
              phone: patient.phoneNumber ?? '—',
              nrc: patient.nrcNumber ?? '—',
            }
          : null,
        encounter: {
          encounter_number: encounter.encounterNumber,
          visit_type: encounter.visitType ?? '—',
          priority: this.ucFirst(encounter.priorityLevel ?? 'normal'),
          current_stage: this.ucFirst((currentStage ?? '').replaceAll('_', ' ')),
          status: this.ucFirst((currentStatus ?? '—').replaceAll('_', ' ')),
          started_by: this.userBadge(encounter.startedByUser),
          started_at: this.formatDate(encounter.startedAt),
          closed_at: this.formatDate(encounter.closedAt) ?? 'Still Open',
          closure_notes: encounter.closureNotes,
        },
        summary_items: [
          {
            label: 'Registration',
            ok: !!registration,
            detail: registration ? this.formatDate(registration.registeredAt, 'dd LLL HH:mm') : 'Not recorded',
          },
          {
            label: 'Triage',
            ok: !!triage,
            detail: triage
              ? `BP ${
                  triage.systolicBp && triage.diastolicBp ? `${triage.systolicBp}/${triage.diastolicBp}` : '—'
                } · Temp ${triage.temperature ? `${triage.temperature}°C` : '—'}`
              : 'Not recorded',
          },
          {
            label: 'Startup Medications',
            ok: startupMedications.length > 0,
            detail:
              startupMedications.length > 0
                ? `${startupMedications.length} med(s) · ${startupMedications.filter((med) => med.administration_status === 'administered').length} administered`
                : 'None recorded',
          },
          {
            label: 'Initial Screening',
            ok: !!initialScreening,
            detail: initialScreening
              ? this.decodeDx(initialScreening.provisionalDiagnosis) || 'Provisional Dx not set'
              : 'Not recorded',
          },
          {
            label: 'Lab',
            ok: !!lab,
            detail: lab
              ? `${this.ucFirst(lab.status)} · ${
                  labCritical ? `${labCritical} critical` : labAbnormal ? `${labAbnormal} abnormal` : labNormal ? 'All normal' : 'No results'
                }`
              : 'Not requested',
          },
          {
            label: 'Screening Review',
            ok: !!reviewScreening,
            detail: reviewScreening
              ? this.decodeDx(reviewScreening.finalDiagnosis) || 'Final Dx not recorded'
              : 'Not completed',
          },
          {
            label: 'Prescription',
            ok: !!latestPrescription,
            detail: latestPrescription
              ? `${latestPrescription.prescriptionNumber} · ${latestPrescription.pharmacyPrescriptionItems?.length ?? 0} item(s)`
              : 'Not issued',
          },
          {
            label: 'Dispense',
            ok: !!latestDispense,
            detail: latestDispense
              ? `Dispensed ${this.formatDate(latestDispense.dispensedAt, 'dd LLL HH:mm')}`
              : 'Not dispensed',
          },
        ],
        admission: {
          ward: encounter.ward
            ? {
                name: encounter.ward.name,
                assigned_at: this.formatDate(encounter.wardAssignedAt),
                assigned_by: this.userBadge(
                  encounter.wardAssignedByUser ??
                    userLookup.get(encounter.wardAssignedBy ?? -1) ??
                    null
                ),
              }
            : null,
          bed_assignments: bedAssignments.map((assignment) => ({
            id: assignment.id,
            bed: assignment.bed?.bedNumber ?? '—',
            admitted_at: this.formatDate(assignment.admittedAt),
            admitted_by: this.userBadge(assignment.admittedByUser),
            discharged_at: this.formatDate(assignment.dischargedAt) ?? 'Still admitted',
            discharged_by: this.userBadge(assignment.dischargedByUser),
            notes: assignment.notes ?? '—',
          })),
          discharge_summary: dischargeSummary
            ? {
                title: dischargeSummary.title,
                summary: dischargeSummary.summary,
                authored_by: this.userBadge(dischargeSummary.authoredByUser),
                discharged_at: this.formatDate(dischargeSummary.dischargedAt),
              }
            : null,
        },
      },
      registration: registration
        ? {
            registrar: this.userBadge(
              userLookup.get(registration.registrarId) ?? (registration.registrarId ? `User #${registration.registrarId}` : null)
            ),
            registered_at: this.formatDate(registration.registeredAt),
            attendant_status: registration.wasExistingPatient ? 'Re-attendant' : 'First Attendant',
            registration_notes: registration.registrationNotes,
          }
        : null,
      triage: triage
        ? {
            triage_at: this.formatDate(triage.triageAt),
            nurse: this.userBadge(
              userLookup.get(triage.nurseId) ?? (triage.nurseId ? `User #${triage.nurseId}` : null)
            ),
            vitals: {
              systolic_bp: triage.systolicBp,
              diastolic_bp: triage.diastolicBp,
              pulse: triage.pulse,
              temperature: triage.temperature,
              oxygen_saturation: triage.oxygenSaturation,
              respiratory_rate: triage.respiratoryRate,
              blood_sugar: triage.bloodSugar,
              weight: triage.weight,
              height: triage.height,
              bmi: triage.bmi,
              pain_scale: triage.painScale,
              muac: triage.muac,
              muac_score: triage.muacScore,
              abdominal_circumference: triage.abdominalCircumference,
            },
            chief_complaint_brief: triage.chiefComplaintBrief,
            startup_interventions_notes: triage.startupInterventionsNotes,
            startup_medications_notes: triage.startupMedicationsNotes,
            triage_notes: triage.triageNotes,
            startup_medications: startupMedications,
          }
        : null,
      screening: initialScreening
        ? {
            screening_type: initialScreening.screeningType,
            clinician: this.userBadge(
              userLookup.get(initialScreening.clinicianId) ??
                (initialScreening.clinicianId ? `User #${initialScreening.clinicianId}` : null)
            ),
            lab_requested: initialScreening.labRequested,
            prescribed: initialScreening.prescribed,
            screening_started_at: this.formatDate(initialScreening.screeningStartedAt),
            screening_completed_at: this.formatDate(initialScreening.screeningCompletedAt),
            complaint_sections: screeningComplaintSections,
            exam_sections: screeningExamSections,
            tb: {
              symptoms: tbSymptoms,
              presumptive_tb_case_no: initialScreening.presumptiveTbCaseNo,
            },
            paed_items: paedItems,
            obstetrics_items: obstetricsItems,
            vital_rechecks: [...(initialScreening.screeningVitalRechecks ?? [])].map((recheck) => ({
              id: recheck.id,
              when: this.formatDate(recheck.createdAt),
              weight: recheck.weight,
              height: recheck.height,
              bp_systolic: recheck.bpSystolic,
              bp_diastolic: recheck.bpDiastolic,
              pulse: recheck.pulse,
              temperature: recheck.temperature,
              spo2: recheck.spo2,
              recorded_by: this.userBadge(recheck.recordedByUser),
              notes: recheck.notes,
            })),
            staff_assignments: [...(initialScreening.screeningStaffAssignments ?? [])].map((assignment) => ({
              id: assignment.id,
              user: this.userBadge(assignment.user),
              role_name: assignment.roleName,
              participation_type: assignment.participationType,
              notes: assignment.notes,
            })),
            handover_notes: screeningHandover?.transitionNotes ?? null,
            prescriptions: screeningPrescriptions.map((prescription) => ({
              id: prescription.id,
              prescription_number: prescription.prescriptionNumber,
              status: prescription.status,
              notes: prescription.notes,
              prescribed_by: this.userBadge(prescription.prescribedByUser),
              prescribed_at: this.formatDate(prescription.prescribedAt),
              items: [...(prescription.pharmacyPrescriptionItems ?? [])].map(serializePrescriptionItem),
            })),
            lab_request: lab
              ? {
                  request_number: lab.requestNumber,
                  status: lab.status,
                  priority_level: lab.priorityLevel ?? 'Normal',
                  request_notes: lab.requestNotes,
                  requested_by: this.userBadge(lab.requestedByUser),
                  requested_at: this.formatDate(lab.requestedAt),
                  items: labItems,
                }
              : null,
          }
        : null,
      lab: lab
        ? {
            request_number: lab.requestNumber,
            status: lab.status,
            priority_level: lab.priorityLevel ?? 'Normal',
            requested_by: this.userBadge(lab.requestedByUser),
            requested_at: this.formatDate(lab.requestedAt),
            completed_at: this.formatDate(lab.completedAt),
            request_notes: lab.requestNotes,
            critical_count: labCritical,
            abnormal_count: labAbnormal,
            normal_count: labNormal,
            card_theme: labCritical > 0 ? 'critical' : labAbnormal > 0 ? 'abnormal' : 'normal',
            items: labItems,
            samples: [...(lab.labSamples ?? [])].map((sample) => ({
              id: sample.id,
              sample_type: sample.sampleType,
              sample_label: sample.sampleLabel,
              collected_by: this.userBadge(sample.collectedByUser),
              collected_at: this.formatDate(sample.collectedAt),
            })),
          }
        : null,
      review: reviewScreening
        ? {
            clinician: this.userBadge(
              userLookup.get(reviewScreening.clinicianId) ??
                (reviewScreening.clinicianId ? `User #${reviewScreening.clinicianId}` : null)
            ),
            prescribed: reviewScreening.prescribed,
            final_diagnosis: this.decodeDx(reviewScreening.finalDiagnosis),
            sections: reviewSections,
          }
        : null,
      pharmacy: {
        prescriptions: latestPrescription
          ? [
              {
                id: latestPrescription.id,
                prescription_number: latestPrescription.prescriptionNumber,
                status: latestPrescription.status,
                notes: latestPrescription.notes,
                prescribed_by: this.userBadge(latestPrescription.prescribedByUser),
                prescribed_at: this.formatDate(latestPrescription.prescribedAt),
                items: [...(latestPrescription.pharmacyPrescriptionItems ?? [])].map(
                  serializePrescriptionItem
                ),
              },
            ]
          : [],
        dispenses: dispenses.map((dispense) => ({
          id: dispense.id,
          dispensing_notes: dispense.dispensingNotes,
          counseling_notes: dispense.counselingNotes,
          dispensed_by: this.userBadge(dispense.dispensedByUser),
          dispensed_at: this.formatDate(dispense.dispensedAt),
          items: [...(dispense.pharmacyDispenseItems ?? [])].map((item) => ({
            id: item.id,
            drug_name: item.drugName,
            quantity_dispensed: item.quantityDispensed,
            batch_no: item.batchNo,
            instructions: item.instructions,
          })),
        })),
        recommendations: recommendations.map((recommendation) => ({
          id: recommendation.id,
          original_drug:
            recommendationItemLookup.get(recommendation.sourcePrescriptionItemId) ?? '—',
          recommended_drug:
            recommendationItemLookup.get(recommendation.recommendedPrescriptionItemId ?? -1) ?? '—',
          status: recommendation.status,
          recommendation_note: recommendation.recommendationNote,
          recommended_by: this.userBadge(recommendation.recommendedByUser),
        })),
      },
      workflow: {
        stage_logs: stageLogs.map((log) => ({
          id: log.id,
          stage_name: log.stageName,
          status: log.status,
          started_at: this.formatDate(log.startedAt),
          started_by: this.userBadge(log.startedByUser),
          completed_at: this.formatDate(log.completedAt),
          completed_by: this.userBadge(log.completedByUser),
          notes: log.notes,
          stage_url: this.stageUrl(log.stageName, encounter.id),
        })),
        queue_transitions: queueTransitions.map((transition) => ({
          id: transition.id,
          from_stage: transition.fromStage,
          to_stage: transition.toStage,
          status: transition.status,
          queued_by: this.userBadge(transition.queuedByUser),
          queued_at: this.formatDate(transition.queuedAt, 'dd LLL HH:mm'),
          received_by: this.userBadge(transition.receivedByUser),
          received_at: this.formatDate(transition.receivedAt, 'dd LLL HH:mm'),
          transition_notes: transition.transitionNotes,
          returned_to_screening:
            transition.fromStage === EncounterStage.Pharmacy &&
            transition.toStage === EncounterStage.Screening,
        })),
        audits: audits.map((audit) => ({
          id: audit.id,
          action_name: audit.actionName,
          action_stage: audit.actionStage,
          action_by: this.userBadge(audit.actionByUser),
          action_at: this.formatDate(audit.actionAt, 'dd LLL HH:mm'),
          notes: audit.notes,
        })),
      },
    }
  }

  private userBadge(userOrName: User | string | null | undefined): UserBadge {
    if (!userOrName) return null

    if (typeof userOrName === 'string') {
      const name = userOrName.trim()
      return name ? { name, role: null } : null
    }

    const name = userOrName.name?.trim()
    if (!name) return null

    const roleName = userOrName.roles?.[0]?.name
    return {
      name,
      role: roleName ? this.formatRole(roleName) : 'Staff',
    }
  }

  private formatRole(name: string) {
    const labels: Record<string, string> = {
      'super-admin': 'Super Admin',
      'registration-clerk': 'Registration Clerk',
      'ward-nurse': 'Ward Nurse',
    }

    return (
      labels[name] ??
      name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    )
  }

  private formatDate(value: DateTime | null | undefined, format: string = 'dd LLL yyyy HH:mm') {
    return value ? value.toFormat(format) : null
  }

  private text(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === '') return null
    return String(value)
  }

  private ucFirst(value: string) {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  private age(value: DateTime | null | undefined) {
    if (!value) return null
    const years = Math.floor(DateTime.now().diff(value, 'years').years)
    return years >= 0 ? years : null
  }

  private initials(fullName: string) {
    return fullName
      .split(' ')
      .map((word) => word.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
  }

  private stageStatus(stage: EncounterStage, currentStage: EncounterStage): StageProgress {
    const currentIndex = STAGE_ORDER.indexOf(currentStage)
    const stageIndex = STAGE_ORDER.indexOf(stage)
    if (stageIndex === -1 || currentIndex === -1) return 'pending'
    if (stageIndex < currentIndex) return 'done'
    if (stageIndex === currentIndex) return 'current'
    return 'pending'
  }

  private stageUrl(stageName: string, encounterId: number) {
    const routes: Record<string, string> = {
      registration: `/registration/encounters/${encounterId}`,
      triage: `/triage/${encounterId}`,
      screening: `/screening/${encounterId}`,
      lab: `/lab/${encounterId}`,
      screening_review: `/screening-review/${encounterId}`,
      pharmacy: `/pharmacy/${encounterId}`,
    }
    return routes[stageName] ?? null
  }

  private async getUserLookup(userIds: Array<number | null | undefined>) {
    const ids = [
      ...new Set(
        userIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
      ),
    ]
    if (!ids.length) return new Map<number, User>()

    const users = await User.query().whereIn('id', ids).preload('roles')
    const lookup = new Map<number, User>()
    for (const user of users) {
      lookup.set(user.id, user)
    }
    return lookup
  }

  private async getRecommendationItemLookup(recommendations: Array<{ sourcePrescriptionItemId: number; recommendedPrescriptionItemId: number | null }>) {
    const ids = new Set<number>()
    for (const recommendation of recommendations) {
      if (recommendation.sourcePrescriptionItemId) {
        ids.add(recommendation.sourcePrescriptionItemId)
      }
      if (recommendation.recommendedPrescriptionItemId) {
        ids.add(recommendation.recommendedPrescriptionItemId)
      }
    }
    if (!ids.size) return new Map<number, string>()

    const items = await PharmacyPrescriptionItem.query().whereIn('id', [...ids])
    const lookup = new Map<number, string>()
    for (const item of items) {
      lookup.set(item.id, item.drugName)
    }
    return lookup
  }

  private decodeDx(raw: string | null | undefined): string {
    if (!raw) return ''
    let decoded: unknown = null
    try {
      decoded = JSON.parse(raw)
    } catch {
      return raw
    }
    if (!Array.isArray(decoded)) return raw

    const labels = decoded
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return String(entry ?? '').trim()
        }
        const value = entry as Record<string, unknown>
        let label = this.asString(value.path)
        if (!label) {
          label = [value.level1, value.level2, value.level3]
            .map((part) => this.asString(part))
            .filter(Boolean)
            .join(' › ')
        }
        const extras = [this.asString(value.certainty), this.asString(value.attendance)].filter(Boolean)
        if (extras.length) {
          label = `${label} (${extras.join(', ')})`
        }
        return label || this.asString(value.type)
      })
      .filter(Boolean)

    return labels.join(' · ')
  }

  private decodeClinical(raw: string | null | undefined): string {
    if (!raw) return ''
    let decoded: unknown = null
    try {
      decoded = JSON.parse(raw)
    } catch {
      return raw
    }
    if (!Array.isArray(decoded)) return raw

    return decoded
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return String(entry ?? '').trim()
        }
        const value = entry as Record<string, unknown>
        const system = this.asString(value.system)
        const notes = this.asString(value.notes)
        if (system && notes) return `${system}: ${notes}`
        return system || notes
      })
      .filter(Boolean)
      .join('\n')
  }

  private parseJsonishList(raw: string | null): string[] {
    if (!raw) return []
    try {
      const decoded = JSON.parse(raw) as unknown
      return this.flattenList(decoded)
    } catch {
      return [raw].filter(Boolean)
    }
  }

  private flattenList(input: unknown): string[] {
    if (Array.isArray(input)) {
      return input.flatMap((item) => this.flattenList(item))
    }
    const value = this.asString(input)
    return value ? [value] : []
  }

  private asString(value: unknown) {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
  }

  private compactEntries(entries: Array<{ label: string; value: string | null | undefined }>) {
    return entries.filter((entry) => !!entry.value)
  }

  private formatTriBool(value: boolean | null | undefined): string | null {
    if (value === null || value === undefined) return null
    return value ? 'Yes' : 'No'
  }

  private mapEnumLabel(value: string | null | undefined, labels: Record<string, string>): string | null {
    if (!value) return null
    return labels[value] ?? this.ucFirst(value.replaceAll('_', ' '))
  }

  private mapTbSymptomLabels(symptoms: string[]): string[] {
    return symptoms.map((symptom) => TB_SYMPTOM_LABELS[symptom] ?? this.ucFirst(symptom.replaceAll('_', ' ')))
  }

  private decodePastMedicalHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw

    const value = parsed as Record<string, unknown>
    const parts = [
      value.drug_history ? `Drug history: ${this.asString(value.drug_history)}` : '',
      value.admission_history ? `Admission history: ${this.asString(value.admission_history)}` : '',
      value.surgical_history ? `Surgical history: ${this.asString(value.surgical_history)}` : '',
    ].filter(Boolean)

    return parts.join('\n') || raw
  }

  private decodeAllergyHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!Array.isArray(parsed)) return raw

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const value = entry as Record<string, unknown>
        const parts = [
          this.asString(value.allergy_type),
          this.asString(value.drug_type),
          this.asString(value.severity) ? `(${this.asString(value.severity)})` : '',
        ].filter(Boolean)
        return parts.join(' — ')
      })
      .filter(Boolean)
      .join('\n')
  }

  private decodeChronicConditions(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!Array.isArray(parsed)) return raw

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const value = entry as Record<string, unknown>
        const label = this.asString(value.condition) || this.asString(value.path)
        const type = this.asString(value.type)
        const certainty = this.asString(value.certainty)
        const status = value.still_ongoing
          ? 'Ongoing'
          : this.asString(value.date_resolved)
            ? `Resolved ${this.asString(value.date_resolved)}`
            : ''
        const comments = this.asString(value.comments)
        const parts = [label, type, certainty].filter(Boolean)
        let line = parts.join(' — ')
        if (status) line += ` (${status})`
        if (comments) line += ` — ${comments}`
        return line
      })
      .filter(Boolean)
      .join('\n')
  }

  private decodeFamilyHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw

    const value = parsed as Record<string, unknown>
    const parts = [this.asString(value.family_history)]
    if (value.ncd_risk_factors === true) parts.push('NCD risk factors: Yes')
    if (value.ncd_risk_factors === false) parts.push('NCD risk factors: No')
    return parts.filter(Boolean).join('\n') || raw
  }

  private decodeSocialHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw

    const value = parsed as Record<string, unknown>
    const parts = []
    if (value.smokes === true) parts.push('Smokes: Yes')
    if (value.smokes === false) parts.push('Smokes: No')
    if (value.drinks_alcohol === true) parts.push('Drinks alcohol: Yes')
    if (value.drinks_alcohol === false) parts.push('Drinks alcohol: No')
    return parts.join('\n') || raw
  }

  private decodePhysicalExamination(raw: string | null | undefined): string {
    if (!raw) return ''
    if (raw.includes(':')) return raw.replaceAll('; ', '\n')
    return raw
  }

  private decodeImmunizationHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!Array.isArray(parsed)) return raw

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const value = entry as Record<string, unknown>
        const parts = [
          this.asString(value.vaccine_type),
          this.asString(value.vaccine),
          this.asString(value.dose),
          this.asString(value.date_given) ? `on ${this.asString(value.date_given)}` : '',
        ].filter(Boolean)
        return parts.join(' — ')
      })
      .filter(Boolean)
      .join('\n')
  }

  private decodeDevelopmentHistory(raw: string | null | undefined): string {
    if (!raw) return ''
    const parsed = this.tryParseJson(raw)
    if (!Array.isArray(parsed)) return raw

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const value = entry as Record<string, unknown>
        const name = this.asString(value.name) || this.asString(value.key)
        if (!name) return ''
        return value.achieved ? `${name}: Achieved` : `${name}: Not achieved`
      })
      .filter(Boolean)
      .join('\n')
  }

  private serializeStartupMedications(encounter: Encounter) {
    return [...(encounter.startupMedications ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((medication) => ({
        id: medication.id,
        medication_name: medication.medicationName,
        dosage: medication.dosage,
        route: medication.route,
        frequency: medication.frequency,
        notes: medication.notes,
        source: medication.source,
        administered_at: this.formatDate(medication.administeredAt),
        administration_status: medication.administeredAt ? 'administered' : 'pending',
        recorded_by: this.userBadge(medication.recordedByUser),
        status: medication.status,
        discontinued_reason: medication.discontinuedReason,
      }))
  }

  private tryParseJson(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
}
