import { useState, useEffect } from 'react'
import { ChevronDown, Dumbbell, UtensilsCrossed, CheckCircle2, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES } from '../lib/exercises'

// All exercises across all session types, deduplicated
const ALL_EXERCISES = [
  ...new Set(Object.values(SESSION_TYPES).flatMap(s => s.exercises)),
]

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function fmtShort(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short',
  })
}

// Extract the first numeric value from a weight string e.g. "20kg" → 20, "17.5" → 17.5
function parseWeight(str) {
  if (!str) return null
  const match = String(str).match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

export default function History({ session }) {
  const [tab, setTab] = useState('workout')
  const [workouts, setWorkouts] = useState([])
  const [nutritionLogs, setNutritionLogs] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState({})
  const [loading, setLoading] = useState(true)

  // Progress tab state
  const [selectedExercise, setSelectedExercise] = useState(ALL_EXERCISES[0])
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)

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

  useEffect(() => {
    if (tab !== 'progress') return
    loadChartData(selectedExercise)
  }, [tab, selectedExercise])

  async function loadChartData(exercise) {
    setChartLoading(true)
    const uid = session.user.id

    // Fetch all sessions for this user
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, date')
      .eq('user_id', uid)
      .order('date', { ascending: true })

    if (!sessions?.length) { setChartData([]); setChartLoading(false); return }

    const sessionIds = sessions.map(s => s.id)
    const dateById = Object.fromEntries(sessions.map(s => [s.id, s.date]))

    const { data: sets } = await supabase
      .from('exercise_sets')
      .select('session_id, weight, reps')
      .eq('exercise_name', exercise)
      .in('session_id', sessionIds)

    if (!sets?.length) { setChartData([]); setChartLoading(false); return }

    // Group by date, pick best (heaviest) set per session
    const byDate = {}
    for (const s of sets) {
      const date = dateById[s.session_id]
      const w = parseWeight(s.weight)
      if (w === null) continue
      if (!byDate[date] || w > byDate[date].weight) {
        byDate[date] = { weight: w, reps: s.reps }
      }
    }

    const data = Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, { weight, reps }]) => ({
        date,
        label: fmtShort(date),
        weight,
        reps,
      }))

    setChartData(data)
    setChartLoading(false)
  }

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

  const tabs = ['workout', 'nutrition', 'progress']

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
        {tabs.map(t => (
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

      {/* ── Workout tab ── */}
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
                {isOpen && !d && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-3 bg-gray-100 animate-pulse" />)}
                  </div>
                )}
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

      {/* ── Nutrition tab ── */}
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
                {isOpen && !d && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-3 bg-gray-100 animate-pulse" />)}
                  </div>
                )}
                {isOpen && d && (
                  <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-3">
                    {groupMeals(meals).map(([type, items]) => (
                      <div key={type}>
                        <p className="text-xs font-medium mb-1">{type}</p>
                        {items.map((m, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
                            <span>{m.food || '–'}</span>
                            <span className="text-gray-400">
                              {m.calories ? `${m.calories} kcal` : ''}{m.protein_g ? ` · ${m.protein_g}g` : ''}
                            </span>
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

      {/* ── Progress tab ── */}
      {tab === 'progress' && (
        <div className="space-y-5">
          {/* Exercise picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Exercise</label>
            <select
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              className="w-full border border-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
            >
              {ALL_EXERCISES.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          {chartLoading ? (
            <div className="h-48 border border-gray-200 animate-pulse bg-gray-50" />
          ) : chartData.length < 2 ? (
            <div className="border border-gray-200 p-6 text-center">
              <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {chartData.length === 0
                  ? 'No data logged for this exercise yet.'
                  : 'Log at least 2 sessions to see a trend.'}
              </p>
            </div>
          ) : (
            <div className="border border-black p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">{selectedExercise}</p>
                  <p className="text-xs text-gray-500">Best set weight per session</p>
                </div>
                <PRBadge data={chartData} />
              </div>

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={<CustomDot data={chartData} />}
                    activeDot={{ r: 5, fill: '#000', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Data table below chart */}
          {chartData.length > 0 && (
            <div className="border border-black divide-y divide-gray-100">
              <div className="grid grid-cols-3 px-4 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-500">Date</span>
                <span className="text-xs font-medium text-gray-500 text-center">Best weight</span>
                <span className="text-xs font-medium text-gray-500 text-right">Reps</span>
              </div>
              {[...chartData].reverse().map((row, i) => {
                const isPR = row.weight === Math.max(...chartData.map(d => d.weight))
                return (
                  <div key={i} className="grid grid-cols-3 px-4 py-2.5 items-center">
                    <span className="text-xs text-gray-600">{row.label}</span>
                    <span className={`text-xs text-center font-medium ${isPR ? 'text-black' : 'text-gray-600'}`}>
                      {row.weight}kg {isPR && <span className="text-xs">PR</span>}
                    </span>
                    <span className="text-xs text-gray-400 text-right">{row.reps || '–'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PRBadge({ data }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.weight))
  const first = data[0].weight
  const gain = max - first
  if (gain <= 0) return null
  return (
    <div className="text-right">
      <p className="text-xs text-gray-500">PR</p>
      <p className="text-sm font-semibold">{max}kg</p>
      <p className="text-xs text-gray-400">+{gain}kg since start</p>
    </div>
  )
}

function CustomDot({ cx, cy, payload, data }) {
  const max = Math.max(...(data || []).map(d => d.weight))
  const isPR = payload?.weight === max
  if (isPR) {
    return <circle cx={cx} cy={cy} r={5} fill="#000" stroke="#fff" strokeWidth={2} />
  }
  return <circle cx={cx} cy={cy} r={3} fill="#000" />
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { label, weight, reps } = payload[0].payload
  return (
    <div className="bg-black text-white px-3 py-2 text-xs">
      <p className="font-medium">{label}</p>
      <p>{weight}kg × {reps || '?'} reps</p>
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
