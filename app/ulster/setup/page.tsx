import { supabase } from "@/lib/supabase"
import UlsterSetupClient from "./UlsterSetupClient"

export default async function UlsterSetupPage() {
  const [coursesRes, teesRes, playersRes, matchesRes] = await Promise.all([
    supabase.from("ulster_courses").select("id, slug, name").order("name"),
    supabase
      .from("ulster_course_tees")
      .select("id, course_id, tee_name, gender, total_yards, course_rating, slope_rating, pars")
      .order("tee_name"),
    supabase
      .from("ulster_players")
      .select("id, player_id, handicap_index, players(id, name)")
      .order("created_at"),
    supabase
      .from("ulster_matches")
      .select("id, name, match_date, format, hcp_allowance, agg_holes, team_a_players, team_b_players, status, ulster_courses(name), ulster_course_tees(tee_name)")
      .order("match_date", { ascending: false }),
  ])

  // Default to first unoccupied trip date
  const existingDates = new Set((matchesRes.data ?? []).map((m: any) => m.match_date))
  const defaultDate = !existingDates.has("2026-04-19")
    ? "2026-04-19"
    : !existingDates.has("2026-04-20")
      ? "2026-04-20"
      : new Date().toISOString().split("T")[0]

  return (
    <UlsterSetupClient
      courses={(coursesRes.data ?? []) as any[]}
      tees={(teesRes.data ?? []) as any[]}
      ulsterPlayers={(playersRes.data ?? []) as any[]}
      matches={(matchesRes.data ?? []) as any[]}
      defaultDate={defaultDate}
    />
  )
}
