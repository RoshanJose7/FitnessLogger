import { Link } from 'react-router-dom'
import { Dumbbell, UtensilsCrossed, BarChart2, Users, Scan, Timer, TrendingUp, ShieldCheck } from 'lucide-react'

const TICKER_ITEMS = [
  'Workout logging', 'Nutrition tracking', 'Barcode scanning',
  'Rest timer', 'Progress charts', 'Group feed',
  'Streak tracking', 'Weekly volume', 'OCR labels',
  'Invite only', 'Private by design',
]

const STEPS = [
  {
    n: '01',
    title: 'Log your session',
    body: 'Every set, every rep, every weight. Add exercises from a library or create your own. The rest timer fires automatically between sets so you never lose count.',
  },
  {
    n: '02',
    title: 'Track what you eat',
    body: 'Scan a barcode or point your camera at a nutrition label — the fields fill themselves in. Add meals manually when you know the numbers by heart.',
  },
  {
    n: '03',
    title: 'Watch the trend',
    body: 'Every session stacks into a history. See your volume climb week over week. Watch your protein average hold. The data doesn\'t lie.',
  },
  {
    n: '04',
    title: 'Stay accountable',
    body: 'Your group sees what you logged today. No likes, no comments — just a quiet signal that you showed up. Or didn\'t.',
  },
]

const FEATURES = [
  { icon: Dumbbell,        title: 'Workout log',      desc: 'Sets, reps, weights. Custom exercises. Auto rest timer.' },
  { icon: UtensilsCrossed, title: 'Nutrition log',     desc: 'Calories, protein, carbs, fat. Per meal or per day.' },
  { icon: Scan,            title: 'Scan anything',     desc: 'Barcode lookup and camera OCR for nutrition panels.' },
  { icon: Timer,           title: 'Rest timer',        desc: 'Fires between sets. Counts down. Vibrates when done.' },
  { icon: BarChart2,       title: 'Progress charts',   desc: 'One-rep max estimates. Volume over time. Per exercise.' },
  { icon: Users,           title: 'Group feed',        desc: 'See who trained today. No social noise, just signal.' },
  { icon: TrendingUp,      title: 'Streaks & history', desc: 'Weekly summaries. Consecutive day streaks. Full log.' },
  { icon: ShieldCheck,     title: 'Private by design', desc: 'No public profiles. No ads. Invite only.' },
]

const FOR_YOU_IF = [
  'You log every session, not just the PRs',
  'You know your weekly protein average off the top of your head',
  'You care about progressive overload, not how your gym selfie looks',
  'You\'ve outgrown the notes app but don\'t want another social platform',
  'You train with people you actually know',
  'You want data, not motivation quotes',
]

export default function Landing() {
  return (
    <div className="bg-white text-black">

      {/* ── Nav ── */}
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <span className="text-sm font-semibold tracking-tight">Fitness Logger</span>
        <div className="flex items-center gap-6">
          <span className="hidden sm:inline text-xs tracking-widest uppercase text-gray-400">Private beta</span>
          <Link
            to="/login"
            className="text-sm font-medium border border-black px-4 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-[90dvh] flex flex-col justify-between border-b border-black">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-xs font-medium tracking-widest uppercase mb-8 border border-black px-3 py-1.5 inline-block">
            Not open to the public — yet
          </p>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-semibold tracking-tighter leading-none mb-8 max-w-4xl">
            The fitness tracker<br />
            <span className="italic font-normal">that stays out</span><br />
            of your way.
          </h1>
          <p className="text-gray-500 text-lg sm:text-xl max-w-lg mb-12 leading-relaxed">
            Log workouts. Track nutrition. See your progress. Stay accountable with the people you actually train with. Nothing else.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/login"
              className="bg-black text-white px-10 py-4 text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              Sign in to your account
            </Link>
            <span className="text-sm text-gray-400">
              Public launch coming soon
            </span>
          </div>
        </div>
        {/* Stat strip */}
        <div className="grid grid-cols-3 border-t border-black">
          {[
            { n: '100%', label: 'Private' },
            { n: 'Zero', label: 'Ads' },
            { n: 'One', label: 'Focus: your data' },
          ].map(({ n, label }) => (
            <div key={label} className="py-6 px-6 text-center border-r border-black last:border-r-0">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight">{n}</div>
              <div className="text-xs text-gray-400 mt-1 tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ticker ── */}
      <div className="border-b border-black py-3 overflow-hidden bg-black text-white">
        <div className="flex w-max animate-[ticker_30s_linear_infinite] whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="text-xs font-medium tracking-widest uppercase mx-6">
              {item} <span className="mx-3 opacity-30">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Manifesto ── */}
      <section className="bg-black text-white px-6 py-24 border-b border-black">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-500 mb-12">Why this exists</p>
          <blockquote className="text-2xl sm:text-4xl font-semibold tracking-tight leading-snug mb-12">
            "Most fitness apps are built to keep you engaged. This one is built to get out of your way."
          </blockquote>
          <div className="grid sm:grid-cols-2 gap-8 text-sm text-gray-400 leading-relaxed">
            <p>
              You don't need a social feed. You don't need streaks gamified into dopamine loops. You don't need AI-generated workout plans based on your "goals." You need a fast, reliable place to record what you did, track what you ate, and see if the numbers are moving.
            </p>
            <p>
              Fitness Logger was built for a small group of people who already know what they're doing — they just needed a tool that didn't get in the way. It's still that. It's not trying to be anything else.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-b border-black">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-16">How it works</p>
          <div className="space-y-0">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`grid sm:grid-cols-[120px_1fr] gap-6 py-10 ${i < STEPS.length - 1 ? 'border-b border-black' : ''}`}
              >
                <div className="text-5xl font-semibold tracking-tighter text-gray-200 leading-none select-none">
                  {s.n}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed max-w-xl">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="border-b border-black">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-10">Everything included</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px border border-black bg-black">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-6 flex flex-col gap-3">
                <f.icon size={16} strokeWidth={1.5} />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="border-b border-black">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-10">This is for you if</p>
          <div className="grid sm:grid-cols-2 gap-px border border-black bg-black">
            {FOR_YOU_IF.map((line) => (
              <div key={line} className="bg-white px-6 py-5 flex items-start gap-4">
                <span className="text-black mt-0.5 shrink-0 text-xs">→</span>
                <p className="text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request access ── */}
      <section className="bg-black text-white border-b border-white/10 px-6 py-24">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-500 mb-6">Access</p>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight mb-6">
            Interested?
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-10 max-w-sm mx-auto">
            Fitness Logger isn't open to the public yet. When it is, you'll be able to sign up here. For now, sit tight.
          </p>
          <div className="inline-block border border-white/20 px-10 py-4 text-sm text-gray-500 cursor-default">
            Coming soon
          </div>
          <p className="text-gray-600 text-xs mt-6">Already have access?{' '}
            <Link to="/login" className="text-gray-400 underline underline-offset-4 hover:text-white transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-5 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium tracking-tight">Fitness Logger</span>
        <span className="text-xs text-gray-300">Private beta · {new Date().getFullYear()}</span>
      </footer>

    </div>
  )
}
