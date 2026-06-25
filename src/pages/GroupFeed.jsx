import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ArrowLeft, Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES, calcStreakSimple } from '../lib/exercises'
import { currentWeekRange, buildMonthGrid, buildInsights } from '../lib/insights'
import { ease, spring } from '../lib/animations'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─── MateCalendar ─────────────────────────────────────────────────────────────

function MateCalendar({ sessions }) {
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selectedCell, setSelectedCell] = useState(null)

  const monthGrid = buildMonthGrid(calMonth.getFullYear(), calMonth.getMonth(), sessions)
  const isCurrentMonth =
    calMonth.getFullYear() === new Date().getFullYear() &&
    calMonth.getMonth() === new Date().getMonth()

  function prevMonth() {
    setSelectedCell(null)
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function nextMonth() {
    setSelectedCell(null)
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  return (
    <div className="border border-black p-4">
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={prevMonth}
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
          onClick={nextMonth}
          disabled={isCurrentMonth}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className="p-1 text-gray-400 hover:text-black transition-colors disabled:opacity-20"
        >
          <ChevronRight size={16} />
        </motion.button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['M','T','W','T','F','S','S'].map((l, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-1">{l}</div>
        ))}
      </div>

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
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.008, type: 'spring', stiffness: 400, damping: 22 }}
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
    </div>
  )
}

// ─── MateTrends ──────────────────────────────────────────────────────────────

