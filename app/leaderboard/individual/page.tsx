import { supabase } from "@/lib/supabase"
import Link from "next/link"
import IndividualClient from "./IndividualClient"

export const revalidate = 30

export default async function IndividualPage() {
  const [roundsRes, playersRes, holesRes, scoresRes, hcpsRes] = await Promise.all([
    supabase.from("rounds").select("id, round_number, courses(id, name)").order("round_number"),
    supabase.from("players").select("id, name, role, handicap, team_id, teams(name, color)").order("name"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id").order("hole_number"),
    supabase.from("scores").select("player_id, hole_id, round_id, stableford_points, gross_score, no_return"),
    supabase.from("round_handicaps").select("round_id, player_id, playing_handicap"),
  ])

  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28]">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/leaderboard" className="text-[#C9A84C] text-sm tracking-[0.2em] uppercase hover:text-white transition-colors">
            ← Leaderboard
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
            Individual Standings
          </h1>
          <span className="text-white/30 text-xs tracking-widest uppercase hidden sm:block">2026</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <IndividualClient
          rounds={(roundsRes.data ?? []) as any}
          players={(playersRes.data ?? []) as any}
          holes={(holesRes.data ?? []) as any}
          scores={scoresRes.data ?? []}
          roundHandicaps={hcpsRes.data ?? []}
        />
      </div>
    </div>
  )
}
