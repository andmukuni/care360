<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import JsBarcode from 'jsbarcode'

const props = withDefaults(
  defineProps<{
    headName: string
    village?: string
    town?: string
    nrc?: string
    phone?: string
    barcode: string
    printableId?: string
  }>(),
  {
    village: '',
    town: '',
    nrc: '',
    phone: '',
    printableId: 'household-id-card-printable',
  }
)

const headerSrc = '/images/household-id/card-header.png'
const barcodeSvgRef = ref<SVGSVGElement | null>(null)

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
      width: 1.8,
      height: 48,
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

defineExpose({ renderBarcode })
</script>

<template>
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
</template>

<style scoped>
.household-id-card {
  width: 54mm;
  min-height: 85.6mm;
  background: #fff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.household-id-card__header {
  display: block;
  width: 100%;
  height: auto;
}

.household-id-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 4mm 4mm 3mm;
}

.household-id-card__name {
  margin: 0 0 3mm;
  font-size: 13pt;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-align: center;
  color: #111;
}

.household-id-card__details {
  margin: 0 0 auto;
  padding: 0;
}

.household-id-card__row {
  display: grid;
  grid-template-columns: 14mm 1fr;
  gap: 1.5mm;
  margin-bottom: 1.5mm;
  font-size: 9pt;
  line-height: 1.25;
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
  margin-top: 3mm;
  text-align: center;
}

.household-id-card__barcode-svg {
  display: block;
  width: 100%;
  max-width: 46mm;
  height: 12mm;
  margin: 0 auto;
}

.household-id-card__barcode-value {
  margin: 1.5mm 0 0;
  font-size: 10pt;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  color: #111;
}
</style>
