# Fitness Dashboard

> Requires the **Dataview** community plugin with *Enable JavaScript Queries* turned on.
> Both this file and `config.md` must be in the same vault folder (default: `Fitness Tracker/`).

---

```dataviewjs
// ─── CONFIG ────────────────────────────────────────────────────────────────
// If you rename or move this folder, update the path below (no .md extension).
const CONFIG_PATH = "Fitness Tracker/config"

const config = dv.page(CONFIG_PATH)
if (!config?.supabase_url) {
  dv.el("blockquote", "⚠️ config.md not found at: " + CONFIG_PATH + ". See setup instructions.")
  return
}

const SUPABASE_URL = config.supabase_url
const SUPABASE_KEY = config.supabase_key
const EMAIL        = config.supabase_email
const PASSWORD     = config.supabase_password

const SESSION_LABELS = { upper: "Upper Body", lower: "Lower Body", full: "Full Body" }
const PROTEIN_TARGET = 120  // grams — adjust to match your app setting

// ─── HELPERS ───────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0] }

function dateNDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]
}

function fmt(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short"
  })
}

// ─── AUTH (token cached in localStorage for ~1 hour) ───────────────────────
async function getToken() {
  const CACHE_KEY = "fitness-sb-token-v1"
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (cached && Date.now() < cached.exp) return cached
  } catch {}

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error("Authentication failed — check credentials in config.md")

  const d = await res.json()
  const out = {
    token: d.access_token,
    uid:   d.user.id,
    exp:   Date.now() + (d.expires_in - 120) * 1000,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(out))
  return out
}

// ─── FETCH HELPER ──────────────────────────────────────────────────────────
async function sbGet(token, path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Supabase query failed (${res.status}): ${path}`)
  return res.json()
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
try {
  const { token, uid } = await getToken()
  const from = dateNDaysAgo(7)
  const today = todayStr()

  // Fetch sessions + logs for the past 7 days in parallel
  const [workouts, nutritionLogs] = await Promise.all([
    sbGet(token, `workout_sessions?user_id=eq.${uid}&date=gte.${from}&order=date.desc`),
    sbGet(token, `nutrition_logs?user_id=eq.${uid}&date=gte.${from}&order=date.desc`),
  ])

  // Fetch sets, cardio, meals in parallel (only if parent rows exist)
  let allSets = [], allCardio = [], allMeals = []
  await Promise.all([
    workouts.length
      ? sbGet(token, `exercise_sets?session_id=in.(${workouts.map(w => w.id)})&order=session_id,set_number`)
          .then(d => allSets = d)
      : null,
    workouts.length
      ? sbGet(token, `cardio_logs?session_id=in.(${workouts.map(w => w.id)})`)
          .then(d => allCardio = d)
      : null,
    nutritionLogs.length
      ? sbGet(token, `meals?nutrition_log_id=in.(${nutritionLogs.map(n => n.id)})&order=nutrition_log_id,id`)
          .then(d => allMeals = d)
      : null,
  ])

  const todayW = workouts.find(w => w.date === today)
  const todayN = nutritionLogs.find(n => n.date === today)

  // ── TODAY ─────────────────────────────────────────────────────────────────
  dv.header(2, `Today — ${fmt(today)}`)

  // Workout
  dv.header(3, "Workout")
  if (todayW) {
    const label = SESSION_LABELS[todayW.session_type] ?? todayW.session_type
    const status = todayW.completed ? "✓ Complete" : "in progress"
    dv.paragraph(`**${label}** · Energy ${todayW.energy_level}/5 · ${status}`)

    const sets = allSets.filter(s => s.session_id === todayW.id)
    if (sets.length) {
      const byEx = {}
      for (const s of sets) { (byEx[s.exercise_name] ??= []).push(s) }
      const rows = []
      for (const [ex, ss] of Object.entries(byEx)) {
        for (const s of ss) {
          rows.push([ex, `S${s.set_number}`, s.weight ?? "–", s.reps ?? "–", s.notes ?? ""])
        }
      }
      dv.table(["Exercise", "Set", "Weight", "Reps", "Notes"], rows)
    }

    const cardio = allCardio.find(c => c.session_id === todayW.id)
    if (cardio) {
      const parts = [
        cardio.activity,
        cardio.distance && `${cardio.distance}`,
        cardio.duration && `${cardio.duration}`,
        cardio.pace     && `pace ${cardio.pace}`,
        cardio.felt     && `felt ${cardio.felt}/5`,
      ].filter(Boolean)
      dv.paragraph(`**Cardio:** ${parts.join(" · ") || "logged"}`)
      if (cardio.notes) dv.paragraph(`*${cardio.notes}*`)
    }

    if (todayW.notes) dv.paragraph(`*Session notes: ${todayW.notes}*`)
  } else {
    dv.paragraph("No workout logged today.")
  }

  // Nutrition
  dv.header(3, "Nutrition")
  if (todayN) {
    const meals  = allMeals.filter(m => m.nutrition_log_id === todayN.id)
    const totCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0)
    const totPro = meals.reduce((s, m) => s + (Number(m.protein_g) ?? 0), 0)
    const proOk  = totPro >= PROTEIN_TARGET

    dv.paragraph(
      `**${totCal} kcal · ${totPro}g protein** ${proOk ? `✓ (target ${PROTEIN_TARGET}g)` : `(target ${PROTEIN_TARGET}g)`}` +
      ` · ${todayN.water_l ?? "–"}L water`
    )

    if (meals.length) {
      dv.table(
        ["Meal", "Food", "kcal", "Protein (g)"],
        meals.map(m => [m.meal_type, m.food ?? "–", m.calories ?? "–", m.protein_g ?? "–"])
      )
    }

    if (todayN.notes) dv.paragraph(`*${todayN.notes}*`)
  } else {
    dv.paragraph("No nutrition logged today.")
  }

  // ── LAST 7 DAYS ───────────────────────────────────────────────────────────
  dv.header(2, "Last 7 Days")

  const weekRows = []
  for (let i = 0; i < 7; i++) {
    const d  = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split("T")[0]
    const w  = workouts.find(x => x.date === ds)
    const n  = nutritionLogs.find(x => x.date === ds)

    const dayMeals = allMeals.filter(m => {
      const parent = nutritionLogs.find(nl => nl.id === m.nutrition_log_id)
      return parent?.date === ds
    })
    const cal = dayMeals.reduce((s, m) => s + (m.calories ?? 0), 0)
    const pro = dayMeals.reduce((s, m) => s + (Number(m.protein_g) ?? 0), 0)

    weekRows.push([
      fmt(ds),
      w ? `${SESSION_LABELS[w.session_type] ?? w.session_type} ${w.completed ? "✓" : "…"}` : "–",
      w?.energy_level ? `${w.energy_level}/5` : "–",
      n ? (cal || "–") : "–",
      n ? (pro ? `${pro}g ${pro >= PROTEIN_TARGET ? "✓" : ""}` : "–") : "–",
      n?.water_l ?? "–",
    ])
  }

  dv.table(["Date", "Workout", "Energy", "Calories", "Protein", "Water (L)"], weekRows)

  // ── FOR CLAUDE ────────────────────────────────────────────────────────────
  // Copy the text below this line and paste into Claude for analysis.
  dv.header(2, "Export for Claude")
  dv.paragraph("*Select and copy the block below, then paste into Claude.*")

  const lines = []
  lines.push(`FITNESS DATA — ${fmt(dateNDaysAgo(6))} to ${fmt(today)}`)
  lines.push("")

  lines.push("WORKOUTS:")
  if (workouts.length === 0) {
    lines.push("  No workouts logged this week.")
  } else {
    for (const w of [...workouts].reverse()) {
      const label  = SESSION_LABELS[w.session_type] ?? w.session_type
      const status = w.completed ? "complete" : "draft"
      const sets   = allSets.filter(s => s.session_id === w.id)
      const byEx   = {}
      for (const s of sets) { (byEx[s.exercise_name] ??= []).push(s) }
      const exSummary = Object.entries(byEx)
        .map(([ex, ss]) => `${ex}: ${ss.map(s => `${s.weight ?? "?"}×${s.reps ?? "?"}`).join(", ")}`)
        .join("; ")

      const cardio = allCardio.find(c => c.session_id === w.id)
      const cardioStr = cardio
        ? ` | Cardio: ${[cardio.distance, cardio.duration, cardio.pace && `pace ${cardio.pace}`].filter(Boolean).join(", ")}`
        : ""

      lines.push(`  ${fmt(w.date)}: ${label} (energy ${w.energy_level}/5, ${status})`)
      if (exSummary) lines.push(`    Exercises — ${exSummary}`)
      if (cardioStr) lines.push(`    ${cardioStr}`)
      if (w.notes)   lines.push(`    Notes: ${w.notes}`)
    }
  }

  lines.push("")
  lines.push("NUTRITION:")
  if (nutritionLogs.length === 0) {
    lines.push("  No nutrition logged this week.")
  } else {
    for (const n of [...nutritionLogs].reverse()) {
      const meals  = allMeals.filter(m => m.nutrition_log_id === n.id)
      const cal    = meals.reduce((s, m) => s + (m.calories ?? 0), 0)
      const pro    = meals.reduce((s, m) => s + (Number(m.protein_g) ?? 0), 0)
      const byType = {}
      for (const m of meals) { (byType[m.meal_type] ??= []).push(m) }
      const mealStr = Object.entries(byType)
        .map(([type, items]) => `${type}: ${items.map(i => i.food).filter(Boolean).join(", ")}`)
        .join(" | ")
      lines.push(`  ${fmt(n.date)}: ${cal} kcal, ${pro}g protein, ${n.water_l ?? "?"}L water`)
      if (mealStr) lines.push(`    ${mealStr}`)
      if (n.notes) lines.push(`    Notes: ${n.notes}`)
    }
  }

  dv.el("pre", lines.join("\n"))

} catch (err) {
  dv.el("blockquote", `⚠️ ${err.message}`)
}
```

---

## Notes

Add your own observations below — things the app can't capture, like sleep quality, stress, soreness, or how your form felt. These become part of the analysis when you share this note with Claude.

### Personal notes

- 
