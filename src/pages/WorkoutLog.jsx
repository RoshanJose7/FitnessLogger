import { useState, useEffect } from 'react'
import { ChevronDown, CheckCircle2, History, Plus, Minus, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SESSION_TYPES } from '../lib/exercises'
import RestTimer from '../components/RestTimer'

function today() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const EMPTY_SET = { weight: '', reps: '', notes: '' }
const EMPTY_CARDIO = { activity: '', distance: '', time: '', pace: '', felt: '', notes: '' }

const ENERGY_LABELS = { 1: 'Low', 5: 'High' }

function buildInitialSets(exercises) {
  return Object.fromEntries(
    exercises.map(ex => [ex, [{ ...EMPTY_SET }, { ...EMPTY_SET }, { ...EMPTY_SET }]])
  )
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
  const [cardioOpen, setCardioOpen] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [savingAs, setSavingAs] = useState(null) // null | 'draft' | 'complete'
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

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
          setCardioOpen(true)
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

  function addSet(exercise) {
    setSets(prev => ({ ...prev, [exercise]: [...prev[exercise], { ...EMPTY_SET }] }))
  }

  function removeSet(exercise, setIdx) {
    setSets(prev => ({
      ...prev,
      [exercise]: prev[exercise].filter((_, i) => i !== setIdx),
    }))
  }

  async function handleSave(completed = false) {
    const mode = completed ? 'complete' : 'draft'
    setSavingAs(mode)
    setSaveError(null)
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
        const { data, error } = await supabase.from('workout_sessions').insert(sessionData).select().single()
        if (error) throw error
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
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Failed to save. Check your connection and try again.')
    } finally {
      setSavingAs(null)
    }
  }

  const config = sessionType ? SESSION_TYPES[sessionType] : null

  if (step === 'pick') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log Workout</h1>
          <p className="text-sm text-gray-500 mt-0.5">Choose today's session</p>
        </div>
        <div className="space-y-2">
          {Object.entries(SESSION_TYPES).map(([key, { label, exercises }]) => (
            <button
              key={key}
              onClick={() => selectType(key)}
              className="w-full border border-black p-4 text-left hover:bg-black hover:text-white transition-colors group"
            >
              <div className="font-medium mb-1">{label}</div>
              <div className="text-xs text-gray-400 group-hover:text-gray-300">
                {exercises.length} exercises — {exercises.slice(0, 3).join(', ')}{exercises.length > 3 ? ` + ${exercises.length - 3} more` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{fmtDate(today())}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium border border-black px-2 py-1">
            <CheckCircle2 size={13} /> Saved
          </span>
        )}
      </div>

      {/* Previous session banner */}
      {prevSession && (
        <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-gray-50">
          <History size={13} className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">
            Comparing against {fmtDate(prevSession.date)} — beat those numbers
          </p>
        </div>
      )}

      {/* Energy level */}
      <div>
        <p className="text-sm font-medium mb-2">Energy today</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setEnergyLevel(n)}
              className={`flex-1 py-2.5 border text-sm font-medium transition-colors ${
                energyLevel === n ? 'bg-black text-white border-black' : 'border-black hover:bg-gray-50'
              }`}
            >
              <span className="block leading-none">{n}</span>
              {ENERGY_LABELS[n] && (
                <span className="block text-[10px] font-normal leading-tight mt-0.5 opacity-60">
                  {ENERGY_LABELS[n]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-2">
        {config.exercises.map((exercise, idx) => (
          <ExerciseBlock
            key={exercise}
            exercise={exercise}
            sets={sets[exercise] || [EMPTY_SET, EMPTY_SET, EMPTY_SET]}
            prevSets={prevSession?.sets?.[exercise] || null}
            defaultOpen={idx === 0}
            onChange={(setIdx, field, value) => updateSet(exercise, setIdx, field, value)}
            onAddSet={() => addSet(exercise)}
            onRemoveSet={setIdx => removeSet(exercise, setIdx)}
          />
        ))}
      </div>

      {/* Cardio — collapsible */}
      <div className="border border-black">
        <button
          onClick={() => setCardioOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <span className="text-sm font-medium">Cardio</span>
            <span className="text-xs text-gray-400 ml-2">{config.cardio.type}</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform shrink-0 ${cardioOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {cardioOpen && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
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
                  <label className="block text-xs text-gray-500 mb-1.5">Felt (1–5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setCardio(p => ({ ...p, felt: String(n) }))}
                        className={`flex-1 py-2 border text-xs font-medium transition-colors ${
                          cardio.felt === String(n) ? 'bg-black text-white border-black' : 'border-gray-200 hover:border-black'
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
        )}
      </div>

      {/* Session notes */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Session notes</label>
        <textarea
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
          rows={3}
          placeholder="How did it feel? Any form notes?"
          className="w-full border border-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black resize-none"
        />
      </div>

      {/* Save error */}
      {saveError && (
        <div role="alert" className="border border-black bg-black text-white px-3 py-2.5 text-sm">
          {saveError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={!!savingAs}
          className="flex-1 border border-black py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          {savingAs === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={!!savingAs}
          className="flex-1 bg-black text-white py-3 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-40"
        >
          {savingAs === 'complete' ? 'Saving…' : 'Complete'}
        </button>
      </div>

      <RestTimer />
    </div>
  )
}

function ExerciseBlock({ exercise, sets, prevSets, defaultOpen, onChange, onAddSet, onRemoveSet }) {
  const [open, setOpen] = useState(defaultOpen)
  const [noteOpenFor, setNoteOpenFor] = useState(null)

  const completedCount = sets.filter(s => s.weight && s.reps).length
  const total = sets.length

  const prevSummary = prevSets?.length
    ? prevSets
        .slice(0, total)
        .map(s => [s.weight, s.reps].filter(Boolean).join('×') || null)
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="border border-black">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <span className="text-sm font-medium flex-1 min-w-0">{exercise}</span>
        <div className="flex items-center gap-2 shrink-0">
          {completedCount > 0 && (
            <span className={`text-xs tabular-nums ${completedCount === total ? 'font-medium' : 'text-gray-400'}`}>
              {completedCount}/{total}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
          {prevSummary && (
            <p className="text-xs text-gray-400 pb-2 border-b border-gray-100">
              Last: {prevSummary}
            </p>
          )}

          {sets.map((set, i) => {
            const prev = prevSets?.[i]
            const showNote = noteOpenFor === i || !!set.notes
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 shrink-0 tabular-nums text-center">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={prev?.weight || 'kg'}
                    value={set.weight}
                    onChange={e => onChange(i, 'weight', e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-black text-center"
                  />
                  <span className="text-xs text-gray-300 shrink-0">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={prev?.reps || 'reps'}
                    value={set.reps}
                    onChange={e => onChange(i, 'reps', e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-black text-center"
                  />
                  {/* Note toggle — 44px touch area */}
                  <button
                    onClick={() => setNoteOpenFor(noteOpenFor === i ? null : i)}
                    className={`p-2 transition-colors shrink-0 ${set.notes || noteOpenFor === i ? 'text-black' : 'text-gray-300 hover:text-gray-500'}`}
                    aria-label="Toggle note"
                  >
                    <MessageSquare size={14} />
                  </button>
                  {/* Remove set — only when more than 1 set */}
                  {sets.length > 1 && (
                    <button
                      onClick={() => onRemoveSet(i)}
                      className="p-2 text-gray-300 hover:text-black transition-colors shrink-0"
                      aria-label="Remove set"
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>

                {showNote && (
                  <div className="mt-1 ml-7">
                    <input
                      type="text"
                      placeholder="Note for this set…"
                      value={set.notes}
                      onChange={e => onChange(i, 'notes', e.target.value)}
                      className="w-full border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-black"
                    />
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={onAddSet}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-black transition-colors pt-1 mt-1"
          >
            <Plus size={13} /> Add set
          </button>
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
        className="w-full border border-gray-200 px-2 py-2 text-sm outline-none focus:border-black"
      />
    </div>
  )
}
