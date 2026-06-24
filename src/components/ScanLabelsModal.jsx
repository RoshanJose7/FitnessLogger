import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Camera, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { scanImage } from '../lib/scanLabel'
import { MEAL_TYPES } from '../lib/exercises'

function defaultMealType() {
  const h = new Date().getHours()
  if (h < 11) return 'Breakfast'
  if (h < 15) return 'Lunch'
  if (h < 18) return 'Snacks'
  return 'Dinner'
}

let cardIdCounter = 0
function newCardId() { return ++cardIdCounter }

const EMPTY_MANUAL = { food: '', calories: '', protein_g: '' }

export default function ScanLabelsModal({ isOpen, onClose, onConfirm }) {
  const [mealType, setMealType] = useState(defaultMealType)
  const [cards, setCards] = useState([])
  const [manualItems, setManualItems] = useState([{ ...EMPTY_MANUAL }])
  const processingRef = useRef(false)
  const fileInputRef = useRef(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMealType(defaultMealType())
      setCards([])
      setManualItems([{ ...EMPTY_MANUAL }])
      processingRef.current = false
    }
  }, [isOpen])

  // Sequential processing queue: when cards change, check if we can start the next one
  useEffect(() => {
    if (processingRef.current) return
    const next = cards.find(c => c.status === 'queued')
    if (!next) return

    processingRef.current = true
    setCards(prev => prev.map(c => c.id === next.id ? { ...c, status: 'scanning' } : c))

    scanImage(next.file)
      .then(data => {
        setCards(prev => prev.map(c =>
          c.id === next.id
            ? { ...c, status: 'done', data, portionG: 100, portionMult: 1, flash: true }
            : c
        ))
        // Clear flash after animation
        setTimeout(() => {
          setCards(prev => prev.map(c => c.id === next.id ? { ...c, flash: false } : c))
        }, 750)
      })
      .catch(() => {
        setCards(prev => prev.map(c =>
          c.id === next.id ? { ...c, status: 'error' } : c
        ))
      })
      .finally(() => {
        processingRef.current = false
      })
  }, [cards])

  const handleFiles = useCallback((files) => {
    const newCards = Array.from(files).map(file => ({
      id: newCardId(),
      file,
      preview: URL.createObjectURL(file),
      status: 'queued',
      data: null,
      portionG: 100,    // used when source=openfoodfacts
      portionMult: 1,   // used when source=ocr
      nameOverride: '',
      flash: false,
    }))
    setCards(prev => [...prev, ...newCards])
  }, [])

  function removeCard(id) {
    setCards(prev => {
      const c = prev.find(x => x.id === id)
      if (c?.preview) URL.revokeObjectURL(c.preview)
      return prev.filter(x => x.id !== id)
    })
  }

  function updateCard(id, patch) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function addManualRow() {
    setManualItems(prev => [...prev, { ...EMPTY_MANUAL }])
  }

  function updateManual(idx, field, value) {
    setManualItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function removeManual(idx) {
    setManualItems(prev => prev.filter((_, i) => i !== idx))
  }

  function handleConfirm() {
    const items = []

    for (const card of cards) {
      if (card.status !== 'done' && card.status !== 'error') continue
      const name = card.nameOverride || card.data?.food || ''
      let cal = null
      let pro = null

      if (card.data) {
        if (card.data.source === 'openfoodfacts') {
          const g = Number(card.portionG) || 0
          cal = card.data.calories_per_100g != null ? Math.round(card.data.calories_per_100g * g / 100) : null
          pro = card.data.protein_g_per_100g != null ? Math.round(card.data.protein_g_per_100g * g / 100 * 10) / 10 : null
        } else if (card.data.source === 'ocr') {
          const m = Number(card.portionMult) || 1
          cal = card.data.calories_per_serving != null ? Math.round(card.data.calories_per_serving * m) : null
          pro = card.data.protein_g_per_serving != null ? Math.round(card.data.protein_g_per_serving * m * 10) / 10 : null
        }
      }

      if (name || cal != null || pro != null) {
        items.push({ food: name, calories: cal != null ? String(cal) : '', protein_g: pro != null ? String(pro) : '' })
      }
    }

    for (const row of manualItems) {
      if (row.food || row.calories || row.protein_g) {
        items.push({ food: row.food, calories: row.calories, protein_g: row.protein_g })
      }
    }

    if (items.length > 0) onConfirm(mealType, items)
    onClose()
  }

  if (!isOpen) return null

  const scanningCount = cards.filter(c => c.status === 'scanning').length
  const queuedCount = cards.filter(c => c.status === 'queued').length
  const processingIndex = cards.findIndex(c => c.status === 'scanning')
  const totalProcessing = cards.filter(c => c.status === 'scanning' || c.status === 'queued').length + (processingIndex >= 0 ? 0 : 0)
  const doneCount = cards.filter(c => c.status === 'done' || c.status === 'error').length

  const hasConfirmable =
    cards.some(c => c.status === 'done' || c.status === 'error') ||
    manualItems.some(r => r.food || r.calories || r.protein_g)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold">Scan Nutrition Labels</h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-black transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">

          {/* Meal type selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Log to</label>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setMealType(type)}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                    mealType === type
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 text-gray-600 hover:border-black'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Processing status banner */}
          {(scanningCount > 0 || queuedCount > 0) && (
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-gray-50 text-xs text-gray-600">
              <Loader2 size={13} className="animate-spin shrink-0" />
              <span>
                {scanningCount > 0
                  ? `Reading label ${doneCount + 1} of ${cards.length}…`
                  : `${queuedCount} label${queuedCount > 1 ? 's' : ''} queued`}
              </span>
            </div>
          )}

          {/* Scanned cards */}
          {cards.map(card => (
            <ScannedCard
              key={card.id}
              card={card}
              onRemove={() => removeCard(card.id)}
              onUpdate={patch => updateCard(card.id, patch)}
            />
          ))}

          {/* Add photo button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-black py-4 text-sm text-gray-500 hover:text-black transition-colors"
          >
            <Camera size={18} />
            {cards.length === 0 ? 'Add a photo of a nutrition label' : 'Add another photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
          />

          {/* Manual items */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Add items manually</p>
            <div className="space-y-3">
              {manualItems.map((row, idx) => (
                <ManualRow
                  key={idx}
                  row={row}
                  showDelete={manualItems.length > 1}
                  onUpdate={(f, v) => updateManual(idx, f, v)}
                  onRemove={() => removeManual(idx)}
                />
              ))}
              <button
                onClick={addManualRow}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors"
              >
                <Plus size={13} /> Add row
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200">
        <button
          onClick={handleConfirm}
          disabled={!hasConfirmable}
          className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-40"
        >
          Add to {mealType}
        </button>
      </div>
    </div>
  )
}

