<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import JsBarcode from 'jsbarcode'

const props = withDefaults(
  defineProps<{
    value: string | null | undefined
    compact?: boolean
  }>(),
  {
    compact: false,
  }
)

const svgRef = ref<SVGSVGElement | null>(null)

function renderBarcode() {
  const node = svgRef.value
  const value = props.value?.trim()
  if (!node || !value) return

  try {
    JsBarcode(node, value, {
      format: 'CODE128',
      width: props.compact ? 1 : 1.5,
      height: props.compact ? 22 : 32,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#111111',
    })
  } catch {
    node.innerHTML = ''
  }
}

onMounted(renderBarcode)
watch(() => props.value, renderBarcode)
</script>

<template>
  <div
    v-if="value?.trim()"
    class="patient-barcode"
    :class="{ 'patient-barcode--compact': compact }"
    :title="value ?? undefined"
  >
    <svg ref="svgRef" class="patient-barcode__svg" role="img" :aria-label="`Barcode ${value}`" />
  </div>
</template>

<style scoped>
.patient-barcode {
  display: inline-flex;
  align-items: center;
  border-radius: 0.25rem;
  background: #fff;
  padding: 0.15rem 0.25rem;
  line-height: 0;
}

.patient-barcode--compact {
  padding: 0.1rem 0.2rem;
}

.patient-barcode__svg {
  display: block;
  max-width: 5.5rem;
  height: auto;
}

.patient-barcode--compact .patient-barcode__svg {
  max-width: 4.25rem;
}
</style>
