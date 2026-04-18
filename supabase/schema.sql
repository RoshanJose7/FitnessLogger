-- Run this entire file in your Supabase SQL Editor (supabase.com > project > SQL Editor)

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- Workout sessions
-- ─────────────────────────────────────────
create table workout_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  session_type text not null check (session_type in ('upper', 'lower', 'full')),
  energy_level int check (energy_level between 1 and 5),
  notes       text,
  completed   boolean default false,
  created_at  timestamptz default now()
);

-- One session per user per day
create unique index workout_sessions_user_date on workout_sessions(user_id, date);

-- RLS
alter table workout_sessions enable row level security;
create policy "Users manage own sessions"
  on workout_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- Exercise sets
-- ─────────────────────────────────────────
create table exercise_sets (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references workout_sessions(id) on delete cascade not null,
  exercise_name text not null,
  set_number    int not null check (set_number between 1 and 10),
  weight        text,   -- stored as text to allow "20kg", "BW", etc.
  reps          text,   -- stored as text to allow "10", "AMRAP", etc.
  notes         text,
  created_at    timestamptz default now()
);

alter table exercise_sets enable row level security;
create policy "Users manage own sets"
  on exercise_sets for all
  using (
    exists (
      select 1 from workout_sessions ws
      where ws.id = exercise_sets.session_id
        and ws.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_sessions ws
      where ws.id = exercise_sets.session_id
        and ws.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- Cardio logs
-- ─────────────────────────────────────────
create table cardio_logs (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid references workout_sessions(id) on delete cascade not null,
  activity    text,
  distance    text,
  duration    text,
  pace        text,
  felt        int check (felt between 1 and 5),
  notes       text,
  created_at  timestamptz default now()
);

alter table cardio_logs enable row level security;
create policy "Users manage own cardio"
  on cardio_logs for all
  using (
    exists (
      select 1 from workout_sessions ws
      where ws.id = cardio_logs.session_id
        and ws.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_sessions ws
      where ws.id = cardio_logs.session_id
        and ws.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- Nutrition logs (one per user per day)
-- ─────────────────────────────────────────
create table nutrition_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  date            date not null,
  is_workout_day  boolean default false,
  water_l         numeric(4,2),
  notes           text,
  created_at      timestamptz default now()
);

create unique index nutrition_logs_user_date on nutrition_logs(user_id, date);

alter table nutrition_logs enable row level security;
create policy "Users manage own nutrition logs"
  on nutrition_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- Meals
-- ─────────────────────────────────────────
create table meals (
  id                uuid primary key default uuid_generate_v4(),
  nutrition_log_id  uuid references nutrition_logs(id) on delete cascade not null,
  meal_type         text not null check (meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snacks')),
  food              text,
  calories          int,
  protein_g         numeric(6,1),
  created_at        timestamptz default now()
);

alter table meals enable row level security;
create policy "Users manage own meals"
  on meals for all
  using (
    exists (
      select 1 from nutrition_logs nl
      where nl.id = meals.nutrition_log_id
        and nl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nutrition_logs nl
      where nl.id = meals.nutrition_log_id
        and nl.user_id = auth.uid()
    )
  );
