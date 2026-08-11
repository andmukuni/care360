import { test } from '@japa/runner'
import {
  resolvesHtmlInputType,
  sanitizeDecimalInput,
} from '../../inertia/support/numeric_input.js'

test.group('sanitizeDecimalInput', () => {
  test('preserves trailing decimal while typing', ({ assert }) => {
    assert.equal(sanitizeDecimalInput('9.'), '9.')
    assert.equal(sanitizeDecimalInput('9.0'), '9.0')
    assert.equal(sanitizeDecimalInput('0.'), '0.')
  })

  test('strips non-numeric characters', ({ assert }) => {
    assert.equal(sanitizeDecimalInput('abc'), '')
    assert.equal(sanitizeDecimalInput('9a.0b'), '9.0')
  })

  test('allows leading decimal', ({ assert }) => {
    assert.equal(sanitizeDecimalInput('.5'), '.5')
  })

  test('keeps only one decimal point', ({ assert }) => {
    assert.equal(sanitizeDecimalInput('9..0'), '9.0')
  })

  test('allows optional leading minus', ({ assert }) => {
    assert.equal(sanitizeDecimalInput('-9.5'), '-9.5')
    assert.equal(sanitizeDecimalInput('-'), '-')
  })
})

test.group('resolvesHtmlInputType', () => {
  test('uses text for decimal number fields', ({ assert }) => {
    assert.equal(resolvesHtmlInputType('number', true), 'text')
  })

  test('keeps number for whole-number fields', ({ assert }) => {
    assert.equal(resolvesHtmlInputType('number', false), 'number')
  })
})
