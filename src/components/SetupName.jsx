import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SetupName({ session, onDone }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, display_name: trimmed })
    if (err) {
      setError('Could not save name. Try again.')
      setLoading(false)
    } else {
      onDone(trimmed)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">One more thing</h1>
          <p className="text-sm text-gray-500">What should we call you in the group feed?</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Display name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Roshan"
              className="w-full border border-black px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
            />
          </div>
          {error && (
            <div role="alert" className="border border-black bg-black text-white px-3 py-2.5 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-black text-white py-3 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
