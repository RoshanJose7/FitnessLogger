import { useState, useEffect } from 'react'
import { ChevronDown, CheckCircle2, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES } from '../lib/exercises'

function today() {
  return new Date().toISOString().split('T')[0]
}

const EMPTY_SET = { weight: '', reps: '', notes: '' }
const EMPTY_CARDIO = { activity: '', distance: '', time: '', pace: '', felt: '', notes: '' }

function buildInitialSets(exercises) {
  return Object.fromEntries(exercises.map(ex => [ex, [{ ...EMPTY_SET }, { ...EMPTY_SET }, { ...EMPTY_SET }]]))
}

async function fetchPreviousSession(userId, sessionType) {
  const { data: prev } = await supabase
    .from('workout_sessions')
    .select('id, date')
    .eq('user_id', userId)
    .eq('session_type', sessionType)
    .lt('date', today())
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!prev) return null

  const { data: sets } = await supabase
    .from('exercise_sets')
    .select('*')
    .eq('session_id', prev.id)
    .order('set_number')

  const grouped = {}
  for (const s of sets || []) {
    if (!grouped[s.exercise_name]) grouped[s.exercise_name] = []
    grouped[s.exercise_name].push({ weight: s.weight, reps: s.reps })
  }

  return { date: prev.date, sets: grouped }
}

