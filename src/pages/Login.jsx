import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from '../lib/auth'
import { ease, springSmooth } from '../lib/animations'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...springSmooth, duration: 0.55 }}
        className="w-full max-w-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease }}
          className="mb-10"
        >
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Zenith</h1>
          <p className="text-sm text-gray-500">Sign in to your account</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.45, ease }}
          >
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <motion.input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              whileFocus={{ scale: 1.005 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full border border-black px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.45, ease }}
          >
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <motion.input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                whileFocus={{ scale: 1.005 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="w-full border border-black px-3 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                whileTap={{ scale: 0.85 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={showPassword ? 'hide' : 'show'}
                    initial={{ opacity: 0, rotate: -15, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 15, scale: 0.8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0, x: [-6, 6, -4, 4, -2, 2, 0] }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, x: { duration: 0.4, delay: 0.05 } }}
                className="border border-black bg-black text-white px-3 py-2.5 text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.45, ease }}
          >
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 relative overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={loading ? 'loading' : 'idle'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="block"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  )
}
