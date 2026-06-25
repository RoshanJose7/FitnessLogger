import { useEffect, useState } from 'react'
import { Dumbbell, UtensilsCrossed, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES, PROTEIN_TARGET_PER_KG, DEFAULT_BODYWEIGHT_KG, WATER_TARGET_L } from '../lib/exercises'
import { currentWeekRange, buildMonthGrid, buildInsights } from '../lib/insights'
import { staggerContainer, staggerItem, ease, spring } from '../lib/animations'

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
  const [hoveredSession, setHoveredSession] = useState(null)
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
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">{fmt(today())}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's how today's looking</p>
      </motion.div>

      {/* Daily targets */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease }}
        className="border border-gray-200 p-3 bg-gray-50"
      >
        <p className="text-xs text-gray-600">
          Daily target: <span className="font-medium">{proteinTarget}g protein</span>
          {' · '}
          <span className="font-medium">{WATER_TARGET_L}L water</span>
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="h-24 border border-gray-200 animate-pulse bg-gray-50"
            />
          ))}
        </div>
      ) : (
        <motion.div
          className="space-y-4"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
        >

          {/* Today — workout + nutrition */}
          <motion.div
            variants={staggerItem}
            transition={{ duration: 0.4, ease }}
            className="grid grid-cols-2 gap-3"
          >

            {/* Workout card */}
            <motion.div
              whileHover={{ y: -2, transition: spring }}
              className="border border-black p-3 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Dumbbell size={13} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Workout</span>
                </div>
                {workout?.completed
                  ? <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    >
                      <CheckCircle2 size={13} className="text-black shrink-0" />
                    </motion.div>
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
                      <motion.div
                        key={n}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + n * 0.06, duration: 0.3 }}
                        style={{ originX: 0 }}
                        className={`h-1 flex-1 ${n <= (workout.energy_level || 0) ? 'bg-black' : 'bg-gray-100'}`}
                      />
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
            </motion.div>

            {/* Nutrition card */}
            <motion.div
              whileHover={{ y: -2, transition: spring }}
              className="border border-black p-3 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <UtensilsCrossed size={13} strokeWidth={1.5} className="shrink-0" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Nutrition</span>
              </div>

              {nutrition ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-xl font-semibold tabular-nums"
                    >
                      {totalCalories}
                    </motion.span>
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
            </motion.div>
          </motion.div>

          {/* Monthly activity calendar */}
          <motion.div
            variants={staggerItem}
            transition={{ duration: 0.4, ease }}
            className="border border-black p-4"
          >
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <motion.button
                onClick={() => { setSelectedCell(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)) }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 text-gray-400 hover:text-black transition-colors"
              >
                <ChevronLeft size={16} />
              </motion.button>
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {calMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
              </p>
              <motion.button
                onClick={() => { setSelectedCell(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }}
                disabled={isCurrentMonth}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 text-gray-400 hover:text-black transition-colors disabled:opacity-20"
              >
                <ChevronRight size={16} />
              </motion.button>
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
                  <motion.button
                    key={i}
                    onClick={() => !cell.isFuture && setSelectedCell(prev => prev === cell.date ? null : cell.date)}
                    whileHover={!cell.isFuture ? { scale: 1.12 } : {}}
                    whileTap={!cell.isFuture ? { scale: 0.9 } : {}}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01, type: 'spring', stiffness: 400, damping: 22 }}
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
                  </motion.button>
                )
              )}
            </div>

            {/* Popup for selected cell */}
            <AnimatePresence>
              {selectedCell && (() => {
                const cell = monthGrid.find(c => !c.isEmpty && c.date === selectedCell)
                if (!cell) return null
                const dateLabel = new Date(selectedCell + 'T00:00:00').toLocaleDateString('en-AU', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-3 border border-gray-200 bg-gray-50 p-3 text-xs overflow-hidden"
                  >
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
                  </motion.div>
                )
              })()}
            </AnimatePresence>

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
          </motion.div>

          {/* Weekly averages */}
          <AnimatePresence>
            {weekSummary && (weekSummary.avgProtein != null || weekSummary.avgCalories != null) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease }}
                className="grid grid-cols-2 gap-3"
              >
                {/* Protein ring card */}
                {weekSummary.avgProtein != null && (
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={spring}
                    className="border border-black p-4 flex flex-col items-center gap-3 cursor-default"
                  >
                    <div className="relative">
                      <RingProgress value={weekSummary.avgProtein} max={proteinTarget} size={72} strokeWidth={5} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold tabular-nums leading-none">
                          <CountUp to={weekSummary.avgProtein} />g
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg protein</p>
                      <motion.p
                        animate={weekSummary.avgProtein >= proteinTarget ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ delay: 1.6, type: 'spring', stiffness: 400 }}
                        className={`text-[11px] mt-0.5 ${weekSummary.avgProtein >= proteinTarget ? 'text-black font-semibold' : 'text-gray-400'}`}
                      >
                        {weekSummary.avgProtein >= proteinTarget ? '✓ on target' : `target ${proteinTarget}g`}
                      </motion.p>
                    </div>
                  </motion.div>
                )}

                {/* Calories card */}
                {weekSummary.avgCalories != null && (
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={spring}
                    className="border border-black p-4 flex flex-col items-center justify-center gap-1 cursor-default"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg calories</p>
                    <p className="text-3xl font-bold tabular-nums leading-none">
                      <CountUp to={weekSummary.avgCalories} />
                    </p>
                    <p className="text-[10px] text-gray-400">per day this week</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Historical insights */}
          <motion.div
            variants={staggerItem}
            transition={{ duration: 0.4, ease }}
            className="border border-black p-4 space-y-5"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trends</p>

            {recentSessions.length === 0 ? (
              <p className="text-sm text-gray-400">Log your first workout to see trends here.</p>
            ) : (
              <>
                {/* 4-week consistency */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">4-week consistency</p>
                  <div className="space-y-2.5">
                    {insights.weeks.map((w, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 4 }}
                        transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease }}
                        className="flex items-center gap-3 cursor-default"
                      >
                        <span className="text-[11px] text-gray-400 w-16 shrink-0">{w.label}</span>
                        <div className="flex gap-2 flex-1">
                          {[0, 1, 2].map(n => (
                            <motion.div
                              key={n}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                delay: 0.15 + i * 0.09 + n * 0.07,
                                type: 'spring', stiffness: 500, damping: 22,
                              }}
                              className={`w-4 h-4 rounded-full border-2 ${
                                n < w.count ? 'bg-black border-black' : 'bg-white border-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <motion.span
                          animate={w.onTarget ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ delay: 0.4 + i * 0.09, type: 'spring' }}
                          className={`text-[11px] tabular-nums w-8 text-right ${w.onTarget ? 'text-black font-semibold' : 'text-gray-400'}`}
                        >
                          {w.count}/3{w.onTarget ? ' ✓' : ''}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2.5">
                    {insights.weeksOnTarget === 0
                      ? 'No weeks on target yet'
                      : `${insights.weeksOnTarget} of 4 weeks on target`}
                  </p>
                </div>

                {/* Session type mix */}
                {insights.hasTypeMix && (() => {
                  const total = Object.values(insights.typeCounts).reduce((a, b) => a + b, 0)
                  return (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                        Session mix <span className="normal-case font-normal text-gray-400">· last 90 days</span>
                      </p>
                      <div className="space-y-2.5">
                        {[
                          { key: 'upper', label: 'Upper' },
                          { key: 'lower', label: 'Lower' },
                          { key: 'full', label: 'Full' },
                        ].map(({ key, label }, i) => {
                          const isHovered = hoveredSession === key
                          const pct = total > 0 ? Math.round(insights.typeCounts[key] / total * 100) : 0
                          return (
                            <motion.div
                              key={key}
                              onHoverStart={() => setHoveredSession(key)}
                              onHoverEnd={() => setHoveredSession(null)}
                              animate={{ x: isHovered ? 4 : 0 }}
                              transition={spring}
                              className="flex items-center gap-3 cursor-default"
                            >
                              <motion.span
                                animate={{ color: isHovered ? '#000' : '#6b7280', fontWeight: isHovered ? '600' : '400' }}
                                transition={{ duration: 0.15 }}
                                className="text-[11px] w-10 shrink-0"
                              >
                                {label}
                              </motion.span>
                              <div className="flex-1 h-2 bg-gray-100 overflow-hidden">
                                <motion.div
                                  className="h-2 bg-black"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.round(insights.typeCounts[key] / insights.maxTypeCount * 100)}%` }}
                                  transition={{ delay: 0.15 + i * 0.1, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                                />
                              </div>
                              <AnimatePresence mode="wait">
                                {isHovered ? (
                                  <motion.span
                                    key="pct"
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 6 }}
                                    transition={{ duration: 0.12 }}
                                    className="text-[11px] tabular-nums font-semibold w-8 text-right"
                                  >
                                    {pct}%
                                  </motion.span>
                                ) : (
                                  <motion.span
                                    key="count"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.12 }}
                                    className="text-[11px] tabular-nums text-gray-500 w-8 text-right"
                                  >
                                    {insights.typeCounts[key]}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Average energy */}
                {insights.avgEnergy != null && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Avg energy <span className="normal-case font-normal text-gray-400">· last 90 days</span>
                    </p>
                    <EnergyDisplay avg={insights.avgEnergy} />
                  </div>
                )}
              </>
            )}
          </motion.div>

        </motion.div>
      )}
    </motion.div>
  )
}