export default function WorkoutLog({ session }) {
  const [step, setStep] = useState('pick')
  const [sessionType, setSessionType] = useState(null)
  const [existingId, setExistingId] = useState(null)
  const [energyLevel, setEnergyLevel] = useState(3)
  const [sets, setSets] = useState({})
  const [prevSession, setPrevSession] = useState(null)
  const [cardio, setCardio] = useState({ ...EMPTY_CARDIO })
  const [sessionNotes, setSessionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function checkExisting() {
      const { data } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', today())
        .maybeSingle()

      if (data) {
        setExistingId(data.id)
        setSessionType(data.session_type)
        setEnergyLevel(data.energy_level || 3)
        setSessionNotes(data.notes || '')
        const config = SESSION_TYPES[data.session_type]
        setSets(buildInitialSets(config.exercises))

        const [existingSets, prev] = await Promise.all([
          supabase.from('exercise_sets').select('*').eq('session_id', data.id).order('set_number'),
          fetchPreviousSession(session.user.id, data.session_type),
        ])

        if (existingSets.data?.length) {
          const grouped = {}
          for (const s of existingSets.data) {
            if (!grouped[s.exercise_name]) grouped[s.exercise_name] = []
            grouped[s.exercise_name][s.set_number - 1] = {
              weight: s.weight || '',
              reps: s.reps || '',
              notes: s.notes || '',
            }
          }
          setSets(grouped)
        }

        const { data: cardioData } = await supabase
          .from('cardio_logs')
          .select('*')
          .eq('session_id', data.id)
          .maybeSingle()
        if (cardioData) {
          setCardio({
            activity: cardioData.activity || '',
            distance: cardioData.distance || '',
            time: cardioData.duration || '',
            pace: cardioData.pace || '',
            felt: cardioData.felt || '',
            notes: cardioData.notes || '',
          })
        }

        setPrevSession(prev)
        setStep('log')
      }
    }
    checkExisting()
  }, [session])

  async function selectType(type) {
    setSessionType(type)
    setSets(buildInitialSets(SESSION_TYPES[type].exercises))
    const prev = await fetchPreviousSession(session.user.id, type)
    setPrevSession(prev)
    setStep('log')
  }

  function updateSet(exercise, setIdx, field, value) {
    setSets(prev => ({
      ...prev,
      [exercise]: prev[exercise].map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
    }))
  }

  async function handleSave(completed = false) {
    setSaving(true)
    try {
      let sessionId = existingId

      const sessionData = {
        user_id: session.user.id,
        date: today(),
        session_type: sessionType,
        energy_level: energyLevel,
        notes: sessionNotes,
        completed,
      }

      if (sessionId) {
        await supabase.from('workout_sessions').update(sessionData).eq('id', sessionId)
        await supabase.from('exercise_sets').delete().eq('session_id', sessionId)
        await supabase.from('cardio_logs').delete().eq('session_id', sessionId)
      } else {
        const { data } = await supabase.from('workout_sessions').insert(sessionData).select().single()
        sessionId = data.id
        setExistingId(sessionId)
      }

      const setRows = []
      for (const [exercise, setList] of Object.entries(sets)) {
        for (let i = 0; i < setList.length; i++) {
          const s = setList[i]
          if (s.weight || s.reps) {
            setRows.push({
              session_id: sessionId,
              exercise_name: exercise,
              set_number: i + 1,
              weight: s.weight || null,
              reps: s.reps || null,
              notes: s.notes || null,
            })
          }
        }
      }
      if (setRows.length) await supabase.from('exercise_sets').insert(setRows)

      const hasCardio = Object.values(cardio).some(v => v !== '')
      if (hasCardio) {
        await supabase.from('cardio_logs').insert({
          session_id: sessionId,
          activity: cardio.activity || null,
          distance: cardio.distance || null,
          duration: cardio.time || null,
          pace: cardio.pace || null,
          felt: cardio.felt ? Number(cardio.felt) : null,
          notes: cardio.notes || null,
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const config = sessionType ? SESSION_TYPES[sessionType] : null

  if (step === 'pick') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log Workout</h1>
          <p className="text-sm text-gray-500 mt-0.5">Choose today's session type</p>
        </div>
        <div className="space-y-3">
          {Object.entries(SESSION_TYPES).map(([key, { label, exercises }]) => (
            <button
              key={key}
              onClick={() => selectType(key)}
              className="w-full border border-black p-4 text-left hover:bg-black hover:text-white transition-colors group"
            >
              <div className="font-medium mb-1">{label}</div>
              <div className="text-xs text-gray-500 group-hover:text-gray-300">
                {exercises.slice(0, 4).join(' · ')} · +{exercises.length - 4} more
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today()}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-black font-medium">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
      </div>

      {/* Previous session banner */}
      {prevSession && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2">
          <History size={13} className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">
            Showing last session ({fmtDate(prevSession.date)}) — beat those numbers
          </p>
        </div>
      )}

      {/* Energy level */}
      <div>
        <label className="block text-sm font-medium mb-2">Energy level</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setEnergyLevel(n)}
              className={`w-10 h-10 border text-sm font-medium transition-colors ${
                energyLevel === n ? 'bg-black text-white border-black' : 'border-black hover:bg-gray-100'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-5">
        {config.exercises.map(exercise => (
          <ExerciseBlock
            key={exercise}
            exercise={exercise}
            sets={sets[exercise] || [EMPTY_SET, EMPTY_SET, EMPTY_SET]}
            prevSets={prevSession?.sets?.[exercise] || null}
            onChange={(setIdx, field, value) => updateSet(exercise, setIdx, field, value)}
          />
        ))}
      </div>

      {/* Cardio */}
      <div className="border border-black p-4 space-y-3">
        <h2 className="font-medium text-sm">Cardio — {config.cardio.type}</h2>
        <div className="grid grid-cols-2 gap-3">
          {config.cardio.fields.includes('activity') && (
            <Field label="Activity" value={cardio.activity} onChange={v => setCardio(p => ({ ...p, activity: v }))} />
          )}
          {config.cardio.fields.includes('distance') && (
            <Field label="Distance" placeholder="e.g. 3km" value={cardio.distance} onChange={v => setCardio(p => ({ ...p, distance: v }))} />
          )}
          {config.cardio.fields.includes('time') && (
            <Field label="Time" placeholder="e.g. 20min" value={cardio.time} onChange={v => setCardio(p => ({ ...p, time: v }))} />
          )}
          {config.cardio.fields.includes('pace') && (
            <Field label="Pace" placeholder="e.g. 5:30/km" value={cardio.pace} onChange={v => setCardio(p => ({ ...p, pace: v }))} />
          )}
          {config.cardio.fields.includes('felt') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Felt (1–5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setCardio(p => ({ ...p, felt: String(n) }))}
                    className={`w-8 h-8 border text-xs font-medium transition-colors ${
                      cardio.felt === String(n) ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-black'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Field label="Notes" value={cardio.notes} onChange={v => setCardio(p => ({ ...p, notes: v }))} />
      </div>

      {/* Session notes */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Session notes</label>
        <textarea
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
          rows={3}
          placeholder="How did the session feel? Any form notes?"
          className="w-full border border-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1 border border-black py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex-1 bg-black text-white py-2.5 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Complete session'}
        </button>
      </div>
    </div>
  )
}

function ExerciseBlock({ exercise, sets, prevSets, onChange }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-black">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
      >
        {exercise}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-2">
          {/* Previous session header */}
          {prevSets && (
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 mb-1">
              <span className="w-8" />
              <span className="text-xs text-gray-400 text-center">Weight</span>
              <span className="text-xs text-gray-400 text-center">Reps</span>
              <span className="text-xs text-gray-400 text-center">Note</span>
            </div>
          )}
          {sets.map((set, i) => {
            const prev = prevSets?.[i]
            return (
              <div key={i} className="space-y-1">
                {/* Previous session row */}
                {prev && (prev.weight || prev.reps) && (
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center">
                    <span className="text-xs text-gray-300 w-8">↑{i + 1}</span>
                    <div className="border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-400 text-center">
                      {prev.weight || '–'}
                    </div>
                    <div className="border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-400 text-center">
                      {prev.reps || '–'}
                    </div>
                    <div className="border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-300 text-center">
                      last
                    </div>
                  </div>
                )}
                {/* Current set row */}
                <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center">
                  <span className="text-xs text-gray-400 w-8">S{i + 1}</span>
                  <input
                    type="text"
                    placeholder={prev?.weight || 'Weight'}
                    value={set.weight}
                    onChange={e => onChange(i, 'weight', e.target.value)}
                    className="border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black w-full"
                  />
                  <input
                    type="text"
                    placeholder={prev?.reps || 'Reps'}
                    value={set.reps}
                    onChange={e => onChange(i, 'reps', e.target.value)}
                    className="border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black w-full"
                  />
                  <input
                    type="text"
                    placeholder="Note"
                    value={set.notes}
                    onChange={e => onChange(i, 'notes', e.target.value)}
                    className="border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black w-full"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-black"
      />
    </div>
  )
}

function fmtDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short',
  })
}
