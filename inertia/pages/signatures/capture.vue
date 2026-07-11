<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'

const props = defineProps<{
  token: string
  staff_name: string
  staff_title?: string | null
  staff_specialty?: string | null
  staff_email?: string | null
  saved?: boolean
  already_signed?: boolean
  signature_url?: string | null
  signed_at?: string | null
  error_message?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const drawing = ref(false)
const hasStroke = ref(false)
const showPlaceholder = ref(true)
const padSigned = ref(false)

const form = useForm({
  signature_image: '',
})

const staffMeta = computed(() => {
  const parts: string[] = []
  if (props.staff_title?.trim()) parts.push(props.staff_title.trim())
  if (props.staff_specialty?.trim()) parts.push(props.staff_specialty.trim())
  if (props.staff_email?.trim()) parts.push(props.staff_email.trim())
  return parts.join(' · ')
})

let ctx: CanvasRenderingContext2D | null = null

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = wrapperRef.value
  if (!canvas || !wrapper) return

  const ratio = window.devicePixelRatio || 1
  const width = wrapper.clientWidth
  const height = 220

  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function pointerPosition(event: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()

  if ('touches' in event && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top,
    }
  }

  const mouse = event as MouseEvent
  return {
    x: mouse.clientX - rect.left,
    y: mouse.clientY - rect.top,
  }
}

function markDrawn() {
  if (!hasStroke.value) {
    hasStroke.value = true
    showPlaceholder.value = false
    padSigned.value = true
  }
}

