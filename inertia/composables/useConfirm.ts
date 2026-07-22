import { ref } from 'vue'

export type ConfirmVariant = 'danger' | 'primary' | 'warning'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

export type ConfirmState = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: ConfirmVariant
}

type Pending = {
  resolve: (value: boolean) => void
}

const state = ref<ConfirmState>({
  open: false,
  title: 'Please confirm',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'primary',
})

let pending: Pending | null = null

function inferOptions(message: string): Pick<
  ConfirmOptions,
  'title' | 'confirmLabel' | 'variant'
> {
  const lower = message.toLowerCase()

  if (lower.includes('discharge')) {
    return { title: 'Discharge patient', confirmLabel: 'Discharge', variant: 'danger' }
  }
  if (lower.startsWith('delete') || lower.includes('delete ')) {
    return { title: 'Delete', confirmLabel: 'Delete', variant: 'danger' }
  }
  if (lower.startsWith('remove') || lower.includes('remove ')) {
    return { title: 'Remove', confirmLabel: 'Remove', variant: 'danger' }
  }
  if (lower.includes('decline')) {
    return { title: 'Decline', confirmLabel: 'Decline', variant: 'danger' }
  }
  if (lower.includes('cancel this') || lower.includes('cancel your') || lower.startsWith('cancel ')) {
    return { title: 'Cancel', confirmLabel: 'Yes, cancel', variant: 'danger' }
  }
  if (lower.includes('approve')) {
    return { title: 'Approve', confirmLabel: 'Approve', variant: 'primary' }
  }
  if (lower.includes('re-sync') || lower.includes('sync ')) {
    return { title: 'Sync data', confirmLabel: 'Sync', variant: 'warning' }
  }
  if (lower.includes('reopen')) {
    return { title: 'Reopen encounter', confirmLabel: 'Reopen', variant: 'warning' }
  }
  if (lower.includes('leave this page') || lower.includes('unsaved')) {
    return { title: 'Unsaved changes', confirmLabel: 'Leave page', variant: 'danger' }
  }
  if (lower.includes('continue')) {
    return { title: 'Continue?', confirmLabel: 'Continue', variant: 'warning' }
  }

  return { title: 'Please confirm', confirmLabel: 'Confirm', variant: 'primary' }
}

function close(result: boolean) {
  if (!pending) return
  const { resolve } = pending
  pending = null
  state.value = { ...state.value, open: false }
  resolve(result)
}

/**
 * Show the shared confirmation modal. Resolves true when the user confirms.
 * Accepts a plain string (message) or a full options object.
 */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const normalized: ConfirmOptions =
    typeof options === 'string' ? { message: options } : { ...options }

  const inferred = inferOptions(normalized.message)

  // If a previous dialog is still open, reject it as cancelled.
  if (pending) {
    pending.resolve(false)
    pending = null
  }

  state.value = {
    open: true,
    title: normalized.title ?? inferred.title ?? 'Please confirm',
    message: normalized.message,
    confirmLabel: normalized.confirmLabel ?? inferred.confirmLabel ?? 'Confirm',
    cancelLabel: normalized.cancelLabel ?? 'Cancel',
    variant: normalized.variant ?? inferred.variant ?? 'primary',
  }

  return new Promise<boolean>((resolve) => {
    pending = { resolve }
  })
}

export function resolveConfirm(result: boolean) {
  close(result)
}

export function useConfirm() {
  return {
    state,
    confirm: confirmDialog,
    resolve: resolveConfirm,
  }
}