function CountUp({ to, className = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!to) return
    let rafId
    const startTime = performance.now() + 400
    const duration = 900
    const tick = (now) => {
      const elapsed = now - startTime
      if (elapsed < 0) { rafId = requestAnimationFrame(tick); return }
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(to * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [to])
  return <span className={className}>{val}</span>
}

function RingProgress({ value, max, size = 64, strokeWidth = 4 }) {
  const pct = Math.min(1, max > 0 && value != null ? value / max : 0)
  const r = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="black" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - pct) }}
        transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </svg>
  )
}

const ENERGY_LABELS = ['', 'Rough day', 'Low energy', 'Decent', 'Feeling good', 'Crushed it!']

function EnergyDisplay({ avg }) {
  const [hovered, setHovered] = useState(null)
  const active = hovered ?? Math.round(avg)
  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5 h-7">
        {[1, 2, 3, 4, 5].map(n => (
          <motion.div
            key={n}
            onHoverStart={() => setHovered(n)}
            onHoverEnd={() => setHovered(null)}
            animate={{
              backgroundColor: n <= active ? '#000' : '#f3f4f6',
              scaleY: n === active ? 1.18 : 1,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="flex-1 cursor-default rounded-sm"
            style={{ originY: 1 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={active}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-gray-500"
        >
          <span className="font-semibold text-black tabular-nums">{active}/5</span>{' · '}{ENERGY_LABELS[active]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

function Bar({ value, max }) {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0)
  return (
    <div className="h-0.5 bg-gray-100 w-full mt-1">
      <motion.div
        className="h-0.5 bg-black"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  )
}
