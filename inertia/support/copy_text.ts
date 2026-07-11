/**
 * Copy text to the clipboard. Uses the async Clipboard API when available
 * (requires HTTPS), then falls back to execCommand for plain HTTP deployments.
 */
export async function copyTextToClipboard(text: string, input?: HTMLInputElement | null): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Clipboard API blocked (common on http://) — try fallback below.
    }
  }

  if (input) {
    input.focus()
    input.select()
    input.setSelectionRange(0, text.length)
    try {
      if (document.execCommand('copy')) {
        return true
      }
    } catch {
      // continue to textarea fallback
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}
