import { supabase } from "@/lib/supabase"
import ScoringClient from "./ScoringClient"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const [playersRes, roundsRes, holesRes, teesRes, hcpsRes, liveRoundsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, role, handicap, gender, is_composite, teams(name, color)")
      .order("name"),
    supabase
      .from("rounds")
      .select("id, round_number, status, courses(id, name)")
      .order("round_number"),
    supabase
      .from("holes")
      .select("id, hole_number, par, stroke_index, course_id, par_ladies, stroke_index_ladies, yardage_black, yardage_blue, yardage_white, yardage_red, yardage_sandstone, yardage_slate, yardage_granite, yardage_claret")
      .order("hole_number"),
    supabase
      .from("tees")
      .select("id, course_id, name, gender, par, course_rating, slope"),
    supabase
      .from("round_handicaps")
      .select("round_id, player_id, playing_handicap"),
    supabase
      .from("live_rounds")
      .select("id, course_id, round_id, activated_by, rounds(round_number), courses(name)")
      .eq("status", "active")
      .limit(1),
  ])

  return (
    <ScoringClient
      players={(playersRes.data ?? []) as any}
      rounds={(roundsRes.data ?? []) as any}
      holes={(holesRes.data ?? []) as any}
      tees={(teesRes.data ?? []) as any}
      roundHandicaps={hcpsRes.data ?? []}
      activeLiveRound={(liveRoundsRes.data?.[0] ?? null) as any}
    />
  )
}
