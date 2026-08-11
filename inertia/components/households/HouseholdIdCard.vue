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
      width: 2.4,
      height: 112,
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
  --household-id-card-width: 591px;
  --household-id-card-height: 889px;

  width: var(--household-id-card-width);
  height: var(--household-id-card-height);
  background: #fff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.household-id-card__header {
  display: block;
  width: 100%;
  height: auto;
  flex-shrink: 0;
}

.household-id-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 28px 42px 36px;
  min-height: 0;
}

.household-id-card__name {
  margin: 0 0 24px;
  font-size: 36px;
  font-weight: 800;
  line-height: 1.12;
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
  grid-template-columns: 120px 1fr;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 24px;
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
  margin-top: auto;
  padding-top: 20px;
  text-align: center;
}

.household-id-card__barcode-svg {
  display: block;
  width: 100%;
  max-width: 500px;
  height: 112px;
  margin: 0 auto;
}

.household-id-card__barcode-value {
  margin: 12px 0 0;
  font-size: 28px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  color: #111;
}
</style>
