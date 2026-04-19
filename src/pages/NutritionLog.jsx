import { useState, useEffect } from 'react'
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
  const [recentFoods, setRecentFoods] = useState({})
  const [savingAs, setSavingAs] = useState(null) // null | 'saving'
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const uid = session.user.id

      const [{ data: log }, { data: recentMeals }] = await Promise.all([
        supabase.from('nutrition_logs').select('*').eq('user_id', uid).eq('date', today()).maybeSingle(),
        supabase
          .from('meals')
          .select('meal_type, food, calories, protein_g, nutrition_logs!inner(user_id, date)')
          .eq('nutrition_logs.user_id', uid)
          .lt('nutrition_logs.date', today())
          .not('food', 'is', null)
          .order('id', { ascending: false })
          .limit(200),
      ])

      const recent = {}
      for (const m of recentMeals || []) {
        if (!recent[m.meal_type]) recent[m.meal_type] = []
        const already = recent[m.meal_type].some(r => r.food?.toLowerCase() === m.food?.toLowerCase())
        if (!already && recent[m.meal_type].length < 5) {
          recent[m.meal_type].push({ food: m.food, calories: m.calories, protein_g: m.protein_g })
        }
      }
      setRecentFoods(recent)

      if (log) {
        setLogId(log.id)
        setIsWorkoutDay(log.is_workout_day || false)
        setWaterL(log.water_l != null ? String(log.water_l) : '')
        setNotes(log.notes || '')

        const { data: meals } = await supabase
          .from('meals').select('*').eq('nutrition_log_id', log.id).order('id')

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
    setMealData(prev => ({ ...prev, [mealType]: [...prev[mealType], { ...EMPTY_MEAL_ITEM }] }))
  }

  function addRecentFood(mealType, item) {
    setMealData(prev => {
      const rows = prev[mealType]
      const lastEmpty = rows.length > 0 && !rows[rows.length - 1].food && !rows[rows.length - 1].calories
      const newItem = {
        food: item.food || '',
        calories: item.calories != null ? String(item.calories) : '',
        protein_g: item.protein_g != null ? String(item.protein_g) : '',
      }
      if (lastEmpty) {
        return { ...prev, [mealType]: rows.map((r, i) => i === rows.length - 1 ? newItem : r) }
      }
      return { ...prev, [mealType]: [...rows, newItem] }
    })
  }

  function removeRow(mealType, idx) {
    setMealData(prev => ({ ...prev, [mealType]: prev[mealType].filter((_, i) => i !== idx) }))
  }

  function updateRow(mealType, idx, field, value) {
    setMealData(prev => ({
      ...prev,
      [mealType]: prev[mealType].map((r, i) => i === idx ? { ...r, [field]: value } : r),
    }))
  }

  function adjustWater(delta) {
    setWaterL(prev => {
      const next = Math.max(0, Math.round((Number(prev || 0) + delta) * 100) / 100)
      return String(next)
    })
  }

  async function handleSave() {
    setSavingAs('saving')
    setSaveError(null)
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
        const { data, error } = await supabase.from('nutrition_logs').insert(logPayload).select().single()
        if (error) throw error
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
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Failed to save. Check your connection and try again.')
    } finally {
      setSavingAs(null)
    }
  }

  const totalCalories = Object.values(mealData).flat().reduce((s, r) => s + (Number(r.calories) || 0), 0)
  const totalProtein = Object.values(mealData).flat().reduce((s, r) => s + (Number(r.protein_g) || 0), 0)
  const proteinTarget = Math.round(DEFAULT_BODYWEIGHT_KG * PROTEIN_TARGET_PER_KG)
  const waterMet = waterL !== '' && Number(waterL) >= WATER_TARGET_L

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 border border-gray-200 animate-pulse bg-gray-50" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium border border-black px-2 py-1">
            <CheckCircle2 size={13} /> Saved
          </span>
        )}
      </div>

      {/* Running totals summary */}
      {(totalCalories > 0 || totalProtein > 0) && (
        <div className="border border-black px-4 py-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total calories</p>
            <p className="text-2xl font-semibold tabular-nums">{totalCalories}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Protein</p>
            <p className={`text-2xl font-semibold tabular-nums ${totalProtein >= proteinTarget ? '' : ''}`}>
              {totalProtein}<span className="text-sm font-normal text-gray-400">g</span>
            </p>
            <p className={`text-xs mt-0.5 ${totalProtein >= proteinTarget ? 'font-medium' : 'text-gray-400'}`}>
              {totalProtein >= proteinTarget ? `✓ target ${proteinTarget}g` : `target: ${proteinTarget}g`}
            </p>
          </div>
        </div>
      )}

      {/* Workout day toggle */}
      <div className="flex items-center justify-between border border-black px-4 py-3">
        <span className="text-sm font-medium">Workout day</span>
        <button
          onClick={() => setIsWorkoutDay(v => !v)}
          className={`px-4 py-1.5 text-xs font-medium border transition-colors ${
            isWorkoutDay ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-500 hover:border-black'
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
          recent={recentFoods[mealType] || []}
          onAdd={() => addRow(mealType)}
          onAddRecent={item => addRecentFood(mealType, item)}
          onRemove={idx => removeRow(mealType, idx)}
          onUpdate={(idx, field, val) => updateRow(mealType, idx, field, val)}
        />
      ))}

      {/* Water */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Water
            <span className="text-gray-400 font-normal ml-1.5">target {WATER_TARGET_L}L</span>
          </label>
          {waterMet && <span className="text-xs font-medium">✓ target met</span>}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            inputMode="decimal"
            value={waterL}
            onChange={e => setWaterL(e.target.value)}
            placeholder="0.0"
            className="w-24 border border-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black text-center tabular-nums"
          />
          <span className="text-sm text-gray-500">litres</span>
        </div>
        <div className="flex gap-2">
          {[0.25, 0.5, 1].map(amt => (
            <button
              key={amt}
              onClick={() => adjustWater(amt)}
              className="border border-gray-200 hover:border-black px-3 py-2 text-xs font-medium transition-colors"
            >
              +{amt < 1 ? `${amt * 1000}ml` : `${amt}L`}
            </button>
          ))}
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
          className="w-full border border-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black resize-none"
        />
      </div>

      {/* Save error */}
      {saveError && (
        <div role="alert" className="border border-black bg-black text-white px-3 py-2.5 text-sm">
          {saveError}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!!savingAs}
        className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-40"
      >
        {savingAs ? 'Saving…' : 'Save nutrition log'}
      </button>
    </div>
  )
}

function MealSection({ mealType, rows, recent, onAdd, onAddRecent, onRemove, onUpdate }) {
  const mealCal = rows.reduce((s, r) => s + (Number(r.calories) || 0), 0)
  const mealPro = rows.reduce((s, r) => s + (Number(r.protein_g) || 0), 0)
  const hasData = mealCal > 0 || mealPro > 0

  return (
    <div className="border border-black">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium">{mealType}</span>
          {hasData && (
            <span className="text-xs text-gray-400 shrink-0">
              {mealCal > 0 ? `${mealCal} kcal` : ''}
              {mealCal > 0 && mealPro > 0 ? ' · ' : ''}
              {mealPro > 0 ? `${mealPro}g` : ''}
            </span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors shrink-0"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Quick-add recent foods */}
      {recent.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-gray-100">
          {recent.map((item, i) => (
            <button
              key={i}
              onClick={() => onAddRecent(item)}
              title={`${item.food}${item.calories ? ` · ${item.calories} kcal` : ''}`}
              className="text-xs border border-gray-200 px-2.5 py-1.5 hover:border-black hover:bg-gray-50 transition-colors max-w-[160px] truncate"
            >
              {item.food}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {rows.map((row, idx) => (
          <div key={idx} className="px-4 py-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Food / description"
                value={row.food}
                onChange={e => onUpdate(idx, 'food', e.target.value)}
                className="flex-1 border border-gray-200 px-2.5 py-2.5 text-sm outline-none focus:border-black min-w-0"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => onRemove(idx)}
                  className="p-2 text-gray-300 hover:text-black transition-colors shrink-0"
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Calories</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="kcal"
                  value={row.calories}
                  onChange={e => onUpdate(idx, 'calories', e.target.value)}
                  className="w-full border border-gray-200 px-2.5 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Protein (g)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="g"
                  value={row.protein_g}
                  onChange={e => onUpdate(idx, 'protein_g', e.target.value)}
                  className="w-full border border-gray-200 px-2.5 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
