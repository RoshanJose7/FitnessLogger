import { readBarcodesFromImageFile, setZXingModuleOverrides } from 'zxing-wasm/reader'
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Vite hashes asset filenames at build time — tell zxing-wasm where to find its WASM
setZXingModuleOverrides({
  locateFile: (path) => path.endsWith('.wasm') ? zxingWasmUrl : path,
})

/**
 * Scan a File/Blob for a barcode, then look up Open Food Facts.
 * Falls back to Tesseract OCR if no barcode or product not found.
 *
 * Returns:
 *   {
 *     source: 'openfoodfacts' | 'ocr',
 *     food: string,
 *     // openfoodfacts: per 100g
 *     calories_per_100g?: number,
 *     protein_g_per_100g?: number,
 *     servings_per_container?: number,
 *     serving_size_label?: string,
 *     // ocr: per serving as printed on label
 *     calories_per_serving?: number,
 *     protein_g_per_serving?: number,
 *   }
 *
 * Throws { reason: 'no_data' } on unrecoverable failure.
 */
export async function scanImage(file) {
  // --- Step 1: Try barcode ---
  let barcode = null
  try {
    barcode = await detectBarcode(file)
  } catch {
    // WASM init or decode failed — fall through to OCR
  }

  // --- Step 2: Open Food Facts lookup ---
  if (barcode) {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v1/product/${barcode}.json?fields=product_name,product_name_en,serving_size,servings_per_container,nutriments`,
        { headers: { 'User-Agent': 'FitnessLogger/1.0 (personal use)' } }
      )
      const json = await res.json()
      if (json.status === 1 && json.product) {
        const p = json.product
        const n = p.nutriments || {}
        const cal = n['energy-kcal_100g'] ?? n['energy_kcal_100g'] ?? null
        const pro = n['proteins_100g'] ?? null
        const name = p.product_name_en || p.product_name || `Barcode ${barcode}`

        if (cal != null || pro != null) {
          return {
            source: 'openfoodfacts',
            food: name,
            calories_per_100g: cal != null ? Math.round(cal) : null,
            protein_g_per_100g: pro != null ? Math.round(pro * 10) / 10 : null,
            servings_per_container: p.servings_per_container ? Number(p.servings_per_container) : null,
            serving_size_label: p.serving_size || null,
          }
        }
      }
    } catch {
      // Network error — fall through to OCR
    }
  }

  // --- Step 3: Tesseract OCR ---
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng', 1, { logger: () => {} })
    const preprocessed = await preprocessForOCR(file)
    const { data: { text } } = await worker.recognize(preprocessed)
    await worker.terminate()

    const parsed = parseNutritionText(text)
    if (parsed.calories != null || parsed.protein != null) {
      return {
        source: 'ocr',
        food: parsed.food || '',
        calories_per_serving: parsed.calories,
        protein_g_per_serving: parsed.protein,
        serving_size_label: parsed.servingSize || null,
        servings_per_container: parsed.servingsPerContainer || null,
      }
    }
  } catch {
    // Tesseract failed
  }

  throw { reason: 'no_data' }
}

/**
 * Try to detect a barcode by scanning the full image first, then
 * quarter-crops. Barcodes are often small in full product shots, so
 * cropping zooms zxing in on the region that actually contains them.
 */
async function detectBarcode(file) {
  const bitmap = await createImageBitmap(file)
  const W = bitmap.width
  const H = bitmap.height

  const scan = async (sx, sy, sw, sh) => {
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92))
    const results = await readBarcodesFromImageFile(blob, { tryHarder: true })
    return results?.[0]?.text ?? null
  }

  // Try full image, then the four quadrants (barcodes often in bottom corners)
  const crops = [
    [0, 0, W, H],           // full
    [0, H / 2, W, H / 2],  // bottom half
    [0, 0, W, H / 2],       // top half
    [W / 2, H / 2, W / 2, H / 2], // bottom-right
    [0, H / 2, W / 2, H / 2],     // bottom-left
  ]

  for (const [sx, sy, sw, sh] of crops) {
    const result = await scan(sx, sy, sw, sh)
    if (result) return result
  }
  return null
}

/**
 * Preprocess image before OCR: scale to reasonable size, convert to
 * greyscale, and boost contrast so Tesseract reads small digits correctly.
 */
async function preprocessForOCR(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')

  // Cap at 2000px on the longest side — larger doesn't help Tesseract
  const maxDim = 2000
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    // Greyscale (luminance weights)
    const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    // Contrast stretch: push midtones apart so text separates from background
    const c = Math.min(255, Math.max(0, (grey - 128) * 1.8 + 128))
    d[i] = d[i + 1] = d[i + 2] = c
  }
  ctx.putImageData(imgData, 0, 0)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Parse raw OCR text from a nutrition label.
 * Handles both North American ("Calories 220") and
 * Australian/metric formats ("1100kJ (263Cal)" or "Energy 734kJ (176Cal)").
 */
function parseNutritionText(text) {
  const result = {}
  const t = text.replace(/\r/g, ' ').replace(/\n/g, ' ')

  // --- Calories ---
  // Priority 1: North American "Calories 220"
  // Priority 2: Australian parenthesised Cal "(263Cal)" — first occurrence = per serving
  // Priority 3: bare "263Cal" or "263 Cal"
  const calMatch =
    t.match(/calories[^\d]*(\d{2,4})(?:\s|$)/i) ||
    t.match(/\((\d{2,4})\s*[cC]al\)/) ||
    t.match(/(\d{3,4})\s*[cC]al\b/)
  if (calMatch) result.calories = Number(calMatch[1])

  // --- Protein ---
  // "Protein 23.4g" or "Protein 26 g"
  // Use lazy .*? so multi-column OCR noise ("16.6g 33% 8.3g" → "1669 33% 83g")
  // doesn't prevent us from finding the first digit-group actually followed by 'g'
  const proMatch = t.match(/protein\b.*?(\d{1,3}(?:\.\d+)?)\s*g\b/i)
  if (proMatch) result.protein = parseFloat(proMatch[1])

  // --- Serving size ---
  const servMatch = t.match(/serving\s+size[:\s]+([^\n,]{3,30})/i)
  if (servMatch) result.servingSize = servMatch[1].trim().replace(/\s+/g, ' ')

  // --- Servings per container/package ---
  const spcMatch = t.match(/(?:about\s+)?(\d+(?:\.\d+)?)\s+servings?\s+per\s+(?:container|package)/i)
  if (spcMatch) result.servingsPerContainer = Number(spcMatch[1])

  return result
}
