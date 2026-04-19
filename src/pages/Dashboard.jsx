import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, UtensilsCrossed, CheckCircle2, Circle, Flame, BarChart2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES, PROTEIN_TARGET_PER_KG, DEFAULT_BODYWEIGHT_KG, WATER_TARGET_L } from '../lib/exercises'

function today() {
  return new Date().toISOString().split('T')[0]
}

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// Returns [weekStart, weekEnd] as YYYY-MM-DD strings (Mon–Sun)
function currentWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]]
}

function parseWeight(str) {
  if (!str) return null
  const m = String(str).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

function calcStreakSimple(sessions) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))
  let count = 0
  for (const s of sorted) {
    if (s.completed) count++
    else break
  }
  return count
}

export default function Dashboard({ session }) {
  const [workout, setWorkout] = useState(null)
  const [nutrition, setNutrition] = useState(null)
  const [meals, setMeals] = useState([])
  const [streak, setStreak] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [weekSummary, setWeekSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const date = today()
      const uid = session.user.id
      const [weekStart, weekEnd] = currentWeekRange()

      const [{ data: ws }, { data: nl }, { data: allSessions }, { data: weekSessions }, { data: weekNutrition }] =
        await Promise.all([
          supabase.from('workout_sessions').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
          supabase.from('nutrition_logs').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
          supabase.from('workout_sessions').select('date, completed').eq('user_id', uid).order('date', { ascending: false }),
          supabase.from('workout_sessions').select('id, completed, date').eq('user_id', uid).gte('date', weekStart).lte('date', weekEnd),
          supabase.from('nutrition_logs').select('id, date').eq('user_id', uid).gte('date', weekStart).lte('date', weekEnd),
        ])

      setWorkout(ws)
      setNutrition(nl)
      setStreak(calcStreakSimple(allSessions || []))
      setTotalSessions((allSessions || []).filter(s => s.completed).length)

      if (nl) {
        const { data: ms } = await supabase.from('meals').select('*').eq('nutrition_log_id', nl.id)
        setMeals(ms || [])
      }

      // Build weekly summary
      const completedThisWeek = (weekSessions || []).filter(s => s.completed).length
      const weekSessionIds = (weekSessions || []).map(s => s.id)
      const weekNutritionIds = (weekNutrition || []).map(n => n.id)

      let totalVolume = 0
      let avgProtein = null
      let avgCalories = null

      if (weekSessionIds.length) {
        const { data: weekSets } = await supabase
          .from('exercise_sets').select('weight, reps').in('session_id', weekSessionIds)
        for (const s of weekSets || []) {
          const w = parseWeight(s.weight)
          const r = parseWeight(s.reps)
          if (w && r) totalVolume += w * r
        }
      }

      if (weekNutritionIds.length) {
        const { data: weekMeals } = await supabase
          .from('meals').select('calories, protein_g').in('nutrition_log_id', weekNutritionIds)
        const days = weekNutritionIds.length
        const totCal = (weekMeals || []).reduce((s, m) => s + (m.calories || 0), 0)
        const totPro = (weekMeals || []).reduce((s, m) => s + (m.protein_g || 0), 0)
        if (days > 0) { avgCalories = Math.round(totCal / days); avgProtein = Math.round(totPro / days) }
      }

      setWeekSummary({ completedThisWeek, totalVolume: Math.round(totalVolume), avgProtein, avgCalories, weekStart, weekEnd })
      setLoading(false)
    }
    load()
  }, [session])

  const proteinTarget = Math.round(DEFAULT_BODYWEIGHT_KG * PROTEIN_TARGET_PER_KG)
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalProtein = meals.reduce((s, m) => s + (m.protein_g || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{fmt(today())}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's how today's looking</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 border border-gray-200 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Streak card */}
          <div className={`border p-4 flex items-center justify-between ${streak > 0 ? 'border-black bg-black text-white' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <Flame size={20} className={streak > 0 ? 'text-white' : 'text-gray-300'} />
              <div>
                <p className={`text-sm font-medium ${streak > 0 ? 'text-white' : 'text-gray-400'}`}>
                  {streak > 0 ? `${streak} session streak` : 'No streak yet'}
                </p>
                <p className={`text-xs mt-0.5 ${streak > 0 ? 'text-gray-300' : 'text-gray-400'}`}>
                  {totalSessions} total sessions completed
                </p>
              </div>
            </div>
            {streak > 0 && <span className="text-4xl font-bold tabular-nums">{streak}</span>}
          </div>

          {/* Weekly summary card */}
          {weekSummary && (
            <div className="border border-black p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={18} />
                <span className="font-medium">This Week</span>
                <span className="text-xs text-gray-400 ml-auto">Mon – Sun</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <WeekStat
                  label="Sessions"
                  value={`${weekSummary.completedThisWeek}/3`}
                  ok={weekSummary.completedThisWeek >= 3}
                  note={weekSummary.completedThisWeek >= 3 ? '✓ target hit' : `${3 - weekSummary.completedThisWeek} to go`}
                />
                <WeekStat
                  label="Volume"
                  value={weekSummary.totalVolume > 0 ? `${(weekSummary.totalVolume / 1000).toFixed(1)}t` : '–'}
                  note="total kg lifted"
                />
                <WeekStat
                  label="Avg Protein"
                  value={weekSummary.avgProtein != null ? `${weekSummary.avgProtein}g` : '–'}
                  ok={weekSummary.avgProtein >= proteinTarget}
                  note={weekSummary.avgProtein != null
                    ? weekSummary.avgProtein >= proteinTarget ? '✓ on target' : `target ${proteinTarget}g`
                    : 'no data'}
                />
                <WeekStat
                  label="Avg Calories"
                  value={weekSummary.avgCalories != null ? weekSummary.avgCalories : '–'}
                  note="per day"
                />
              </div>
            </div>
          )}

          {/* Workout card */}
          <div className="border border-black p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dumbbell size={18} />
                <span className="font-medium">Workout</span>
              </div>
              {workout?.completed ? (
                <CheckCircle2 size={18} className="text-black" />
              ) : (
                <Circle size={18} className="text-gray-300" />
              )}
            </div>
            {workout ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {SESSION_TYPES[workout.session_type]?.label ?? workout.session_type} — Energy {workout.energy_level}/5
                </p>
                <p className="text-xs text-gray-500">
                  {workout.completed ? 'Session complete' : 'Session in progress'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No workout logged yet</p>
                <Link to="/workout" className="inline-block bg-black text-white text-xs px-3 py-1.5 font-medium hover:bg-gray-900 transition-colors">
                  Log workout
                </Link>
              </div>
            )}
          </div>

          {/* Nutrition card */}
          <div className="border border-black p-4">
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed size={18} />
              <span className="font-medium">Nutrition</span>
            </div>
            {nutrition ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Calories" value={totalCalories || '–'} />
                  <Stat
                    label="Protein (g)"
                    value={totalProtein || '–'}
                    note={totalProtein >= proteinTarget ? '✓ target' : `target ${proteinTarget}g`}
                    ok={totalProtein >= proteinTarget}
                  />
                  <Stat
                    label="Water (L)"
                    value={nutrition.water_l || '–'}
                    note={nutrition.water_l >= WATER_TARGET_L ? '✓ target' : `target ${WATER_TARGET_L}L`}
                    ok={nutrition.water_l >= WATER_TARGET_L}
                  />
                </div>
                <Link to="/nutrition" className="inline-block text-xs text-gray-500 underline underline-offset-2 mt-1">
                  Edit today's nutrition
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No nutrition logged yet</p>
                <Link to="/nutrition" className="inline-block bg-black text-white text-xs px-3 py-1.5 font-medium hover:bg-gray-900 transition-colors">
                  Log nutrition
                </Link>
              </div>
            )}
          </div>

          {/* Daily targets reminder */}
          <div className="border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-600">
              Daily target: <span className="font-medium">{proteinTarget}g protein</span> ·{' '}
              <span className="font-medium">{WATER_TARGET_L}L water</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, note, ok }) {
  return (
    <div className="border border-gray-200 p-2">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-semibold leading-none">{value}</p>
      {note && <p className={`text-xs mt-0.5 ${ok ? 'text-black' : 'text-gray-400'}`}>{note}</p>}
    </div>
  )
}

function WeekStat({ label, value, note, ok }) {
  return (
    <div className="bg-gray-50 p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-xl font-semibold leading-tight">{value}</p>
      {note && <p className={`text-xs mt-0.5 ${ok ? 'text-black font-medium' : 'text-gray-400'}`}>{note}</p>}
    </div>
  )
}