function startStroke(event: MouseEvent | TouchEvent) {
  if (!ctx || props.saved || props.already_signed) return
  event.preventDefault()
  drawing.value = true
  markDrawn()
  const { x, y } = pointerPosition(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function continueStroke(event: MouseEvent | TouchEvent) {
  if (!drawing.value || !ctx) return
  event.preventDefault()
  const { x, y } = pointerPosition(event)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function endStroke(event: MouseEvent | TouchEvent) {
  if (!drawing.value) return
  event.preventDefault()
  drawing.value = false
  ctx?.closePath()
}

function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  const ratio = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
  hasStroke.value = false
  showPlaceholder.value = true
  padSigned.value = false
  form.clearErrors('signature_image')
}

function submit() {
  const canvas = canvasRef.value
  if (!canvas || !hasStroke.value) {
    form.setError('signature_image', 'Please draw your signature before submitting.')
    return
  }

  form.signature_image = canvas.toDataURL('image/png')
  form.post(`/sign/${props.token}`, {
    preserveScroll: true,
  })
}

function bindCanvasEvents() {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.addEventListener('mousedown', startStroke)
  canvas.addEventListener('mousemove', continueStroke)
  canvas.addEventListener('mouseup', endStroke)
  canvas.addEventListener('mouseleave', endStroke)
  canvas.addEventListener('touchstart', startStroke, { passive: false })
  canvas.addEventListener('touchmove', continueStroke, { passive: false })
  canvas.addEventListener('touchend', endStroke, { passive: false })
}

function unbindCanvasEvents() {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.removeEventListener('mousedown', startStroke)
  canvas.removeEventListener('mousemove', continueStroke)
  canvas.removeEventListener('mouseup', endStroke)
  canvas.removeEventListener('mouseleave', endStroke)
  canvas.removeEventListener('touchstart', startStroke)
  canvas.removeEventListener('touchmove', continueStroke)
  canvas.removeEventListener('touchend', endStroke)
}

onMounted(() => {
  if (!props.saved && !props.already_signed) {
    resizeCanvas()
    bindCanvasEvents()
    window.addEventListener('resize', resizeCanvas)
  }
})

onBeforeUnmount(() => {
  unbindCanvasEvents()
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <div class="signature-capture-page">
    <div class="signature-capture-page__inner">
      <header class="signature-capture-page__header">
        <div class="signature-capture-page__header-icon" aria-hidden="true">✍</div>
        <div class="signature-capture-page__header-text">
          <p class="signature-capture-page__header-eyebrow">Staff Signature</p>
          <h1 class="signature-capture-page__header-name">{{ props.staff_name }}</h1>
          <p v-if="staffMeta" class="signature-capture-page__header-meta">{{ staffMeta }}</p>
        </div>
      </header>

      <template v-if="props.saved">
        <div class="signature-capture-page__success">
          <div class="signature-capture-page__success-icon" aria-hidden="true">✓</div>
          <h2 class="signature-capture-page__success-title">Signature received</h2>
          <p class="signature-capture-page__success-desc">Your signature has been recorded.</p>

          <p v-if="props.signed_at" class="signature-capture-page__hint">Signed {{ props.signed_at }}</p>

          <div v-if="props.signature_url" class="signature-capture-page__signature-preview">
            <p class="signature-capture-page__signature-label">Your signature</p>
            <img :src="props.signature_url" alt="Your signature" />
          </div>

          <p class="signature-capture-page__footnote">You may close this page.</p>
        </div>
      </template>

      <template v-else-if="props.already_signed">
        <div class="signature-capture-page__already">
          <div class="signature-capture-page__success-icon" aria-hidden="true">✓</div>
          <h2 class="signature-capture-page__success-title">Already signed</h2>
          <p class="signature-capture-page__success-desc">
            This signing link has been used. It is no longer available for a new signature.
          </p>
          <p v-if="props.signed_at" class="signature-capture-page__hint">Signed {{ props.signed_at }}</p>
          <div v-if="props.signature_url" class="signature-capture-page__signature-preview">
            <img :src="props.signature_url" alt="Staff signature" />
          </div>
        </div>
      </template>

      <template v-else>
        <p class="signature-capture-page__consent">
          By signing below, you confirm this is your official signature for prescriptions and hospital documents.
        </p>

        <label class="signature-capture-page__pad-label">Draw your signature</label>
        <div
          ref="wrapperRef"
          class="signature-capture-page__pad-wrap"
          :class="{ 'signature-capture-page__pad-wrap--signed': padSigned }"
        >
          <canvas ref="canvasRef" id="signature-canvas" class="signature-capture-page__pad" aria-label="Signature drawing area" />
          <div v-if="showPlaceholder" class="signature-capture-page__pad-placeholder">
            <span class="signature-capture-page__pad-placeholder-icon" aria-hidden="true">✍</span>
            <span>Sign here using your finger or mouse</span>
          </div>
        </div>

        <div class="signature-capture-page__pad-actions">
          <span>Use your finger (mobile) or mouse (desktop)</span>
          <button type="button" class="signature-capture-page__clear" @click="clearCanvas">Clear</button>
        </div>

        <p v-if="props.error_message || form.errors.signature_image" class="signature-capture-page__error">
          {{ props.error_message || form.errors.signature_image }}
        </p>

        <button
          type="button"
          class="signature-capture-page__submit"
          :disabled="form.processing"
          @click="submit"
        >
          {{ form.processing ? 'Submitting…' : 'Submit signature' }}
        </button>
      </template>

      <p class="signature-capture-page__footer-note">This link stays active until your signature is submitted.</p>
    </div>
  </div>
</template>

<style scoped>
.signature-capture-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #0f172a;
  -webkit-tap-highlight-color: transparent;
}

.signature-capture-page__inner {
  width: 100%;
  max-width: 32rem;
}

.signature-capture-page__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgb(55 65 81 / 55%);
  border-radius: 0.875rem;
  background: rgb(31 41 55 / 55%);
  text-align: left;
}

.signature-capture-page__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  background: #4f46e5;
  color: #fff;
  font-size: 1.125rem;
  box-shadow: 0 6px 16px rgb(79 70 229 / 30%);
}

.signature-capture-page__header-text {
  min-width: 0;
}

.signature-capture-page__header-eyebrow {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.signature-capture-page__header-name {
  margin-top: 0.125rem;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
  color: #fff;
}

.signature-capture-page__header-meta {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
}

.signature-capture-page__consent {
  margin-bottom: 1rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgb(245 158 11 / 20%);
  border-radius: 0.625rem;
  background: rgb(245 158 11 / 5%);
  font-size: 0.6875rem;
  line-height: 1.45;
  color: rgb(253 230 138 / 80%);
}

.signature-capture-page__pad-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #cbd5e1;
}

.signature-capture-page__pad-wrap {
  position: relative;
  overflow: hidden;
  border: 2px dashed #6366f1;
  border-radius: 0.75rem;
  background: #fff;
}

.signature-capture-page__pad-wrap--signed {
  border-style: solid;
  border-color: #22c55e;
}

.signature-capture-page__pad {
  display: block;
  width: 100%;
  height: 220px;
  touch-action: none;
  cursor: crosshair;
}

.signature-capture-page__pad-placeholder {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #cbd5e1;
  font-size: 0.95rem;
}

.signature-capture-page__pad-placeholder-icon {
  font-size: 1.75rem;
  opacity: 0.3;
}

.signature-capture-page__pad-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem 0 1.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.signature-capture-page__clear {
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
}

.signature-capture-page__clear:hover {
  color: #f87171;
}

.signature-capture-page__error {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border: 1px solid rgb(239 68 68 / 30%);
  border-radius: 0.75rem;
  background: rgb(239 68 68 / 10%);
  text-align: center;
  font-size: 0.875rem;
  color: #f87171;
}

.signature-capture-page__submit {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 0.75rem;
  background: #4f46e5;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 10px 25px rgb(79 70 229 / 40%);
}

.signature-capture-page__submit:hover {
  background: #6366f1;
}

.signature-capture-page__submit:disabled {
  opacity: 0.7;
}

.signature-capture-page__footer-note {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: #475569;
}

.signature-capture-page__success,
.signature-capture-page__already {
  text-align: center;
}

.signature-capture-page__success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  border-radius: 9999px;
  background: rgb(34 197 94 / 10%);
  border: 2px solid rgb(34 197 94 / 30%);
  color: #4ade80;
  font-size: 2rem;
  font-weight: 700;
}

.signature-capture-page__success-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #fff;
}

.signature-capture-page__success-desc {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: #94a3b8;
}

.signature-capture-page__hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.signature-capture-page__success-desc strong {
  color: #e2e8f0;
}

.signature-capture-page__signature-preview {
  margin: 1.25rem 0;
  padding: 1rem;
  border-radius: 0.75rem;
  background: #fff;
}

.signature-capture-page__signature-label {
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
}

.signature-capture-page__signature-preview img {
  display: block;
  max-height: 5rem;
  margin: 0 auto;
}

.signature-capture-page__footnote {
  font-size: 0.75rem;
  color: #64748b;
}
</style>