function ScannedCard({ card, onRemove, onUpdate }) {
  const { status, data, flash, portionG, portionMult, nameOverride } = card

  const calCalc = (() => {
    if (!data) return null
    if (data.source === 'openfoodfacts' && data.calories_per_100g != null)
      return Math.round(data.calories_per_100g * (Number(portionG) || 0) / 100)
    if (data.source === 'ocr' && data.calories_per_serving != null)
      return Math.round(data.calories_per_serving * (Number(portionMult) || 1))
    return null
  })()

  const proCalc = (() => {
    if (!data) return null
    if (data.source === 'openfoodfacts' && data.protein_g_per_100g != null)
      return Math.round(data.protein_g_per_100g * (Number(portionG) || 0) / 100 * 10) / 10
    if (data.source === 'ocr' && data.protein_g_per_serving != null)
      return Math.round(data.protein_g_per_serving * (Number(portionMult) || 1) * 10) / 10
    return null
  })()

  return (
    <div className={`border border-gray-200 ${flash ? 'flash-highlight' : ''}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        {/* Status icon */}
        {status === 'queued' && <span className="text-xs text-gray-400">Queued</span>}
        {status === 'scanning' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" />
            {data ? 'Reading label…' : 'Scanning barcode…'}
          </span>
        )}
        {status === 'done' && <CheckCircle2 size={13} className="text-black shrink-0" />}
        {status === 'error' && <AlertTriangle size={13} className="text-gray-400 shrink-0" />}

        {/* Food name — editable once done */}
        {status === 'done' ? (
          <input
            type="text"
            value={nameOverride || data?.food || ''}
            onChange={e => onUpdate({ nameOverride: e.target.value })}
            className="flex-1 text-sm font-medium outline-none border-b border-transparent focus:border-black min-w-0 bg-transparent"
            placeholder="Food name"
          />
        ) : (
          <span className="flex-1 text-sm text-gray-400 truncate">
            {status === 'error' ? 'Couldn\'t read label' : card.file.name}
          </span>
        )}

        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-black transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {status === 'done' && data && (
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Portion control */}
          {data.source === 'openfoodfacts' ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Grams used</label>
              <input
                type="text"
                inputMode="numeric"
                value={portionG}
                onChange={e => onUpdate({ portionG: e.target.value })}
                className="w-20 border border-gray-200 px-2 py-1.5 text-sm text-center outline-none focus:border-black"
              />
              <span className="text-xs text-gray-400">g</span>
              {data.serving_size_label && (
                <span className="text-xs text-gray-400">· label serving: {data.serving_size_label}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Portion</label>
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
                <button
                  key={v}
                  onClick={() => onUpdate({ portionMult: v })}
                  className={`px-2 py-1 text-xs border transition-colors ${
                    portionMult === v ? 'bg-black text-white border-black' : 'border-gray-200 hover:border-black'
                  }`}
                >
                  {v === 1 ? '1×' : `${v}×`}
                </button>
              ))}
            </div>
          )}

          {/* Calculated macros */}
          <div className="flex gap-4 text-xs text-gray-500">
            {calCalc != null && <span><span className="font-medium text-black tabular-nums">{calCalc}</span> kcal</span>}
            {proCalc != null && <span><span className="font-medium text-black tabular-nums">{proCalc}</span>g protein</span>}
          </div>
        </div>
      )}

      {/* Error state: show manual fields */}
      {status === 'error' && (
        <div className="px-3 py-2.5">
          <ManualRow
            row={{ food: nameOverride || '', calories: '', protein_g: '' }}
            showDelete={false}
            onUpdate={(f, v) => {
              if (f === 'food') onUpdate({ nameOverride: v })
            }}
            onRemove={() => {}}
          />
        </div>
      )}
    </div>
  )
}

function ManualRow({ row, showDelete, onUpdate, onRemove }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Food description (e.g. 1 cup basmati rice)"
          value={row.food}
          onChange={e => onUpdate('food', e.target.value)}
          className="flex-1 border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-black min-w-0"
        />
        {showDelete && (
          <button onClick={onRemove} className="p-1.5 text-gray-300 hover:text-black transition-colors shrink-0">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Calories (kcal)"
          value={row.calories}
          onChange={e => onUpdate('calories', e.target.value)}
          className="border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-black"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Protein (g)"
          value={row.protein_g}
          onChange={e => onUpdate('protein_g', e.target.value)}
          className="border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-black"
        />
      </div>
    </div>
  )
}
