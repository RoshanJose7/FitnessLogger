import { useState, useEffect, useRef } from 'react'
import { Timer, X, RotateCcw, Play, Pause } from 'lucide-react'

const PRESETS = [
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
]

export default function RestTimer() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(90)
  const [remaining, setRemaining] = useState(null) // null = not started
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            vibrate()
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  function start() {
    if (remaining === null || remaining === 0) setRemaining(selected)
    setRunning(true)
  }

  function pause() {
    clearInterval(intervalRef.current)
    setRunning(false)
  }

  function reset() {
    clearInterval(intervalRef.current)
    setRunning(false)
    setRemaining(selected)
  }

  function selectPreset(s) {
    clearInterval(intervalRef.current)
    setRunning(false)
    setSelected(s)
    setRemaining(s)
  }

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }

  const total = selected
  const current = remaining ?? selected
  const pct = current / total
  const circumference = 2 * Math.PI * 38
  const offset = circumference * (1 - pct)
  const done = remaining === 0
  const mins = Math.floor(current / 60)
  const secs = current % 60

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 z-40 bg-black text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-gray-900 transition-colors"
        aria-label="Rest timer"
      >
        <Timer size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full md:w-80 p-6 md:rounded-none border-t md:border border-black">
            <div className="flex items-center justify-between mb-5">
              <span className="font-medium">Rest Timer</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Preset selector */}
            <div className="flex gap-2 mb-6">
              {PRESETS.map(p => (
                <button
                  key={p.seconds}
                  onClick={() => selectPreset(p.seconds)}
                  className={`flex-1 py-1.5 text-sm font-medium border transition-colors ${
                    selected === p.seconds ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-black'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Ring + countdown */}
            <div className="flex flex-col items-center gap-5 mb-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="38" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="44" cy="44" r="38" fill="none"
                    stroke={done ? '#16a34a' : '#000'}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-bold tabular-nums ${done ? 'text-green-600' : ''}`}>
                    {done ? 'Go!' : `${mins}:${String(secs).padStart(2, '0')}`}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                {!running ? (
                  <button
                    onClick={start}
                    className="flex items-center gap-1.5 bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-900 transition-colors"
                  >
                    <Play size={14} /> {remaining === null || remaining === selected ? 'Start' : 'Resume'}
                  </button>
                ) : (
                  <button
                    onClick={pause}
                    className="flex items-center gap-1.5 border border-black px-5 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    <Pause size={14} /> Pause
                  </button>
                )}
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 border border-gray-300 px-4 py-2 text-sm hover:border-black transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
