import ReferenceDataInvalidator from '#services/cache/reference_data_invalidator'
import type Patient from '#models/patient'
import type Household from '#models/household'
import type Medication from '#models/medication'
import type TestType from '#models/test_type'

export async function invalidatePatientCache(patient: Patient): Promise<void> {
  const previous = patient.$original as Partial<Patient> | undefined
  await ReferenceDataInvalidator.patientChangedFromModel(
    {
      id: patient.id,
      patientId: patient.patientId,
      barcode: patient.barcode ?? null,
    },
    previous?.id
      ? {
          id: previous.id,
          patientId: previous.patientId ?? patient.patientId,
          barcode: previous.barcode ?? null,
        }
      : null
  )
}

export async function invalidateHouseholdCache(household: Household): Promise<void> {
  const previous = household.$original as Partial<Household> | undefined
  await ReferenceDataInvalidator.householdChangedFromModel(
    {
      id: household.id,
      householdId: household.householdId,
      barcode: household.barcode ?? null,
    },
    previous?.id
      ? {
          id: previous.id,
          householdId: previous.householdId ?? household.householdId,
          barcode: previous.barcode ?? null,
        }
      : null
  )
}

export async function invalidateMedicationCache(medication: Medication): Promise<void> {
  await ReferenceDataInvalidator.invalidateMedication(medication.id)
}

export async function invalidateTestTypeCache(testType: TestType): Promise<void> {
  await ReferenceDataInvalidator.invalidateTestType(testType.id)
}
