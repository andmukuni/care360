/** Helper copy for numeric form fields. */
export const HINT_DIGITS_ONLY = 'Digits only'
export const HINT_WHOLE_NUMBERS = 'Whole numbers only'
export const HINT_DECIMALS_ALLOWED = 'Decimals allowed'

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
