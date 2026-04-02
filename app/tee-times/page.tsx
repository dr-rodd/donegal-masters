import { supabase } from "@/lib/supabase"
import TeeTimesClient from "./TeeTimesClient"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function TeeTimesPage() {
  const [playersRes, teeTimesRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, role, team_id, teams(id, name, color)")
      .order("name"),
    supabase
      .from("tee_times")
      .select("day_number, group_number, player_id")
      .order("day_number")
      .order("group_number"),
  ])

  const players = playersRes.data
  const teeTimes = teeTimesRes.data

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white overflow-x-clip">
      {/* Header */}
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors"
          >
            ← Home
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-lg text-white tracking-wide">
            Tee Times
          </h1>
          <div className="w-[60px]" />
        </div>
      </div>

      <TeeTimesClient
        players={(players ?? []) as any}
        teeTimes={teeTimes ?? []}
      />
    </div>
  )
}
