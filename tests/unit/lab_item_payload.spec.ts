import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import LabRequest from '#models/lab_request'
import LabRequestItem from '#models/lab_request_item'
import LabResult from '#models/lab_result'
import { serializeLabItemsWithResults } from '#support/encounter/lab_item_payload'

test.group('Lab item payload', () => {
  test('serializeLabItemsWithResults pairs each request item with its result', ({ assert }) => {
    const lab = new LabRequest()
    lab.id = 1

    const bloodSlide = new LabRequestItem()
    bloodSlide.id = 10
    bloodSlide.testName = 'BLOOD SLIDE (MPS)'
    bloodSlide.specimenType = 'Blood'
    bloodSlide.instructions = 'Fasting sample'
    bloodSlide.status = 'pending'

    const adenovirus = new LabRequestItem()
    adenovirus.id = 11
    adenovirus.testName = 'Adenovirus DNA'
    adenovirus.specimenType = 'Nasopharynx'
    adenovirus.instructions = null
    adenovirus.status = 'completed'

    const result = new LabResult()
    result.id = 50
    result.labRequestItemId = 11
    result.resultValue = 'Detected'
    result.resultText = null
    result.referenceRange = 'Not detected'
    result.interpretation = 'abnormal'
    result.remarks = null
    result.resultStatus = 'final'
    result.verifiedAt = DateTime.fromISO('2026-07-08T10:00:00')
    result.releasedToPatientAt = null

    lab.labRequestItems = [bloodSlide, adenovirus]
    lab.labResults = [result]

    const items = serializeLabItemsWithResults(lab, {
      formatDate: (value, format = 'dd LLL yyyy HH:mm') => (value ? value.toFormat(format) : null),
      userBadge: () => null,
    })

    assert.lengthOf(items, 2)
    assert.equal(items[0].test_name, 'BLOOD SLIDE (MPS)')
    assert.isNull(items[0].result)
    assert.equal(items[1].test_name, 'Adenovirus DNA')
    assert.equal(items[1].result?.result_value, 'Detected')
    assert.equal(items[1].result?.interpretation, 'abnormal')
  })
})
