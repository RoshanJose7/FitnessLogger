import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkoutLog from './pages/WorkoutLog'
import NutritionLog from './pages/NutritionLog'
import './index.css'

const History = lazy(() => import('./pages/History'))

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
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
                    <Suspense fallback={<div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 border border-gray-200 animate-pulse bg-gray-50" />)}</div>}>
                      <History session={session} />
                    </Suspense>
                  } />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
