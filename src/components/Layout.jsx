import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Dumbbell, UtensilsCrossed, History, Users, LogOut, LayoutDashboard, Flame } from 'lucide-react'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { calcStreakSimple } from '../lib/exercises'

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
        <span
          className={`flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
            isActive ? 'text-black' : 'text-gray-400'
          }`}
        >
          <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
          {label}
        </span>
      )}
    </NavLink>
  )
}

function FlameChip({ streak }) {
  const active = streak > 0
  return (
    <span className={`flex items-center gap-1 transition-colors ${active ? 'text-black' : 'text-gray-300'}`}>
      <Flame size={18} strokeWidth={active ? 2 : 1.5} />
      {active && <span className="text-sm font-bold tabular-nums leading-none">{streak}</span>}
    </span>
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
      <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link to="/app" className="font-semibold tracking-tight text-lg hover:opacity-70 transition-opacity">
            Fitness Logger
          </Link>
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
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-black sticky top-0 bg-white z-50">
        <span className="font-semibold tracking-tight">Fitness Logger</span>
        <div className="flex items-center gap-3">
          <FlameChip streak={streak} />
          <button
            onClick={signOut}
            className="p-1 text-gray-400 hover:text-black transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 md:px-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black flex justify-around z-50">
        {MOBILE_NAV.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} />
        ))}
      </nav>
    </div>
  )
}
