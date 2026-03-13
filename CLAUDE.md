# Donegal Masters

A golf tournament scoring app for a 3-round family competition at Rosapenna Resort, Co. Donegal.

## App Overview

- 12 players across 4 family teams (3 players each: 1 dad, 1 mum, 1 son)
- 3 rounds, one per course at Rosapenna Resort
- Hole-by-hole stableford scoring
- Team leaderboard based on best stableford score per hole per round

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Supabase client:** `lib/supabase.ts` — import as `import { supabase } from '@/lib/supabase'`
- **Package manager:** npm

## Courses

| Round | Course |
|-------|--------|
| 1 | Sandy Hills |
| 2 | Old Tom Morris |
| 3 | St Patrick Links |

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `teams` | 3 teams, each with a `name` and `color` (hex) |
| `players` | 12 players, each with `team_id`, `name`, `role` (dad/mum/child), `handicap` |
| `courses` | One row per course |
| `holes` | 18 holes per course — `hole_number`, `par`, `stroke_index` |
| `rounds` | Links `round_number` (1–3) to a `course_id`, has a `status` (upcoming/active/completed) |
| `round_handicaps` | Snapshot of each player's `playing_handicap` per round — use this for scoring, not `players.handicap` |
| `scores` | One row per player/hole/round — `gross_score` and auto-calculated `stableford_points` |

### Views

| View | Description |
|------|-------------|
| `leaderboard_by_round` | Best stableford score per hole per team per round, with `running_team_total` |
| `leaderboard_summary` | Total team points per round, ordered by score descending |

### Key Constraints

- One dad, one mum, one son per team — dad/mum uniqueness enforced via partial unique indexes
- One score per player per hole per round (unique constraint)
- Each course played only once across the 3 rounds

## Stableford Scoring Rules

Points are calculated automatically by a PostgreSQL trigger (`trg_scores_stableford`) on every insert/update to `scores`.

**Formula:**
```
shots_received = FLOOR(playing_handicap / 18) + (1 if stroke_index <= playing_handicap % 18 else 0)
net_score      = gross_score - shots_received
points         = GREATEST(0, par + 2 - net_score)
```

**Points reference:**
| Result | Points |
|--------|--------|
| Albatross (3 under) | 5 |
| Eagle (2 under) | 4 |
| Birdie (1 under) | 3 |
| Par | 2 |
| Bogey (1 over) | 1 |
| Double bogey or worse | 0 |

## Team Scoring

The team score for each hole is the **best (highest) stableford points** scored by any member of that team on that hole. The team leaderboard sums these best-ball scores across all 18 holes.

## Data Insertion Order

When seeding, respect foreign key constraints:
1. `teams`
2. `players`
3. `courses`
4. `holes`
5. `rounds`
6. `round_handicaps`
7. `scores`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Stored in `.env.local` (gitignored).

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Home page |
| `app/layout.tsx` | Root layout |
| `lib/supabase.ts` | Supabase client |
| `supabase/schema.sql` | Full database schema — run in Supabase SQL editor |
