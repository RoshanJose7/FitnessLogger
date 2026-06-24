import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ArrowLeft, Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES, calcStreakSimple } from '../lib/exercises'
import { currentWeekRange, buildMonthGrid, buildInsights } from '../lib/insights'

// ─── helpers ────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─── MateCalendar — the detail panel shared between desktop + mobile ─────────

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
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 text-gray-400 hover:text-black transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {calMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
        </p>
        <button
          onClick={nextMonth}
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

      {/* Cells */}
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

      {/* Popup */}
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

      {/* 4-week consistency */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">4-week consistency</p>
        <div className="space-y-2">
          {insights.weeks.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 w-16 shrink-0">{w.label}</span>
              <div className="flex gap-0.5 flex-1">
                {[1,2,3].map(n => (
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
              { key: 'full',  label: 'Full'  },
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

      {/* Avg energy */}
      {insights.avgEnergy != null && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Avg energy <span className="normal-case font-normal text-gray-400">· last 90 days</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 flex-1">
              {[1,2,3,4,5].map(n => (
                <div key={n} className={`h-2 flex-1 ${n <= Math.round(insights.avgEnergy) ? 'bg-black' : 'bg-gray-100'}`} />
              ))}
            </div>
            <span className="text-sm font-semibold tabular-nums">{insights.avgEnergy}/5</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MateDetail — calendar + trends for a selected user ──────────────────────

function MateDetail({ name, streak, sessions, onBack }) {
  const [weekStart, weekEnd] = currentWeekRange()
  const weekCount = sessions.filter(s => s.completed && s.date >= weekStart && s.date <= weekEnd).length

  return (
    <div className="space-y-4">
      {/* Mobile back button — hidden on desktop */}
      <div className="md:hidden flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} />
          Mates
        </button>
      </div>

      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className={`tabular-nums font-medium ${weekCount >= 3 ? 'text-black' : ''}`}>
            {weekCount}/3 this week
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-black font-semibold">
              <Flame size={14} />
              {streak}
            </span>
          )}
        </div>
      </div>

      <MateCalendar sessions={sessions} />
      <MateTrends sessions={sessions} />
    </div>
  )
}

// ─── FriendCard — one row in the mobile list / sidebar ───────────────────────

function FriendCard({ name, streak, weekCount, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border border-black p-3 transition-colors ${
        isSelected ? 'bg-black text-white' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`shrink-0 w-8 h-8 border flex items-center justify-center text-xs font-semibold ${
          isSelected ? 'border-white' : 'border-black'
        }`}>
          {initials(name)}
        </div>
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
          <span className={`shrink-0 flex items-center gap-0.5 text-xs font-semibold ${isSelected ? 'text-white' : ''}`}>
            <Flame size={12} />
            {streak}
          </span>
        )}
        <ChevronRight size={14} className={`shrink-0 md:hidden ${isSelected ? 'text-gray-400' : 'text-gray-300'}`} />
      </div>
    </button>
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

      // Pre-select the first mate (everyone except current user)
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
          <div key={i} className="h-16 border border-gray-200 animate-pulse bg-gray-50" />
        ))}
      </div>
    )
  }

  const [weekStart, weekEnd] = currentWeekRange()
  const myId = session.user.id

  // Build friend list from all profiles, excluding the current user
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mates</h1>
        <p className="text-sm text-gray-400">No mates yet. Invite friends to join and their activity will show up here.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Mobile: single-column, two states */}
      <div className="md:hidden">
        {selected ? (
          <MateDetail
            name={selected.name}
            streak={selected.streak}
            sessions={selected.sessions}
            onBack={() => setSelectedUserId(null)}
          />
        ) : (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Mates</h1>
            <div className="space-y-2">
              {friends.map(f => (
                <FriendCard
                  key={f.uid}
                  name={f.name}
                  streak={f.streak}
                  weekCount={f.weekCount}
                  isSelected={false}
                  onClick={() => setSelectedUserId(f.uid)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: two-column */}
      <div className="hidden md:grid md:grid-cols-[200px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Mates</h1>
          <div className="space-y-2">
            {friends.map(f => (
              <FriendCard
                key={f.uid}
                name={f.name}
                streak={f.streak}
                weekCount={f.weekCount}
                isSelected={selectedUserId === f.uid}
                onClick={() => setSelectedUserId(f.uid)}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <MateDetail
              name={selected.name}
              streak={selected.streak}
              sessions={selected.sessions}
              onBack={() => setSelectedUserId(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-gray-200 text-sm text-gray-400">
              Select a mate to see their activity
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
