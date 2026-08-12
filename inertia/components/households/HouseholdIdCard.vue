<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import JsBarcode from 'jsbarcode'
import {
  downloadBlob,
  householdIdCardFilename,
  HOUSEHOLD_ID_CARD_HEADER_HEIGHT,
  HOUSEHOLD_ID_CARD_HEIGHT,
  HOUSEHOLD_ID_CARD_WIDTH,
  renderHouseholdIdCardPng,
} from '~/support/household_id_card_png'

const PREVIEW_SCALE = 0.48
const BODY_HEIGHT = HOUSEHOLD_ID_CARD_HEIGHT - HOUSEHOLD_ID_CARD_HEADER_HEIGHT

const props = withDefaults(
  defineProps<{
    headName: string
    village?: string
    town?: string
    nrc?: string
    phone?: string
    barcode: string
    printableId?: string
    previewScale?: number
  }>(),
  {
    village: '',
    town: '',
    nrc: '',
    phone: '',
    printableId: 'household-id-card-printable',
    previewScale: PREVIEW_SCALE,
  }
)

const headerSrc = '/images/household-id/card-header.png'
const barcodeSvgRef = ref<SVGSVGElement | null>(null)
const downloadingPng = ref(false)

const villageLabel = () => {
  const parts = [props.village, props.town].map((v) => String(v ?? '').trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function renderBarcode() {
  const node = barcodeSvgRef.value
  const value = String(props.barcode ?? '').trim()
  if (!node || !value) return
  try {
    JsBarcode(node, value, {
      format: 'CODE128',
      width: 2.2,
      height: 96,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    node.innerHTML = ''
  }
}

onMounted(renderBarcode)
watch(() => props.barcode, () => setTimeout(renderBarcode, 0))

async function downloadPng() {
  if (downloadingPng.value) return

  downloadingPng.value = true
  try {
    renderBarcode()
    await nextTick()

    const blob = await renderHouseholdIdCardPng({
      headerSrc,
      headName: props.headName,
      villageLabel: villageLabel(),
      nrc: props.nrc || '—',
      phone: props.phone || '—',
      barcode: props.barcode,
      barcodeSvg: barcodeSvgRef.value,
    })

    downloadBlob(blob, householdIdCardFilename(props.headName, props.barcode))
  } finally {
    downloadingPng.value = false
  }
}

defineExpose({ renderBarcode, downloadPng, downloadingPng })
</script>

<template>
  <div
    class="household-id-card-preview"
    :style="{
      '--household-id-card-width': `${HOUSEHOLD_ID_CARD_WIDTH}px`,
      '--household-id-card-height': `${HOUSEHOLD_ID_CARD_HEIGHT}px`,
      '--household-id-card-header-height': `${HOUSEHOLD_ID_CARD_HEADER_HEIGHT}px`,
      '--household-id-card-body-height': `${BODY_HEIGHT}px`,
      '--household-id-card-preview-scale': String(previewScale),
    }"
  >
    <div :id="printableId" class="household-id-card">
      <img
        :src="headerSrc"
        alt="Anthu Omweh Health Centre"
        class="household-id-card__header"
      />

      <div class="household-id-card__body">
        <h2 class="household-id-card__name">{{ headName }}</h2>

        <dl class="household-id-card__details">
          <div class="household-id-card__row">
            <dt>Village</dt>
            <dd>{{ villageLabel() }}</dd>
          </div>
          <div class="household-id-card__row">
            <dt>NRC</dt>
            <dd>{{ nrc || '—' }}</dd>
          </div>
          <div class="household-id-card__row">
            <dt>Phone</dt>
            <dd>{{ phone || '—' }}</dd>
          </div>
        </dl>

        <div class="household-id-card__barcode">
          <svg ref="barcodeSvgRef" class="household-id-card__barcode-svg" role="img" :aria-label="`Barcode ${barcode}`" />
          <p class="household-id-card__barcode-value">{{ barcode }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.household-id-card-preview {
  width: calc(var(--household-id-card-width) * var(--household-id-card-preview-scale));
  height: calc(var(--household-id-card-height) * var(--household-id-card-preview-scale));
  overflow: visible;
}

.household-id-card {
  width: var(--household-id-card-width);
  height: var(--household-id-card-height);
  background: #fff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  transform: scale(var(--household-id-card-preview-scale));
  transform-origin: top left;
  overflow: hidden;
}

.household-id-card__header {
  display: block;
  width: 100%;
  height: var(--household-id-card-header-height);
  object-fit: cover;
  flex-shrink: 0;
}

.household-id-card__body {
  height: var(--household-id-card-body-height);
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 16px 36px 18px;
  box-sizing: border-box;
  min-height: 0;
}

.household-id-card__name {
  margin: 0 0 14px;
  font-size: 32px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-align: center;
  color: #111;
  flex-shrink: 0;
}

.household-id-card__details {
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

.household-id-card__row {
  display: grid;
  grid-template-columns: 108px 1fr;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 22px;
  line-height: 1.2;
  color: #111;
}

.household-id-card__row dt {
  font-weight: 700;
}

.household-id-card__row dt::after {
  content: ' :';
}

.household-id-card__row dd {
  margin: 0;
  font-weight: 500;
}

.household-id-card__barcode {
  margin-top: auto;
  padding-top: 8px;
  text-align: center;
  flex-shrink: 0;
}

.household-id-card__barcode-svg {
  display: block;
  width: 100%;
  max-width: 480px;
  height: 96px;
  margin: 0 auto;
}

.household-id-card__barcode-value {
  margin: 8px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  color: #111;
}

@media print {
  .household-id-card-preview {
    width: var(--household-id-card-width);
    height: var(--household-id-card-height);
  }

  .household-id-card {
    transform: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
