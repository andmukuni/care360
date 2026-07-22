import { flushAllAutosaves } from '~/composables/useAutosaveRegistry'
import { confirmDialog } from '~/composables/useConfirm'

type FlushOptions = {
  /**
   * When false, a failed flush is reported but the caller may still proceed
   * (e.g. complete actions that submit the full form in the same request).
   */
  required?: boolean
}

export async function flushAutosavesBeforeAction(options: FlushOptions = {}): Promise<boolean> {
  const { required = true } = options
  const saved = await flushAllAutosaves()

  if (saved) return true

  const message =
    'Your latest changes could not be saved. Check your internet connection and try again.'

  if (required) {
    window.alert(message)
    return false
  }

  return await confirmDialog(`${message}\n\nContinue anyway with the data in this form?`)
}
