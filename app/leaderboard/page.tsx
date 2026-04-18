import { supabase } from "@/lib/supabase"
import Link from "next/link"
import LeaderboardClient from "./LeaderboardClient"
import Poller from "@/app/components/Poller"
import BackButton from "@/app/components/BackButton"

export const dynamic = "force-dynamic"

export default async function LeaderboardPage() {
  const [roundsRes, teamsRes, playersRes, holesRes, scoresRes, hcpsRes, teesRes, compositeHolesRes] = await Promise.all([
    supabase.from("rounds").select("id, round_number, status, courses(id, name)").order("round_number"),
    supabase.from("teams").select("id, name, color").order("name"),
    supabase.from("players").select("id, name, role, handicap, is_composite, gender, team_id").order("name"),
    supabase.from("holes").select("id, hole_number, par, stroke_index, course_id").order("hole_number"),
    supabase.from("scores").select("player_id, hole_id, gross_score, stableford_points, no_return, round_id"),
    supabase.from("round_handicaps").select("round_id, player_id, playing_handicap"),
    supabase.from("tees").select("id, course_id, name, gender, par"),
    supabase.from("composite_holes").select("composite_player_id, round_id, hole_id, source_player_id"),
  ])
  const rounds = roundsRes.data
  const allPlayers = playersRes.data ?? []
  const teams = (teamsRes.data ?? []).map(team => ({
    ...team,
    players: allPlayers.filter(p => p.team_id === team.id),
  }))
  const holes = holesRes.data ?? []
  const scores = scoresRes.data ?? []
  const roundHandicaps = hcpsRes.data
  const tees = teesRes.data
  const compositeHoles = compositeHolesRes.data ?? []
  const hasActiveRound = rounds?.some((r: any) => r.status === "active") ?? false
  const activeRoundIds = (rounds ?? [])
    .filter((r: any) => r.status === "active")
    .map((r: any) => r.id as string)

  // Always fetch uncommitted live scores — don't gate on round status,
  // which may lag behind actual scoring activity.
  const { data: liveScores } = await supabase
    .from("live_scores")
    .select("player_id, round_id, hole_number, gross_score, stableford_points")
    .eq("committed", false)

  let mergedScores = [...scores]
  if (liveScores?.length) {
    // Build round_id:hole_number → hole_id lookup across all rounds
    const holeIdByRoundHole = new Map<string, string>()
    for (const round of (rounds ?? []) as any[]) {
      const courseId = round.courses?.id
      if (!courseId) continue
      for (const hole of holes) {
        if ((hole as any).course_id === courseId) {
          holeIdByRoundHole.set(`${round.id}:${(hole as any).hole_number}`, (hole as any).id)
        }
      }
    }

    const finalizedKeys = new Set(scores.map((s: any) => `${s.player_id}:${s.round_id}:${s.hole_id}`))

    for (const ls of liveScores as any[]) {
      const holeId = holeIdByRoundHole.get(`${ls.round_id}:${ls.hole_number}`)
      if (!holeId) continue
      if (finalizedKeys.has(`${ls.player_id}:${ls.round_id}:${holeId}`)) continue
      mergedScores.push({
        player_id: ls.player_id,
        hole_id: holeId,
        round_id: ls.round_id,
        gross_score: ls.gross_score,
        stableford_points: ls.stableford_points,
        no_return: false,
      })
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="sticky top-0 z-50 bg-[#0a1a0e] border-b border-[#1e3d28]">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-white tracking-wide">
            The Donegal Masters
          </h1>
          <Link href="/leaderboard/individual" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-[#C9A84C] hover:bg-white/15 hover:text-white transition-colors flex-shrink-0 text-[10px] tracking-widest uppercase text-center leading-tight px-1">
            Solo
          </Link>
        </div>
      </div>

      <Poller isActive={hasActiveRound} />
      <div className="max-w-lg mx-auto px-4 py-8">
        <LeaderboardClient
          rounds={(rounds ?? []) as any}
          teams={(teams ?? []) as any}
          holes={holes}
          scores={mergedScores as any}
          roundHandicaps={roundHandicaps ?? []}
          tees={(tees ?? []) as any}
          compositeHoles={compositeHoles as any}
          activeRoundIds={activeRoundIds}
        />
      </div>
    </div>
  )
}
