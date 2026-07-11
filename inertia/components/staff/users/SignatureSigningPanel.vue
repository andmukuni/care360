<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import ActionButton from '~/components/ui/ActionButton.vue'
import { readXsrfToken } from '~/support/xsrf'
import { copyTextToClipboard } from '~/support/copy_text'

interface PendingSignatureInvite {
  url: string
}

const props = withDefaults(
  defineProps<{
    staffName: string
    inviteEndpoint: string
    signatureUrl?: string | null
    signedAt?: string | null
    pendingInvite?: PendingSignatureInvite | null
    resetEndpoint?: string | null
    compact?: boolean
    showRefresh?: boolean
    reloadOnly?: string
  }>(),
  {
    signatureUrl: null,
    signedAt: null,
    pendingInvite: null,
    resetEndpoint: null,
    compact: false,
    showRefresh: true,
    reloadOnly: 'user',
  }
)

const emit = defineEmits<{
  remove: []
}>()

const signingLink = ref<PendingSignatureInvite | null>(props.pendingInvite ?? null)
const generatingLink = ref(false)
const linkCopied = ref(false)
const linkError = ref<string | null>(null)
const canNativeShare = ref(false)
const sharingLink = ref(false)
const linkJustGenerated = ref(false)
const linkInputRef = ref<HTMLInputElement | null>(null)
const resetting = ref(false)

const isSigned = computed(() => Boolean(props.signatureUrl))
const isAwaiting = computed(() => !isSigned.value && Boolean(signingLink.value))

async function generateSigningLink() {
  generatingLink.value = true
  linkError.value = null
  linkCopied.value = false

  try {
    const response = await fetch(props.inviteEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-XSRF-TOKEN': readXsrfToken(),
      },
    })

    if (!response.ok) {
      throw new Error('Could not generate signing link.')
    }

    const data = (await response.json()) as PendingSignatureInvite
    signingLink.value = data
    linkJustGenerated.value = true
  } catch {
    linkError.value = 'Could not generate signing link. Please try again.'
  } finally {
    generatingLink.value = false
  }
}

async function copySigningLink() {
  if (!signingLink.value?.url) return

  linkError.value = null
  const copied = await copyTextToClipboard(signingLink.value.url, linkInputRef.value)

  if (copied) {
    linkCopied.value = true
    window.setTimeout(() => {
      linkCopied.value = false
    }, 2500)
    return
  }

  linkInputRef.value?.focus()
  linkInputRef.value?.select()
}

function selectLinkInput() {
  linkInputRef.value?.focus()
  linkInputRef.value?.select()
}

async function shareSigningLink() {
  if (!signingLink.value?.url || !canNativeShare.value) return

  sharingLink.value = true
  linkError.value = null

  const staffName = props.staffName.trim() || 'Staff member'

  try {
    await navigator.share({
      title: 'Fairview signature',
      text: `${staffName}, open this link to sign your name on your phone.`,
      url: signingLink.value.url,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    linkError.value = 'Could not open the share menu. Try Copy instead.'
  } finally {
    sharingLink.value = false
  }
}

function refreshSignatureStatus() {
  router.reload({ only: [props.reloadOnly] })
}

function resetSignature() {
  if (!props.resetEndpoint || !isSigned.value) return

  const staffName = props.staffName.trim() || 'this staff member'
  const confirmed = window.confirm(
    `Remove the saved signature for ${staffName}? They will need to sign again using a new link.`
  )
  if (!confirmed) return

  resetting.value = true
  router.delete(props.resetEndpoint, {
    preserveScroll: true,
    onFinish: () => {
      resetting.value = false
    },
  })
}

onMounted(() => {
  canNativeShare.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
})
</script>

<template>
  <div class="signature-panel" :class="{ 'signature-panel--compact': props.compact }">
    <div
      v-if="isSigned || isAwaiting || signingLink"
      class="signature-panel__status"
      :class="isSigned ? 'signature-panel__status--signed' : 'signature-panel__status--pending'"
    >
      <div class="signature-panel__status-head">
        <span class="signature-panel__status-title">Staff signature</span>
        <span v-if="isSigned" class="signature-panel__badge signature-panel__badge--signed">Signed</span>
        <span v-else class="signature-panel__badge signature-panel__badge--pending">Awaiting signature</span>
      </div>

      <p v-if="isSigned && props.signedAt" class="signature-panel__status-meta">{{ props.signedAt }}</p>
      <p v-else-if="isAwaiting" class="signature-panel__status-meta">
        Link generated. Waiting for {{ props.staffName || 'staff' }} to sign on their phone.
      </p>

      <div v-if="isSigned && props.signatureUrl" class="signature-panel__preview">
        <img :src="props.signatureUrl" alt="Staff signature" class="signature-panel__preview-img" />
      </div>
    </div>

    <div class="signature-panel__generate-wrap">
      <ActionButton
        v-if="isSigned && props.resetEndpoint"
        type="button"
        variant="danger"
        :loading="resetting"
        loading-text="Resetting…"
        @click="resetSignature"
      >
        Reset signature
      </ActionButton>
      <ActionButton
        type="button"
        variant="blue"
        :loading="generatingLink"
        loading-text="Generating…"
        @click="generateSigningLink"
      >
        {{ signingLink ? 'Regenerate signature link' : 'Generate signature link' }}
      </ActionButton>
    </div>

    <div
      v-if="signingLink"
      class="signature-panel__link-box"
      :class="linkJustGenerated ? 'signature-panel__link-box--fresh' : 'signature-panel__link-box--existing'"
    >
      <p class="signature-panel__link-label">
        {{ linkJustGenerated ? 'Link ready — share with staff:' : 'Existing link:' }}
      </p>
      <div class="signature-panel__link-row">
        <input
          ref="linkInputRef"
          :value="signingLink.url"
          type="text"
          readonly
          class="signature-panel__link-input"
          @focus="selectLinkInput"
          @click="selectLinkInput"
        />
        <button
          v-if="canNativeShare"
          type="button"
          class="signature-panel__link-btn"
          :disabled="sharingLink"
          @click="shareSigningLink"
        >
          {{ sharingLink ? '…' : 'Share' }}
        </button>
        <button type="button" class="signature-panel__link-btn" @click="copySigningLink">
          {{ linkCopied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <p class="signature-panel__link-hint">
        Staff can open this on any device to draw their signature. The link stays active until they sign.
      </p>
    </div>

    <div v-if="props.showRefresh || $slots.actions" class="signature-panel__footer">
      <button v-if="props.showRefresh" type="button" class="users-edit__text-btn" @click="refreshSignatureStatus">
        Refresh status
      </button>
      <slot name="actions" />
    </div>

    <p v-if="linkError" class="users-edit__error">{{ linkError }}</p>
  </div>
</template>
