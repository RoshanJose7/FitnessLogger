import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import InstallPrompt from './components/InstallPrompt'
import SetupName from './components/SetupName'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkoutLog from './pages/WorkoutLog'
import NutritionLog from './pages/NutritionLog'
import GroupFeed from './pages/GroupFeed'
import './index.css'

const History = lazy(() => import('./pages/History'))

const Spinner = () => (
  <div className="min-h-dvh flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
  </div>
)

const HistoryFallback = (
  <div className="space-y-3">
    {[1, 2, 3].map(i => <div key={i} className="h-16 border border-gray-200 animate-pulse bg-gray-50" />)}
  </div>
)

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profileChecked, setProfileChecked] = useState(false)
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfileChecked(false); setHasProfile(false); return }
    supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setHasProfile(!!data)
        setProfileChecked(true)
      })
  }, [session])

  if (session === undefined) return <Spinner />

  if (session && !profileChecked) return <Spinner />

  if (session && !hasProfile) {
    return <SetupName session={session} onDone={() => setHasProfile(true)} />
  }

  return (
    <>
      {session && <InstallPrompt />}
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={session ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute session={session}>
                <Layout session={session}>
                  <Routes>
                    <Route path="/" element={<Dashboard session={session} />} />
                    <Route path="/workout" element={<WorkoutLog session={session} />} />
                    <Route path="/nutrition" element={<NutritionLog session={session} />} />
                    <Route path="/history" element={
                      <Suspense fallback={HistoryFallback}>
                        <History session={session} />
                      </Suspense>
                    } />
                    <Route path="/group" element={<GroupFeed session={session} />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  )
}
