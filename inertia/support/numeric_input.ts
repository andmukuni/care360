/** Helper copy for numeric form fields. */
export const HINT_DIGITS_ONLY = 'Digits only'
export const HINT_WHOLE_NUMBERS = 'Whole numbers only'
export const HINT_DECIMALS_ALLOWED = 'Decimals allowed'

/** Keep partial decimals like "9." while typing (avoids type="number" coercion). */
export function sanitizeDecimalInput(raw: string): string {
  if (!raw) {
    return ''
  }

  let value = raw.replace(/[^\d.-]/g, '')
  const isNegative = value.startsWith('-')
  value = value.replace(/-/g, '')

  const dotIndex = value.indexOf('.')
  if (dotIndex !== -1) {
    value = value.slice(0, dotIndex + 1) + value.slice(dotIndex + 1).replace(/\./g, '')
  }

  return isNegative ? `-${value}` : value
}

export function resolvesHtmlInputType(
  inputType: string,
  allowDecimals: boolean
): string {
  if (inputType === 'number' && allowDecimals) {
    return 'text'
  }
  return inputType
}

export function onDecimalFieldInput(
  event: Event,
  update: (value: string) => void
): void {
  const el = event.target as HTMLInputElement
  const next = sanitizeDecimalInput(el.value)
  if (el.value !== next) {
    el.value = next
  }
  update(next)
}

export function resolvesNumericStep(
  inputType: string,
  step: number | string | undefined,
  allowDecimals: boolean
): number | string | undefined {
  if (inputType !== 'number') {
    return step
  }
  if (step !== undefined) {
    return step
  }
  return allowDecimals ? 'any' : 1
}

export function resolvesInputMode(
  inputType: string,
  step: number | string | undefined,
  allowDecimals: boolean
): 'decimal' | 'numeric' | undefined {
  if (inputType !== 'number') {
    return undefined
  }
  const resolved = resolvesNumericStep(inputType, step, allowDecimals)
  if (resolved === 1 || resolved === '1') {
    return 'numeric'
  }
  return 'decimal'
}
