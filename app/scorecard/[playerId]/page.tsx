import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import ScorecardClient from "./ScorecardClient"

export const revalidate = 30

export default async function ScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { playerId } = await params
  const { from } = await searchParams

  const [playerRes, roundsRes, holesRes, scoresRes, hcpsRes, teesRes] = await Promise.all([
    supabase.from("players").select("id, name, role, gender, handicap, teams(name, color)").eq("id", playerId).single(),
    supabase.from("rounds").select("id, round_number, status, courses(id, name)").order("round_number"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id, yardage_black, yardage_blue, yardage_white, yardage_red, yardage_sandstone, yardage_slate, yardage_granite, yardage_claret").order("hole_number"),
    supabase.from("scores").select("hole_id, round_id, gross_score, stableford_points, no_return").eq("player_id", playerId),
    supabase.from("round_handicaps").select("round_id, playing_handicap").eq("player_id", playerId),
    supabase.from("tees").select("id, course_id, name, gender, par"),
  ])

  if (!playerRes.data) notFound()

  const backHref = from === "individual" ? "/leaderboard/individual" : "/leaderboard"

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28]">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href={backHref} className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            {(playerRes.data as any).teams && (
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (playerRes.data as any).teams.color }} />
            )}
            <h1 className="font-[family-name:var(--font-playfair)] text-xl text-white tracking-wide">
              {playerRes.data.name}
            </h1>
          </div>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <ScorecardClient
          player={playerRes.data as any}
          rounds={(roundsRes.data ?? []) as any}
          holes={(holesRes.data ?? []) as any}
          scores={scoresRes.data ?? []}
          roundHandicaps={hcpsRes.data ?? []}
          tees={(teesRes.data ?? []) as any}
        />
      </div>
    </div>
  )
}
