import { supabase } from "@/lib/supabase"
import UlsterSettingsClient from "./UlsterSettingsClient"

export default async function UlsterSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string }>
}) {
  const { dev } = await searchParams
  const isDev = dev === "1"

  const [ulsterPlayersRes, allPlayersRes, coursesRes, teesRes, tripRes] = await Promise.all([
    supabase
      .from("ulster_players")
      .select("id, player_id, handicap_index, players(id, name, handicap)")
      .order("created_at"),
    supabase.from("players").select("id, name, handicap").order("name"),
    supabase.from("ulster_courses").select("id, slug, name").order("name"),
    supabase.from("ulster_course_tees")
      .select("id, course_id, tee_name, gender, total_yards, course_rating, slope_rating, par_front, par_back, par_total, yardages, pars, stroke_index")
      .order("tee_name"),
    supabase.from("ulster_trip").select("id, reveal_at").single(),
  ])

  const ulsterPlayers = (ulsterPlayersRes.data ?? []) as any[]
  const memberIds = new Set(ulsterPlayers.map((p: any) => p.player_id))
  const availablePlayers = (allPlayersRes.data ?? []).filter((p: any) => !memberIds.has(p.id))

  const courses = (coursesRes.data ?? []).map((c: any) => ({
    ...c,
    tees: (teesRes.data ?? []).filter((t: any) => t.course_id === c.id),
  }))

  return (
    <UlsterSettingsClient
      ulsterPlayers={ulsterPlayers}
      availablePlayers={availablePlayers}
      courses={courses}
      trip={tripRes.data as any}
      isDev={isDev}
    />
  )
}
