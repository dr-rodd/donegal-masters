import { supabase } from "@/lib/supabase"
import Link from "next/link"
import LeaderboardClient from "./LeaderboardClient"
import Poller from "@/app/components/Poller"

export const revalidate = 30

export default async function LeaderboardPage() {
  const [roundsRes, teamsRes, holesRes, scoresRes, hcpsRes] = await Promise.all([
    supabase.from("rounds").select("id, round_number, status, courses(id, name)").order("round_number"),
    supabase.from("teams").select("id, name, color, players(id, name, role, handicap)").order("name"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id").order("hole_number"),
    supabase.from("scores").select("player_id, hole_id, gross_score, stableford_points, no_return, round_id"),
    supabase.from("round_handicaps").select("round_id, player_id, playing_handicap"),
  ])
  console.log("[leaderboard] rounds:", roundsRes.data, "error:", roundsRes.error)
  console.log("[leaderboard] teams:", teamsRes.data, "error:", teamsRes.error)
  console.log("[leaderboard] holes count:", holesRes.data?.length, "error:", holesRes.error)
  console.log("[leaderboard] scores count:", scoresRes.data?.length, "error:", scoresRes.error)
  const rounds = roundsRes.data
  const teams = teamsRes.data
  const holes = holesRes.data
  const scores = scoresRes.data
  const roundHandicaps = hcpsRes.data
  const hasActiveRound = rounds?.some((r: any) => r.status === "active") ?? false

  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28]">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">
            ← Home
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
            The Donegal Masters
          </h1>
          <Link href="/leaderboard/individual" className="text-white/40 text-sm tracking-[0.2em] uppercase hover:text-[#C9A84C] transition-colors">
            Individual →
          </Link>
        </div>
      </div>

      <Poller isActive={hasActiveRound} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <LeaderboardClient
          rounds={(rounds ?? []) as any}
          teams={(teams ?? []) as any}
          holes={holes ?? []}
          scores={scores ?? []}
          roundHandicaps={roundHandicaps ?? []}
        />
      </div>
    </div>
  )
}
