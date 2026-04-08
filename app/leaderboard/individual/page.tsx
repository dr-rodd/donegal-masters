import { supabase } from "@/lib/supabase"
import Link from "next/link"
import IndividualClient from "./IndividualClient"
import Poller from "@/app/components/Poller"
import BackButton from "@/app/components/BackButton"

export const revalidate = 30

export default async function IndividualPage() {
  const [roundsRes, playersRes, holesRes, scoresRes, hcpsRes] = await Promise.all([
    supabase.from("rounds").select("id, round_number, status, courses(id, name)").order("round_number"),
    supabase.from("players").select("id, name, role, handicap, team_id, is_composite, teams(name, color)").order("name"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id").order("hole_number"),
    supabase.from("scores").select("player_id, hole_id, round_id, stableford_points, gross_score, no_return"),
    supabase.from("round_handicaps").select("round_id, player_id, playing_handicap"),
  ])

  const hasActiveRound = roundsRes.data?.some((r: any) => r.status === "active") ?? false

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28]">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <BackButton href="/leaderboard" />
          <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
            Individual Standings
          </h1>
          <div className="w-11" />
        </div>
      </div>

      <Poller isActive={hasActiveRound} />
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
