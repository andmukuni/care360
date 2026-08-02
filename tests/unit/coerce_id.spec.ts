import { test } from '@japa/runner'
import { coerceNumericId, sameNumericId } from '../../inertia/support/coerce_id.js'

test.group('coerceNumericId', () => {
  test('coerces string ids from Inertia props', ({ assert }) => {
    assert.equal(coerceNumericId('238'), 238)
    assert.equal(coerceNumericId(238), 238)
  })

  test('returns null for invalid values', ({ assert }) => {
    assert.isNull(coerceNumericId(null))
    assert.isNull(coerceNumericId(''))
    assert.isNull(coerceNumericId('abc'))
    assert.isNull(coerceNumericId(0))
  })

  test('sameNumericId compares string and number forms', ({ assert }) => {
    assert.isTrue(sameNumericId(238, '238'))
    assert.isFalse(sameNumericId(238, '237'))
    assert.isFalse(sameNumericId(null, '238'))
  })
})
