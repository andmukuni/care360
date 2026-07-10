import { DateTime } from 'luxon'
import type LabRequest from '#models/lab_request'
import type LabResult from '#models/lab_result'
import type User from '#models/user'

export type SerializedLabResult = {
  id: number
  result_value: string | null
  result_text: string | null
  reference_range: string | null
  interpretation: string | null
  remarks: string | null
  result_status: string
  verified_by: { name: string; role: string | null } | null
  verified_at: string | null
  released_by: { name: string; role: string | null } | null
  released_at: string | null
}

export type SerializedLabItem = {
  id: number
  test_name: string
  specimen_type: string | null
  test_group: string | null
  instructions: string | null
  status: string
  result: SerializedLabResult | null
}

type UserBadge = { name: string; role: string | null } | null

type SerializeLabResultOptions = {
  formatDate: (value: DateTime | null | undefined, format?: string) => string | null
  userBadge: (user: User | null | undefined) => UserBadge
}

export function serializeLabItemsWithResults(
  lab: LabRequest,
  options: SerializeLabResultOptions
): SerializedLabItem[] {
  const resultsByItemId = new Map<number, LabResult>()

  for (const result of lab.labResults ?? []) {
    if (result.labRequestItemId) {
      resultsByItemId.set(result.labRequestItemId, result)
    }
  }

  return [...(lab.labRequestItems ?? [])].map((item) => {
    const result = resultsByItemId.get(item.id) ?? null

    return {
      id: item.id,
      test_name: item.testName,
      specimen_type: item.specimenType,
      test_group: item.testGroup,
      instructions: item.instructions,
      status: item.status,
      result: result ? serializeLabResult(result, options) : null,
    }
  })
}

function serializeLabResult(result: LabResult, options: SerializeLabResultOptions): SerializedLabResult {
  return {
    id: result.id,
    result_value: result.resultValue,
    result_text: result.resultText,
    reference_range: result.referenceRange,
    interpretation: result.interpretation,
    remarks: result.remarks,
    result_status: result.resultStatus,
    verified_by: options.userBadge(result.verifiedByUser),
    verified_at: options.formatDate(result.verifiedAt, 'dd LLL HH:mm'),
    released_by: options.userBadge(result.releasedByUser),
    released_at: options.formatDate(result.releasedToPatientAt, 'dd LLL HH:mm'),
  }
}
