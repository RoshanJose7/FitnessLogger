import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, UtensilsCrossed, History, LogOut } from 'lucide-react'
import { signOut } from '../lib/auth'

const NAV = [
  { to: '/', label: 'Today', icon: LayoutDashboard },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  { to: '/history', label: 'History', icon: History },
]

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink to={to} end={to === '/'}>
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

export default function Layout({ children }) {
  return (
    <div className="min-h-dvh flex flex-col max-w-2xl mx-auto">
      {/* Desktop top nav */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-black">
        <span className="font-semibold tracking-tight text-lg">Fitness Logger</span>
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
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
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-black">
        <span className="font-semibold tracking-tight">Fitness Logger</span>
        <button
          onClick={signOut}
          className="p-1 text-gray-400 hover:text-black transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 md:px-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black flex justify-around z-50">
        {NAV.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} />
        ))}
      </nav>
    </div>
  )
}
