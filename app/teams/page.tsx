import { supabase } from "@/lib/supabase"
import Link from "next/link"
import TeamsClient from "./TeamsClient"
import Poller from "@/app/components/Poller"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const [{ data: teams }, { data: players }, { data: rounds }] = await Promise.all([
    supabase.from("teams").select("id, name, color").order("name"),
    supabase.from("players").select("id, name, role, handicap, team_id, gender").order("name"),
    supabase.from("rounds").select("status"),
  ])
  const hasActiveRound = rounds?.some((r: any) => r.status === "active") ?? false

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">
            ← Home
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-xl text-white tracking-wide">
            Teams
          </h1>
          <Link href="/leaderboard" className="text-white/40 text-xs tracking-[0.2em] uppercase hover:text-[#C9A84C] transition-colors">
            Leaderboard →
          </Link>
        </div>
      </div>

      <Poller isActive={hasActiveRound} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-white/30 text-xs tracking-widest uppercase text-center mb-8">
          Drag players between teams · Click a team name to edit
        </p>
        <TeamsClient
          teams={(teams ?? []) as any}
          players={(players ?? []) as any}
        />
      </div>
    </div>
  )
}
