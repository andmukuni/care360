<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import AuthLayout from '~/layouts/AuthLayout.vue'
import ActionButton from '~/components/ui/ActionButton.vue'

const props = defineProps<{
  token: string
  staff_name: string
  saved?: boolean
  error_message?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const hasStroke = ref(false)

const form = useForm({
  signature_image: '',
})

let ctx: CanvasRenderingContext2D | null = null

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.floor(rect.width * ratio)
  canvas.height = Math.floor(rect.height * ratio)

  ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function pointerPosition(event: PointerEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function startStroke(event: PointerEvent) {
  if (!ctx || props.saved) return
  drawing.value = true
  hasStroke.value = true
  const { x, y } = pointerPosition(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function continueStroke(event: PointerEvent) {
  if (!drawing.value || !ctx) return
  const { x, y } = pointerPosition(event)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function endStroke(event: PointerEvent) {
  if (!drawing.value) return
  drawing.value = false
  try {
    canvasRef.value?.releasePointerCapture(event.pointerId)
  } catch {
    // ignore if capture was already released
  }
}

function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasStroke.value = false
  form.clearErrors('signature_image')
}

function submit() {
  const canvas = canvasRef.value
  if (!canvas || !hasStroke.value) {
    form.setError('signature_image', 'Please draw your signature first.')
    return
  }

  form.signature_image = canvas.toDataURL('image/png')
  form.post(`/sign/${props.token}`, {
    preserveScroll: true,
  })
}

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <AuthLayout brand-title="Fairview" brand-tagline="Staff signature" wide>
    <div class="signature-capture">
      <template v-if="props.saved">
        <div class="signature-capture__success">
          <div class="signature-capture__success-icon" aria-hidden="true">✓</div>
          <h1 class="signature-capture__title">Signature saved</h1>
          <p class="signature-capture__desc">
            Thank you, {{ props.staff_name }}. Your signature has been recorded and will appear on prescriptions and
            official documents.
          </p>
          <p class="signature-capture__hint">You can close this page.</p>
        </div>
      </template>

      <template v-else>
        <header class="signature-capture__head">
          <h1 class="signature-capture__title">Sign your name</h1>
          <p class="signature-capture__desc">
            {{ props.staff_name }}, draw your signature below using your finger or stylus. It will be used on
            prescriptions and official documents.
          </p>
        </header>

        <div class="signature-capture__pad-wrap">
          <canvas
            ref="canvasRef"
            class="signature-capture__pad"
            aria-label="Signature drawing area"
            @pointerdown.prevent="startStroke"
            @pointermove.prevent="continueStroke"
            @pointerup.prevent="endStroke"
            @pointercancel.prevent="endStroke"
            @pointerleave.prevent="endStroke"
          />
          <p class="signature-capture__pad-hint">Sign inside the box</p>
        </div>

        <p v-if="props.error_message || form.errors.signature_image" class="signature-capture__error">
          {{ props.error_message || form.errors.signature_image }}
        </p>

        <div class="signature-capture__actions">
          <button type="button" class="signature-capture__secondary" @click="clearCanvas">Clear</button>
          <ActionButton type="button" variant="blue" :loading="form.processing" loading-text="Saving…" @click="submit">
            Save signature
          </ActionButton>
        </div>
      </template>
    </div>
  </AuthLayout>
</template>

<style scoped>
.signature-capture {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.signature-capture__head,
.signature-capture__success {
  text-align: center;
}

.signature-capture__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

:global(.dark) .signature-capture__title {
  color: #f5f5f5;
}

.signature-capture__desc {
  margin-top: 0.5rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #64748b;
}

:global(.dark) .signature-capture__desc {
  color: #a3a3a3;
}

.signature-capture__hint {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.signature-capture__pad-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #fff;
  overflow: hidden;
}

:global(.dark) .signature-capture__pad-wrap {
  border-color: #404040;
  background: #171717;
}

.signature-capture__pad {
  display: block;
  width: 100%;
  height: 12rem;
  touch-action: none;
  cursor: crosshair;
}

.signature-capture__pad-hint {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: #94a3b8;
  border-top: 1px dashed #e2e8f0;
}

:global(.dark) .signature-capture__pad-hint {
  border-top-color: #404040;
}

.signature-capture__error {
  font-size: 0.875rem;
  color: #dc2626;
}

.signature-capture__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.signature-capture__secondary {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  background: #fff;
}

:global(.dark) .signature-capture__secondary {
  border-color: #525252;
  color: #d4d4d4;
  background: #262626;
}

.signature-capture__success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  border-radius: 9999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 1.5rem;
  font-weight: 700;
}
</style>
