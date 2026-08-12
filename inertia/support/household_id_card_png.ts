export const HOUSEHOLD_ID_CARD_WIDTH = 591
export const HOUSEHOLD_ID_CARD_HEIGHT = 889
export const HOUSEHOLD_ID_CARD_HEADER_HEIGHT = 532

export type HouseholdIdCardPngInput = {
  headerSrc: string
  headName: string
  villageLabel: string
  nrc: string
  phone: string
  barcode: string
  barcodeSvg: SVGSVGElement | null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGSVGElement
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    const serialized = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to render barcode SVG'))
    }
    image.src = url
  })
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return y

  let line = ''
  let cursorY = y

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY)
      line = word
      cursorY += lineHeight
      continue
    }
    line = candidate
  }

  if (line) {
    ctx.fillText(line, x, cursorY)
    cursorY += lineHeight
  }

  return cursorY
}

export async function renderHouseholdIdCardPng(input: HouseholdIdCardPngInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = HOUSEHOLD_ID_CARD_WIDTH
  canvas.height = HOUSEHOLD_ID_CARD_HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is not supported in this browser')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, HOUSEHOLD_ID_CARD_WIDTH, HOUSEHOLD_ID_CARD_HEIGHT)

  const header = await loadImage(input.headerSrc)
  ctx.drawImage(header, 0, 0, HOUSEHOLD_ID_CARD_WIDTH, HOUSEHOLD_ID_CARD_HEADER_HEIGHT)

  const bodyTop = HOUSEHOLD_ID_CARD_HEADER_HEIGHT
  const paddingX = 36
  const paddingTop = 16
  const paddingBottom = 18
  let y = bodyTop + paddingTop

  ctx.fillStyle = '#111111'
  ctx.textAlign = 'center'
  ctx.font = '800 32px system-ui, -apple-system, Segoe UI, sans-serif'
  y = drawWrappedText(
    ctx,
    input.headName.trim().toUpperCase(),
    HOUSEHOLD_ID_CARD_WIDTH / 2,
    y + 32,
    HOUSEHOLD_ID_CARD_WIDTH - paddingX * 2,
    36
  )
  y += 14

  const labelX = paddingX
  const valueX = paddingX + 108 + 6
  const valueMaxWidth = HOUSEHOLD_ID_CARD_WIDTH - valueX - paddingX
  const rows: [string, string][] = [
    ['Village', input.villageLabel],
    ['NRC', input.nrc],
    ['Phone', input.phone],
  ]

  ctx.textAlign = 'left'
  for (const [label, value] of rows) {
    ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif'
    ctx.fillText(`${label} :`, labelX, y + 22)
    ctx.font = '500 22px system-ui, -apple-system, Segoe UI, sans-serif'
    drawWrappedText(ctx, value, valueX, y + 22, valueMaxWidth, 27)
    y += 34
  }

  const barcodeWidth = 480
  const barcodeHeight = 96
  const barcodeX = (HOUSEHOLD_ID_CARD_WIDTH - barcodeWidth) / 2
  const valueBaselineY = HOUSEHOLD_ID_CARD_HEIGHT - paddingBottom
  const barcodeY = valueBaselineY - 8 - 26 - barcodeHeight

  if (input.barcodeSvg) {
    const barcodeImage = await svgToImage(input.barcodeSvg)
    ctx.drawImage(barcodeImage, barcodeX, barcodeY, barcodeWidth, barcodeHeight)
  }

  ctx.textAlign = 'center'
  ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  ctx.fillText(input.barcode, HOUSEHOLD_ID_CARD_WIDTH / 2, valueBaselineY)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function householdIdCardFilename(headName: string, barcode: string): string {
  const slug = headName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const safeBarcode = barcode.trim().replace(/[^a-zA-Z0-9_-]+/g, '')
  const base = slug || 'household'
  return safeBarcode ? `${base}-${safeBarcode}.png` : `${base}-id-card.png`
}
