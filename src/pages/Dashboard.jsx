import { useEffect, useState } from 'react'
import { Dumbbell, UtensilsCrossed, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES, PROTEIN_TARGET_PER_KG, DEFAULT_BODYWEIGHT_KG, WATER_TARGET_L } from '../lib/exercises'
import { currentWeekRange, buildMonthGrid, buildInsights } from '../lib/insights'

function today() {
  return new Date().toISOString().split('T')[0]
}

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function parseWeight(str) {
  if (!str) return null
  const m = String(str).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

function daysAgo(dateStr) {
  const diff = Math.round(
    (new Date(today() + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000
  )
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff} days ago`
}

export default function Dashboard({ session }) {
  const [workout, setWorkout] = useState(null)
  const [nutrition, setNutrition] = useState(null)
  const [meals, setMeals] = useState([])
  const [weekSummary, setWeekSummary] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [selectedCell, setSelectedCell] = useState(null)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const date = today()
      const uid = session.user.id
      const [weekStart, weekEnd] = currentWeekRange()

      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0]

      const [{ data: ws }, { data: nl }, { data: weekSessions }, { data: weekNutrition }, { data: recent }] =
        await Promise.all([
          supabase.from('workout_sessions').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
          supabase.from('nutrition_logs').select('*').eq('user_id', uid).eq('date', date).maybeSingle(),
          supabase.from('workout_sessions').select('id, completed, date').eq('user_id', uid).gte('date', weekStart).lte('date', weekEnd),
          supabase.from('nutrition_logs').select('id, date').eq('user_id', uid).gte('date', weekStart).lte('date', weekEnd),
          supabase.from('workout_sessions')
            .select('date, session_type, energy_level, completed')
            .eq('user_id', uid)
            .gte('date', ninetyDaysAgoStr)
            .order('date', { ascending: false }),
        ])

      setWorkout(ws)
      setNutrition(nl)
      setRecentSessions(recent || [])

      if (nl) {
        const { data: ms } = await supabase.from('meals').select('*').eq('nutrition_log_id', nl.id)
        setMeals(ms || [])
      }

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
        if (days > 0) {
          avgCalories = Math.round(totCal / days)
          avgProtein = Math.round(totPro / days)
        }
      }

      setWeekSummary({
        completedThisWeek,
        totalVolume: Math.round(totalVolume),
        avgProtein,
        avgCalories,
      })
      setLoading(false)
    }
    load()
  }, [session])

  const proteinTarget = Math.round(DEFAULT_BODYWEIGHT_KG * PROTEIN_TARGET_PER_KG)
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalProtein = meals.reduce((s, m) => s + (m.protein_g || 0), 0)
  const insights = buildInsights(recentSessions)
  const monthGrid = buildMonthGrid(calMonth.getFullYear(), calMonth.getMonth(), recentSessions)
  const isCurrentMonth = calMonth.getFullYear() === new Date().getFullYear() && calMonth.getMonth() === new Date().getMonth()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{fmt(today())}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's how today's looking</p>
      </div>

      {/* Daily targets */}
      <div className="border border-gray-200 p-3 bg-gray-50">
        <p className="text-xs text-gray-600">
          Daily target: <span className="font-medium">{proteinTarget}g protein</span>
          {' · '}
          <span className="font-medium">{WATER_TARGET_L}L water</span>
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 border border-gray-200 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">

          {/* Today — workout + nutrition */}
          <div className="grid grid-cols-2 gap-3">

            {/* Workout card */}
            <div className="border border-black p-3 flex flex-col gap-2 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Dumbbell size={13} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Workout</span>
                </div>
                {workout?.completed
                  ? <CheckCircle2 size={13} className="text-black shrink-0" />
                  : <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />
                }
              </div>

              {workout ? (
                <>
                  <p className="text-sm font-semibold leading-tight">
                    {SESSION_TYPES[workout.session_type]?.label ?? workout.session_type}
                  </p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className={`h-1 flex-1 ${n <= (workout.energy_level || 0) ? 'bg-black' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Energy {workout.energy_level}/5</p>
                </>
              ) : insights?.lastSession ? (
                <>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last session</p>
                    <p className="text-sm font-semibold leading-tight mt-0.5">
                      {SESSION_TYPES[insights.lastSession.session_type]?.label ?? insights.lastSession.session_type}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className={`h-1 flex-1 ${n <= (insights.lastSession.energy_level || 0) ? 'bg-gray-300' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">{daysAgo(insights.lastSession.date)}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-auto">Nothing yet</p>
              )}
            </div>

            {/* Nutrition card */}
            <div className="border border-black p-3 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <UtensilsCrossed size={13} strokeWidth={1.5} className="shrink-0" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Nutrition</span>
              </div>

              {nutrition ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold tabular-nums">{totalCalories}</span>
                    <span className="text-xs text-gray-400">kcal</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Protein</span>
                      <span className={`font-medium tabular-nums ${totalProtein >= proteinTarget ? 'text-black' : 'text-gray-400'}`}>
                        {totalProtein}g
                      </span>
                    </div>
                    <Bar value={totalProtein} max={proteinTarget} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Water</span>
                      <span className={`font-medium tabular-nums ${(nutrition.water_l || 0) >= WATER_TARGET_L ? 'text-black' : 'text-gray-400'}`}>
                        {nutrition.water_l || 0}L
                      </span>
                    </div>
                    <Bar value={nutrition.water_l || 0} max={WATER_TARGET_L} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-auto">Nothing yet</p>
              )}
            </div>
          </div>

          {/* Monthly activity calendar */}
          <div className="border border-black p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setSelectedCell(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)) }}
                className="p-1 text-gray-400 hover:text-black transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {calMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => { setSelectedCell(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }}
                disabled={isCurrentMonth}
                className="p-1 text-gray-400 hover:text-black transition-colors disabled:opacity-20"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['M','T','W','T','F','S','S'].map((l, i) => (
                <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-1">{l}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) =>
                cell.isEmpty ? (
                  <div key={i} />
                ) : (
                  <button
                    key={i}
                    onClick={() => !cell.isFuture && setSelectedCell(prev => prev === cell.date ? null : cell.date)}
                    className={`aspect-square flex items-center justify-center text-xs font-medium transition-colors rounded-sm ${
                      cell.isFuture
                        ? 'text-gray-300 cursor-default'
                        : cell.trained
                        ? 'bg-black text-white'
                        : cell.partial
                        ? 'bg-gray-200 text-gray-600'
                        : selectedCell === cell.date
                        ? 'bg-gray-100 text-gray-800'
                        : 'text-gray-500 hover:bg-gray-100'
                    } ${cell.isToday && !cell.trained ? 'ring-1 ring-inset ring-black' : ''}`}
                  >
                    {cell.day}
                  </button>
                )
              )}
            </div>

            {/* Popup for selected cell */}
            {selectedCell && (() => {
              const cell = monthGrid.find(c => !c.isEmpty && c.date === selectedCell)
              if (!cell) return null
              const dateLabel = new Date(selectedCell + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long',
              })
              return (
                <div className="mt-3 border border-gray-200 bg-gray-50 p-3 text-xs">
                  <p className="font-medium text-gray-700">{dateLabel}</p>
                  {cell.session ? (
                    <>
                      <p className="text-gray-600 mt-0.5">
                        {SESSION_TYPES[cell.session.session_type]?.label ?? cell.session.session_type}
                        {cell.session.completed ? ' · completed' : ' · draft'}
                      </p>
                      {cell.session.energy_level != null && (
                        <div className="flex gap-0.5 mt-2" style={{ width: 56 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className={`h-1 flex-1 ${n <= cell.session.energy_level ? 'bg-gray-500' : 'bg-gray-200'}`} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 mt-0.5">Rest day</p>
                  )}
                </div>
              )
            })()}

            {/* This-week summary */}
            {isCurrentMonth && (
              <p className="text-xs text-gray-500 mt-3">
                <span className={`font-medium ${weekSummary?.completedThisWeek >= 3 ? 'text-black' : ''}`}>
                  {weekSummary?.completedThisWeek ?? 0} / 3
                </span>{' '}this week
                {weekSummary?.totalVolume > 0 && (
                  <> · <span className="font-medium text-black">{(weekSummary.totalVolume / 1000).toFixed(1)}t</span> lifted</>
                )}
              </p>
            )}
          </div>

          {/* Weekly averages */}
          {weekSummary && (weekSummary.avgProtein != null || weekSummary.avgCalories != null) && (
            <div className="grid grid-cols-2 gap-px border border-black bg-black">
              <div className="bg-white p-3">
                <p className="text-xs text-gray-500 mb-0.5">Avg protein</p>
                <p className="text-xl font-semibold tabular-nums">
                  {weekSummary.avgProtein != null ? `${weekSummary.avgProtein}g` : '–'}
                </p>
                <p className={`text-xs mt-0.5 ${weekSummary.avgProtein >= proteinTarget ? 'text-black font-medium' : 'text-gray-400'}`}>
                  {weekSummary.avgProtein != null
                    ? weekSummary.avgProtein >= proteinTarget ? '✓ on target' : `target ${proteinTarget}g`
                    : 'no data'}
                </p>
              </div>
              <div className="bg-white p-3">
                <p className="text-xs text-gray-500 mb-0.5">Avg calories</p>
                <p className="text-xl font-semibold tabular-nums">
                  {weekSummary.avgCalories != null ? weekSummary.avgCalories : '–'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">per day this week</p>
              </div>
            </div>
          )}

          {/* Historical insights */}
          <div className="border border-black p-4 space-y-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trends</p>

            {recentSessions.length === 0 ? (
              <p className="text-sm text-gray-400">Log your first workout to see trends here.</p>
            ) : (
              <>
                {/* 4-week consistency */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">4-week consistency</p>
                  <div className="space-y-2">
                    {insights.weeks.map((w, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 w-16 shrink-0">{w.label}</span>
                        <div className="flex gap-0.5 flex-1">
                          {[1, 2, 3].map(n => (
                            <div key={n} className={`h-2 flex-1 ${n <= w.count ? 'bg-black' : 'bg-gray-100'}`} />
                          ))}
                        </div>
                        <span className={`text-[11px] tabular-nums w-8 text-right ${w.onTarget ? 'text-black font-semibold' : 'text-gray-400'}`}>
                          {w.count}/3{w.onTarget ? ' ✓' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2.5">
                    {insights.weeksOnTarget === 0
                      ? 'No weeks on target yet'
                      : `${insights.weeksOnTarget} of 4 weeks on target`}
                  </p>
                </div>

                {/* Session type mix */}
                {insights.hasTypeMix && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Session mix <span className="normal-case font-normal text-gray-400">· last 90 days</span>
                    </p>
                    <div className="space-y-2">
                      {[
                        { key: 'upper', label: 'Upper' },
                        { key: 'lower', label: 'Lower' },
                        { key: 'full', label: 'Full' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-[11px] text-gray-500 w-10 shrink-0">{label}</span>
                          <div className="flex-1 h-1.5 bg-gray-100">
                            <div
                              className="h-1.5 bg-black transition-all"
                              style={{ width: `${Math.round(insights.typeCounts[key] / insights.maxTypeCount * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-gray-500 w-3 text-right">
                            {insights.typeCounts[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Average energy */}
                {insights.avgEnergy != null && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Avg energy <span className="normal-case font-normal text-gray-400">· last 90 days</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5 flex-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div
                            key={n}
                            className={`h-2 flex-1 ${n <= Math.round(insights.avgEnergy) ? 'bg-black' : 'bg-gray-100'}`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{insights.avgEnergy}/5</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function Bar({ value, max }) {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0)
  return (
    <div className="h-0.5 bg-gray-100 w-full mt-1">
      <div className="h-0.5 bg-black transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
