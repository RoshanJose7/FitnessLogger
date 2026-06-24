export function currentWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function buildMonthGrid(year, month, sessions) {
  const today = todayStr()
  const sessionMap = {}
  for (const s of (sessions || [])) sessionMap[s.date] = s

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon=0..Sun=6

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push({ isEmpty: true })
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const s = sessionMap[dateStr] ?? null
    cells.push({
      isEmpty: false,
      date: dateStr,
      day: d,
      isToday: dateStr === today,
      isFuture: dateStr > today,
      trained: s?.completed ?? false,
      partial: s != null && !s.completed,
      session: s,
    })
  }
  return cells
}

export function buildInsights(recentSessions) {
  const [weekStart] = currentWeekRange()
  const completed = (recentSessions || []).filter(s => s.completed)

  const weekLabels = ['3 wks ago', '2 wks ago', 'Last week', 'This week']
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const offset = (3 - i) * 7
    const wMon = new Date(weekStart + 'T00:00:00')
    wMon.setDate(wMon.getDate() - offset)
    const wSun = new Date(wMon)
    wSun.setDate(wMon.getDate() + 6)
    const wMonStr = wMon.toISOString().split('T')[0]
    const wSunStr = wSun.toISOString().split('T')[0]
    const count = completed.filter(s => s.date >= wMonStr && s.date <= wSunStr).length
    return { label: weekLabels[i], count, onTarget: count >= 3 }
  })

  const typeCounts = { upper: 0, lower: 0, full: 0 }
  for (const s of completed) {
    if (s.session_type in typeCounts) typeCounts[s.session_type]++
  }
  const maxTypeCount = Math.max(...Object.values(typeCounts), 1)
  const hasTypeMix = Object.values(typeCounts).some(n => n > 0)

  const withEnergy = completed.filter(s => s.energy_level != null)
  const avgEnergy = withEnergy.length > 0
    ? Math.round(withEnergy.reduce((sum, s) => sum + s.energy_level, 0) / withEnergy.length * 10) / 10
    : null

  const lastSession = completed[0] ?? null

  return {
    weeks,
    weeksOnTarget: weeks.filter(w => w.onTarget).length,
    typeCounts,
    maxTypeCount,
    hasTypeMix,
    avgEnergy,
    lastSession,
  }
}
