/**
 * Node.js test for the scan pipeline.
 * Run: node test-scan.mjs
 *
 * Tests barcode detection via zxing-wasm + Open Food Facts,
 * then OCR via tesseract.js for each image in testdata/.
 */

import { readFile } from 'fs/promises'
import { Jimp } from 'jimp'
import { readBarcodesFromImageFile, setZXingModuleOverrides } from 'zxing-wasm/reader'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Node's fetch() rejects bare file paths — load WASM as a Buffer and pass directly
const wasmPath = join(__dirname, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm')
const wasmBuf = await readFile(wasmPath)
setZXingModuleOverrides({ wasmBinary: wasmBuf.buffer })

const IMAGES = ['doritos.png', 'milk.png', 'schnitzel.png', 'yogurt.png']

// ── helpers ──────────────────────────────────────────────────────────────────

async function fileToBlob(filePath) {
  const buf = await readFile(filePath)
  // zxing-wasm in Node expects a Blob-like; pass as Buffer (it accepts ArrayBuffer/Uint8Array)
  return new Blob([buf])
}

async function detectBarcode(filePath) {
  const image = await Jimp.read(filePath)
  const W = image.bitmap.width
  const H = image.bitmap.height

  const scan = async (sx, sy, sw, sh) => {
    const cropped = image.clone().crop({ x: sx, y: sy, w: sw, h: sh })
    const buf = await cropped.getBuffer('image/jpeg')
    const blob = new Blob([buf])
    const results = await readBarcodesFromImageFile(blob, { tryHarder: true })
    return results?.[0]?.text ?? null
  }

  const crops = [
    [0, 0, W, H],
    [0, Math.floor(H / 2), W, Math.floor(H / 2)],
    [0, 0, W, Math.floor(H / 2)],
    [Math.floor(W / 2), Math.floor(H / 2), Math.floor(W / 2), Math.floor(H / 2)],
    [0, Math.floor(H / 2), Math.floor(W / 2), Math.floor(H / 2)],
  ]

  for (const [sx, sy, sw, sh] of crops) {
    const r = await scan(sx, sy, sw, sh)
    if (r) return r
  }
  return null
}

async function lookupOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v1/product/${barcode}.json?fields=product_name,product_name_en,serving_size,servings_per_container,nutriments`
  const res = await fetch(url, { headers: { 'User-Agent': 'FitnessLogger/1.0 (test)' } })
  const json = await res.json()
  if (json.status !== 1 || !json.product) return null
  const p = json.product
  const n = p.nutriments || {}
  const cal = n['energy-kcal_100g'] ?? n['energy_kcal_100g'] ?? null
  const pro = n['proteins_100g'] ?? null
  return {
    food: p.product_name_en || p.product_name || `Barcode ${barcode}`,
    calories_per_100g: cal != null ? Math.round(cal) : null,
    protein_g_per_100g: pro != null ? Math.round(pro * 10) / 10 : null,
    serving_size_label: p.serving_size || null,
  }
}

function parseNutritionText(text) {
  const result = {}
  const t = text.replace(/\r/g, ' ').replace(/\n/g, ' ')
  const calMatch =
    t.match(/calories[^\d]*(\d{2,4})(?:\s|$)/i) ||
    t.match(/\((\d{2,4})\s*[cC]al\)/) ||
    t.match(/(\d{3,4})\s*[cC]al\b/)
  if (calMatch) result.calories = Number(calMatch[1])
  const proMatch = t.match(/protein\b.*?(\d{1,3}(?:\.\d+)?)\s*g\b/i)
  if (proMatch) result.protein = parseFloat(proMatch[1])
  return result
}

async function runOCR(filePath) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, { logger: () => {} })
  const { data: { text } } = await worker.recognize(filePath)
  await worker.terminate()
  return text
}

// ── main ─────────────────────────────────────────────────────────────────────

for (const img of IMAGES) {
  const filePath = join(__dirname, 'testdata', img)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`IMAGE: ${img}`)
  console.log('═'.repeat(60))

  // Step 1: barcode
  let barcode = null
  try {
    barcode = await detectBarcode(filePath)
    console.log(`Barcode: ${barcode ?? 'not found'}`)
  } catch (e) {
    console.log(`Barcode error: ${e.message}`)
  }

  // Step 2: Open Food Facts
  if (barcode) {
    try {
      const data = await lookupOFF(barcode)
      if (data) {
        console.log(`✅ OFF result:`, JSON.stringify(data, null, 2))
        continue  // success — skip OCR
      } else {
        console.log(`OFF: barcode ${barcode} not in database`)
      }
    } catch (e) {
      console.log(`OFF error: ${e.message}`)
    }
  }

  // Step 3: OCR
  console.log(`Running Tesseract OCR…`)
  try {
    const text = await runOCR(filePath)
    console.log(`\nRaw OCR text:\n${text}\n`)
    const parsed = parseNutritionText(text)
    console.log(`Parsed nutrition:`, parsed)
    if (parsed.calories == null && parsed.protein == null) {
      console.log(`⚠️  No nutrition data extracted from OCR`)
    } else {
      console.log(`✅ OCR result: ${parsed.calories ?? '?'} kcal, ${parsed.protein ?? '?'}g protein`)
    }
  } catch (e) {
    console.log(`OCR error: ${e.message}`)
  }
}