function MateTrends({ sessions }) {
  const insights = buildInsights(sessions)

  if (sessions.length === 0) {
    return (
      <div className="border border-black p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Trends</p>
        <p className="text-sm text-gray-400">No workouts logged yet.</p>
      </div>
    )
  }

  return (
    <div className="border border-black p-4 space-y-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trends</p>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">4-week consistency</p>
        <div className="space-y-2">
          {insights.weeks.map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35, ease }}
              className="flex items-center gap-3"
            >
              <span className="text-[11px] text-gray-400 w-16 shrink-0">{w.label}</span>
              <div className="flex gap-0.5 flex-1">
                {[1,2,3].map(n => (
                  <motion.div
                    key={n}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.15 + i * 0.07 + n * 0.05, duration: 0.3 }}
                    style={{ originX: 0 }}
                    className={`h-2 flex-1 ${n <= w.count ? 'bg-black' : 'bg-gray-100'}`}
                  />
                ))}
              </div>
              <span className={`text-[11px] tabular-nums w-8 text-right ${w.onTarget ? 'text-black font-semibold' : 'text-gray-400'}`}>
                {w.count}/3{w.onTarget ? ' ✓' : ''}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2.5">
          {insights.weeksOnTarget === 0
            ? 'No weeks on target yet'
            : `${insights.weeksOnTarget} of 4 weeks on target`}
        </p>
      </div>

      {insights.hasTypeMix && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Session mix <span className="normal-case font-normal text-gray-400">· last 90 days</span>
          </p>
          <div className="space-y-2">
            {[
              { key: 'upper', label: 'Upper' },
              { key: 'lower', label: 'Lower' },
              { key: 'full',  label: 'Full'  },
            ].map(({ key, label }, i) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-10 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-100">
                  <motion.div
                    className="h-1.5 bg-black"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(insights.typeCounts[key] / insights.maxTypeCount * 100)}%` }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.65, ease: [0.25, 0.1, 0.25, 1] }}
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

      {insights.avgEnergy != null && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Avg energy <span className="normal-case font-normal text-gray-400">· last 90 days</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 flex-1">
              {[1,2,3,4,5].map(n => (
                <motion.div
                  key={n}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2 + n * 0.07, duration: 0.35 }}
                  style={{ originX: 0 }}
                  className={`h-2 flex-1 ${n <= Math.round(insights.avgEnergy) ? 'bg-black' : 'bg-gray-100'}`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold tabular-nums">{insights.avgEnergy}/5</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MateDetail ──────────────────────────────────────────────────────────────

function MateDetail({ name, streak, sessions, onBack }) {
  const [weekStart, weekEnd] = currentWeekRange()
  const weekCount = sessions.filter(s => s.completed && s.date >= weekStart && s.date <= weekEnd).length

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.32, ease }}
      className="space-y-4"
    >
      <div className="md:hidden flex items-center gap-3">
        <motion.button
          onClick={onBack}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.93 }}
          transition={spring}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} />
          Mates
        </motion.button>
      </div>

      <div className="flex items-baseline justify-between">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="text-xl font-semibold tracking-tight"
        >
          {name}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="flex items-center gap-3 text-sm text-gray-500"
        >
          <span className={`tabular-nums font-medium ${weekCount >= 3 ? 'text-black' : ''}`}>
            {weekCount}/3 this week
          </span>
          {streak > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.2 }}
              className="flex items-center gap-1 text-black font-semibold"
            >
              <Flame size={14} />
              {streak}
            </motion.span>
          )}
        </motion.div>
      </div>

      <MateCalendar sessions={sessions} />
      <MateTrends sessions={sessions} />
    </motion.div>
  )
}

// ─── FriendCard ──────────────────────────────────────────────────────────────

function FriendCard({ name, streak, weekCount, isSelected, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      animate={{
        backgroundColor: isSelected ? '#1c1c1c' : '#ffffff',
        color: isSelected ? '#f5f5f2' : '#1c1c1c',
      }}
      transition={spring}
      className="w-full text-left border border-black p-3"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{
            borderColor: isSelected ? '#f5f5f2' : '#1c1c1c',
          }}
          transition={spring}
          className="shrink-0 w-8 h-8 border flex items-center justify-center text-xs font-semibold"
        >
          {initials(name)}
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className={`text-xs tabular-nums mt-0.5 ${
            isSelected
              ? weekCount >= 3 ? 'text-white font-medium' : 'text-gray-400'
              : weekCount >= 3 ? 'text-black font-medium' : 'text-gray-400'
          }`}>
            {weekCount}/3 this week{weekCount >= 3 ? ' ✓' : ''}
          </p>
        </div>
        {streak > 0 && (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            className={`shrink-0 flex items-center gap-0.5 text-xs font-semibold ${isSelected ? 'text-white' : ''}`}
          >
            <Flame size={12} />
            {streak}
          </motion.span>
        )}
        <ChevronRight size={14} className={`shrink-0 md:hidden ${isSelected ? 'text-gray-400' : 'text-gray-300'}`} />
      </div>
    </motion.button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function GroupFeed({ session }) {
  const [profiles, setProfiles] = useState({})
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => {
    async function load() {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const since = ninetyDaysAgo.toISOString().split('T')[0]

      const [{ data: profileList }, { data: sessionData }] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('workout_sessions')
          .select('id, user_id, date, session_type, energy_level, completed')
          .gte('date', since)
          .order('date', { ascending: false }),
      ])

      const profileMap = {}
      for (const p of (profileList || [])) profileMap[p.id] = p.display_name
      setProfiles(profileMap)
      setAllSessions(sessionData || [])

      const firstMate = (profileList || []).find(p => p.id !== session.user.id)
      if (firstMate) setSelectedUserId(firstMate.id)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.08 }}
            className="h-16 border border-gray-200 animate-pulse bg-gray-50"
          />
        ))}
      </div>
    )
  }

  const [weekStart, weekEnd] = currentWeekRange()
  const myId = session.user.id

  const friends = Object.entries(profiles)
    .filter(([uid]) => uid !== myId)
    .map(([uid, name]) => {
      const userSessions = allSessions.filter(s => s.user_id === uid)
      const weekCount = userSessions.filter(s => s.completed && s.date >= weekStart && s.date <= weekEnd).length
      const streak = calcStreakSimple(userSessions)
      return { uid, name: name || 'Someone', weekCount, streak, sessions: userSessions }
    })
    .sort((a, b) => b.weekCount - a.weekCount || b.streak - a.streak)

  const selected = friends.find(f => f.uid === selectedUserId)

  if (friends.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="space-y-4"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Mates</h1>
        <p className="text-sm text-gray-400">No mates yet. Invite friends to join and their activity will show up here.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease }}
    >
      {/* Mobile: single-column, two states */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          {selected ? (
            <MateDetail
              key={selectedUserId}
              name={selected.name}
              streak={selected.streak}
              sessions={selected.sessions}
              onBack={() => setSelectedUserId(null)}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.3, ease }}
              className="space-y-4"
            >
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-semibold tracking-tight"
              >
                Mates
              </motion.h1>
              <motion.div
                className="space-y-2"
                initial="initial"
                animate="animate"
                variants={{ animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
              >
                {friends.map(f => (
                  <motion.div
                    key={f.uid}
                    variants={{
                      initial: { opacity: 0, y: 16 },
                      animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
                    }}
                  >
                    <FriendCard
                      name={f.name}
                      streak={f.streak}
                      weekCount={f.weekCount}
                      isSelected={false}
                      onClick={() => setSelectedUserId(f.uid)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: two-column */}
      <div className="hidden md:grid md:grid-cols-[200px_1fr] gap-6">
        <motion.div
          className="space-y-4"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
        >
          <motion.h1
            variants={{ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }}
            className="text-2xl font-semibold tracking-tight"
          >
            Mates
          </motion.h1>
          <div className="space-y-2">
            {friends.map(f => (
              <motion.div
                key={f.uid}
                variants={{
                  initial: { opacity: 0, x: -16 },
                  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease } },
                }}
              >
                <FriendCard
                  name={f.name}
                  streak={f.streak}
                  weekCount={f.weekCount}
                  isSelected={selectedUserId === f.uid}
                  onClick={() => setSelectedUserId(f.uid)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div>
          <AnimatePresence mode="wait">
            {selected ? (
              <MateDetail
                key={selectedUserId}
                name={selected.name}
                streak={selected.streak}
                sessions={selected.sessions}
                onBack={() => setSelectedUserId(null)}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-48 border border-dashed border-gray-200 text-sm text-gray-400"
              >
                Select a mate to see their activity
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
