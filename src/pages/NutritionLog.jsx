import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MEAL_TYPES, PROTEIN_TARGET_PER_KG, DEFAULT_BODYWEIGHT_KG, WATER_TARGET_L } from '../lib/exercises'

function today() {
  return new Date().toISOString().split('T')[0]
}

const EMPTY_MEAL_ITEM = { food: '', calories: '', protein_g: '' }

export default function NutritionLog({ session }) {
  const [logId, setLogId] = useState(null)
  const [isWorkoutDay, setIsWorkoutDay] = useState(false)
  const [waterL, setWaterL] = useState('')
  const [notes, setNotes] = useState('')
  const [mealData, setMealData] = useState(
    Object.fromEntries(MEAL_TYPES.map(m => [m, [{ ...EMPTY_MEAL_ITEM }]]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: log } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', today())
        .maybeSingle()

      if (log) {
        setLogId(log.id)
        setIsWorkoutDay(log.is_workout_day || false)
        setWaterL(log.water_l != null ? String(log.water_l) : '')
        setNotes(log.notes || '')

        const { data: meals } = await supabase
          .from('meals')
          .select('*')
          .eq('nutrition_log_id', log.id)
          .order('id')

        if (meals?.length) {
          const grouped = Object.fromEntries(MEAL_TYPES.map(m => [m, []]))
          for (const meal of meals) {
            if (grouped[meal.meal_type]) {
              grouped[meal.meal_type].push({
                food: meal.food || '',
                calories: meal.calories != null ? String(meal.calories) : '',
                protein_g: meal.protein_g != null ? String(meal.protein_g) : '',
              })
            }
          }
          for (const type of MEAL_TYPES) {
            if (grouped[type].length === 0) grouped[type] = [{ ...EMPTY_MEAL_ITEM }]
          }
          setMealData(grouped)
        }
      }
      setLoading(false)
    }
    load()
  }, [session])

  function addRow(mealType) {
    setMealData(prev => ({
      ...prev,
      [mealType]: [...prev[mealType], { ...EMPTY_MEAL_ITEM }],
    }))
  }

  function removeRow(mealType, idx) {
    setMealData(prev => ({
      ...prev,
      [mealType]: prev[mealType].filter((_, i) => i !== idx),
    }))
  }

  function updateRow(mealType, idx, field, value) {
    setMealData(prev => ({
      ...prev,
      [mealType]: prev[mealType].map((r, i) => i === idx ? { ...r, [field]: value } : r),
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      let lid = logId
      const logPayload = {
        user_id: session.user.id,
        date: today(),
        is_workout_day: isWorkoutDay,
        water_l: waterL !== '' ? Number(waterL) : null,
        notes: notes || null,
      }

      if (lid) {
        await supabase.from('nutrition_logs').update(logPayload).eq('id', lid)
        await supabase.from('meals').delete().eq('nutrition_log_id', lid)
      } else {
        const { data } = await supabase.from('nutrition_logs').insert(logPayload).select().single()
        lid = data.id
        setLogId(lid)
      }

      const mealRows = []
      for (const [mealType, rows] of Object.entries(mealData)) {
        for (const row of rows) {
          if (row.food || row.calories || row.protein_g) {
            mealRows.push({
              nutrition_log_id: lid,
              meal_type: mealType,
              food: row.food || null,
              calories: row.calories !== '' ? Number(row.calories) : null,
              protein_g: row.protein_g !== '' ? Number(row.protein_g) : null,
            })
          }
        }
      }
      if (mealRows.length) await supabase.from('meals').insert(mealRows)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const totalCalories = Object.values(mealData).flat().reduce((s, r) => s + (Number(r.calories) || 0), 0)
  const totalProtein = Object.values(mealData).flat().reduce((s, r) => s + (Number(r.protein_g) || 0), 0)
  const proteinTarget = Math.round(DEFAULT_BODYWEIGHT_KG * PROTEIN_TARGET_PER_KG)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 border border-gray-200 animate-pulse bg-gray-50" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today()}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-black font-medium">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
      </div>

      {/* Workout day toggle */}
      <div className="flex items-center justify-between border border-black px-4 py-3">
        <span className="text-sm font-medium">Workout day?</span>
        <button
          onClick={() => setIsWorkoutDay(v => !v)}
          className={`px-3 py-1 text-xs font-medium border transition-colors ${
            isWorkoutDay ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-500'
          }`}
        >
          {isWorkoutDay ? 'Yes' : 'No'}
        </button>
      </div>

      {/* Meals */}
      {MEAL_TYPES.map(mealType => (
        <MealSection
          key={mealType}
          mealType={mealType}
          rows={mealData[mealType]}
          onAdd={() => addRow(mealType)}
          onRemove={idx => removeRow(mealType, idx)}
          onUpdate={(idx, field, val) => updateRow(mealType, idx, field, val)}
        />
      ))}

      {/* Daily totals */}
      <div className="border border-black p-4">
        <h2 className="text-sm font-medium mb-3">Daily Total</h2>
        <div className="grid grid-cols-2 gap-3">
          <TotalStat label="Calories" value={totalCalories} />
          <TotalStat
            label="Protein (g)"
            value={totalProtein}
            note={totalProtein >= proteinTarget ? `✓ target ${proteinTarget}g` : `target: ${proteinTarget}g`}
            ok={totalProtein >= proteinTarget}
          />
        </div>
      </div>

      {/* Water */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Water (L) — target {WATER_TARGET_L}L
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.25"
            min="0"
            max="10"
            value={waterL}
            onChange={e => setWaterL(e.target.value)}
            placeholder="0.0"
            className="w-28 border border-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black"
          />
          <span className="text-sm text-gray-500">litres</span>
          {waterL && Number(waterL) >= WATER_TARGET_L && (
            <span className="text-xs text-black font-medium">✓ target met</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about today's eating?"
          className="w-full border border-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-black text-white py-2.5 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save nutrition log'}
      </button>
    </div>
  )
}

function MealSection({ mealType, rows, onAdd, onRemove, onUpdate }) {
  return (
    <div className="border border-black">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium">{mealType}</span>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <Plus size={14} /> Add item
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((row, idx) => (
          <div key={idx} className="px-4 py-3 space-y-2">
            <div className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Food / description"
                value={row.food}
                onChange={e => onUpdate(idx, 'food', e.target.value)}
                className="flex-1 border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black min-w-0"
              />
              {rows.length > 1 && (
                <button onClick={() => onRemove(idx)} className="text-gray-300 hover:text-black transition-colors mt-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Calories</label>
                <input
                  type="number"
                  placeholder="kcal"
                  value={row.calories}
                  onChange={e => onUpdate(idx, 'calories', e.target.value)}
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Protein (g)</label>
                <input
                  type="number"
                  placeholder="g"
                  value={row.protein_g}
                  onChange={e => onUpdate(idx, 'protein_g', e.target.value)}
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TotalStat({ label, value, note, ok }) {
  return (
    <div className="bg-gray-50 p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-2xl font-semibold">{value || 0}</p>
      {note && <p className={`text-xs mt-0.5 ${ok ? 'text-black font-medium' : 'text-gray-400'}`}>{note}</p>}
    </div>
  )
}
