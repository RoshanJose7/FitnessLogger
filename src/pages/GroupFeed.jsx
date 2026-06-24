import { useState, useEffect } from 'react'
import { Dumbbell, UtensilsCrossed, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES } from '../lib/exercises'

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function GroupFeed({ session }) {
  const [profiles, setProfiles] = useState({})
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: profileList }, { data: workouts }, { data: nutrition }] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('workout_sessions').select('*').order('date', { ascending: false }).limit(60),
        supabase.from('nutrition_logs').select('*').order('date', { ascending: false }).limit(60),
      ])

      const profileMap = {}
      for (const p of (profileList || [])) profileMap[p.id] = p.display_name
      setProfiles(profileMap)

      const items = [
        ...(workouts || []).map(w => ({ ...w, _type: 'workout' })),
        ...(nutrition || []).map(n => ({ ...n, _type: 'nutrition' })),
      ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

      setFeed(items)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 border border-gray-200 animate-pulse bg-gray-50" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Group</h1>

      {feed.length === 0 && (
        <p className="text-sm text-gray-500 py-4">No activity yet. Start logging!</p>
      )}

      <div className="space-y-2">
        {feed.map(item => {
          const name = profiles[item.user_id] || 'Someone'
          const isMe = item.user_id === session.user.id
          const label = isMe ? 'You' : name

          if (item._type === 'workout') {
            const config = SESSION_TYPES[item.session_type]
            return (
              <div key={`w-${item.id}`} className="border border-black px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Dumbbell size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {label} logged a workout
                      </p>
                      <p className="text-xs text-gray-500">
                        {config?.label || item.session_type} · {fmt(item.date)} · Energy {item.energy_level}/5
                      </p>
                    </div>
                  </div>
                  {item.completed && <CheckCircle2 size={14} className="text-black shrink-0 mt-1" />}
                </div>
              </div>
            )
          }

          if (item._type === 'nutrition') {
            return (
              <div key={`n-${item.id}`} className="border border-black px-4 py-3">
                <div className="flex items-start gap-3">
                  <UtensilsCrossed size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label} logged nutrition</p>
                    <p className="text-xs text-gray-500">
                      {fmt(item.date)} · {item.is_workout_day ? 'Workout day' : 'Rest day'} · {item.water_l ?? '–'}L water
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
