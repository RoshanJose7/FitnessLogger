import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, UtensilsCrossed, History, Users, LogOut, LayoutDashboard, Flame } from 'lucide-react'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { calcStreakSimple } from '../lib/exercises'
import { ease, spring } from '../lib/animations'

const NAV = [
  { to: '/app/workout', label: 'Workout', icon: Dumbbell },
  { to: '/app/nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/group', label: 'Mates', icon: Users },
]

const MOBILE_NAV = [
  { to: '/app', label: 'Today', icon: LayoutDashboard },
  ...NAV,
]

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink to={to} end={to === '/app'}>
      {({ isActive }) => (
        <motion.span
          className={`flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
            isActive ? 'text-black' : 'text-gray-400'
          }`}
          whileTap={{ scale: 0.9 }}
        >
          <motion.span
            animate={{ scale: isActive ? 1.15 : 1 }}
            transition={spring}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
          </motion.span>
          {label}
        </motion.span>
      )}
    </NavLink>
  )
}

function FlameChip({ streak }) {
  const active = streak > 0
  return (
    <motion.span
      className={`flex items-center gap-1 transition-colors ${active ? 'text-black' : 'text-gray-300'}`}
      animate={active ? { scale: [1, 1.2, 1] } : {}}
      transition={{ delay: 0.6, type: 'spring', stiffness: 400, damping: 15 }}
    >
      <Flame size={18} strokeWidth={active ? 2 : 1.5} />
      {active && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm font-bold tabular-nums leading-none"
        >
          {streak}
        </motion.span>
      )}
    </motion.span>
  )
}

export default function Layout({ children, session }) {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    if (!session) return
    supabase
      .from('workout_sessions')
      .select('date, completed')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .then(({ data }) => setStreak(calcStreakSimple(data || [])))
  }, [session])

  return (
    <div className="min-h-dvh flex flex-col max-w-2xl mx-auto">
      {/* Desktop top nav */}
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease }}
        className="hidden md:flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-white z-50"
      >
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}>
            <Link to="/app" className="font-bold tracking-tight text-lg hover:opacity-70 transition-opacity">
              Zenith
            </Link>
          </motion.div>
          <FlameChip streak={streak} />
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border transition-colors ` +
                (isActive
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-transparent hover:border-black')
              }
            >
              {({ isActive }) => (
                <motion.span
                  animate={{ scale: isActive ? 1 : 1 }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  className="block"
                >
                  {label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>
        <motion.button
          onClick={signOut}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.93 }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </motion.button>
      </motion.header>

      {/* Mobile top bar */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="md:hidden flex items-center justify-between px-4 py-3 border-b border-black sticky top-0 bg-white z-50"
      >
        <motion.span
          className="font-bold tracking-tight"
          whileHover={{ scale: 1.05 }}
        >
          Zenith
        </motion.span>
        <div className="flex items-center gap-3">
          <FlameChip streak={streak} />
          <motion.button
            onClick={signOut}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88, rotate: -10 }}
            className="p-1 text-gray-400 hover:text-black transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </motion.button>
        </div>
      </motion.header>

      {/* Main content — page transitions handled by AnimatePresence in AppRoutes */}
      <main className="flex-1 px-4 py-6 md:px-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease, delay: 0.1 }}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black flex justify-around z-50"
      >
        {MOBILE_NAV.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} />
        ))}
      </motion.nav>
    </div>
  )
}
