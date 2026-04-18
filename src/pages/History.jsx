import { useState, useEffect } from 'react'
import { ChevronDown, Dumbbell, UtensilsCrossed, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES } from '../lib/exercises'

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function History({ session }) {
  const [tab, setTab] = useState('workout')
  const [workouts, setWorkouts] = useState([])
  const [nutritionLogs, setNutritionLogs] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const uid = session.user.id
      const [{ data: ws }, { data: nl }] = await Promise.all([
        supabase.from('workout_sessions').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('nutrition_logs').select('*').eq('user_id', uid).order('date', { ascending: false }),
      ])
      setWorkouts(ws || [])
      setNutritionLogs(nl || [])
      setLoading(false)
    }
    load()
  }, [session])

  async function toggleWorkout(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (detail[id]) return
    const [{ data: sets }, { data: cardio }] = await Promise.all([
      supabase.from('exercise_sets').select('*').eq('session_id', id).order('set_number'),
      supabase.from('cardio_logs').select('*').eq('session_id', id).maybeSingle(),
    ])
    setDetail(prev => ({ ...prev, [id]: { sets: sets || [], cardio } }))
  }

  async function toggleNutrition(id) {
    if (expanded === `n${id}`) { setExpanded(null); return }
    setExpanded(`n${id}`)
    if (detail[`n${id}`]) return
    const { data: meals } = await supabase.from('meals').select('*').eq('nutrition_log_id', id).order('id')
    setDetail(prev => ({ ...prev, [`n${id}`]: { meals: meals || [] } }))
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 border border-gray-200 animate-pulse bg-gray-50" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>

      {/* Tab switcher */}
      <div className="flex border border-black">
        {['workout', 'nutrition'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpanded(null) }}
            className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-black text-white' : 'hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'workout' && (
        <div className="space-y-2">
          {workouts.length === 0 && (
            <p className="text-sm text-gray-500 py-4">No workouts logged yet.</p>
          )}
          {workouts.map(w => {
            const config = SESSION_TYPES[w.session_type]
            const isOpen = expanded === w.id
            const d = detail[w.id]
            return (
              <div key={w.id} className="border border-black">
                <button
                  onClick={() => toggleWorkout(w.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Dumbbell size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{config?.label || w.session_type}</p>
                      <p className="text-xs text-gray-500">{fmt(w.date)} · Energy {w.energy_level}/5</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.completed && <CheckCircle2 size={14} className="text-black" />}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && d && (
                  <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-4">
                    {Object.entries(groupSets(d.sets)).map(([ex, sets]) => (
                      <div key={ex}>
                        <p className="text-xs font-medium mb-1.5">{ex}</p>
                        <div className="space-y-1">
                          {sets.map((s, i) => (
                            <div key={i} className="flex gap-3 text-xs text-gray-600">
                              <span className="text-gray-400 w-4">S{s.set_number}</span>
                              <span>{s.weight || '–'}</span>
                              <span>×</span>
                              <span>{s.reps || '–'} reps</span>
                              {s.notes && <span className="text-gray-400">{s.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {d.cardio && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium mb-1">Cardio</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {d.cardio.distance && <p>Distance: {d.cardio.distance}</p>}
                          {d.cardio.duration && <p>Time: {d.cardio.duration}</p>}
                          {d.cardio.pace && <p>Pace: {d.cardio.pace}</p>}
                          {d.cardio.felt && <p>Felt: {d.cardio.felt}/5</p>}
                          {d.cardio.notes && <p>Notes: {d.cardio.notes}</p>}
                        </div>
                      </div>
                    )}
                    {w.notes && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-500">{w.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'nutrition' && (
        <div className="space-y-2">
          {nutritionLogs.length === 0 && (
            <p className="text-sm text-gray-500 py-4">No nutrition logged yet.</p>
          )}
          {nutritionLogs.map(n => {
            const isOpen = expanded === `n${n.id}`
            const d = detail[`n${n.id}`]
            const meals = d?.meals || []
            const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0)
            const totalPro = meals.reduce((s, m) => s + (m.protein_g || 0), 0)
            return (
              <div key={n.id} className="border border-black">
                <button
                  onClick={() => toggleNutrition(n.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{fmt(n.date)}</p>
                      <p className="text-xs text-gray-500">
                        {n.is_workout_day ? 'Workout day' : 'Rest day'} · Water: {n.water_l || '–'}L
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && d && (
                  <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-3">
                    {groupMeals(meals).map(([type, items]) => (
                      <div key={type}>
                        <p className="text-xs font-medium mb-1">{type}</p>
                        {items.map((m, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
                            <span>{m.food || '–'}</span>
                            <span className="text-gray-400">{m.calories ? `${m.calories} kcal` : ''} {m.protein_g ? `· ${m.protein_g}g` : ''}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {(totalCal > 0 || totalPro > 0) && (
                      <div className="border-t border-gray-100 pt-2 flex gap-4 text-xs font-medium">
                        {totalCal > 0 && <span>{totalCal} kcal</span>}
                        {totalPro > 0 && <span>{totalPro}g protein</span>}
                      </div>
                    )}
                    {n.notes && <p className="text-xs text-gray-400">{n.notes}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function groupSets(sets) {
  const grouped = {}
  for (const s of sets) {
    if (!grouped[s.exercise_name]) grouped[s.exercise_name] = []
    grouped[s.exercise_name].push(s)
  }
  return grouped
}

function groupMeals(meals) {
  const order = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
  const grouped = {}
  for (const m of meals) {
    if (!grouped[m.meal_type]) grouped[m.meal_type] = []
    grouped[m.meal_type].push(m)
  }
  return order.filter(t => grouped[t]?.length).map(t => [t, grouped[t]])
}
