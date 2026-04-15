import { supabase } from "@/lib/supabase"
import TeamsClient from "./TeamsClient"
import BackButton from "@/app/components/BackButton"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const [{ data: teams }, { data: players }, { data: rounds }, { data: lockSetting }] =
    await Promise.all([
      supabase.from("teams").select("id, name, color").order("name"),
      supabase.from("players").select("id, name, role, handicap, team_id, gender, is_composite").order("name"),
      supabase.from("rounds").select("status"),
      supabase.from("settings").select("value").eq("key", "teams_locked").maybeSingle(),
    ])

  const hasActiveRound = rounds?.some((r: any) => r.status === "active") ?? false
  const initialLocked  = lockSetting?.value === true

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="font-[family-name:var(--font-playfair)] text-xl text-white tracking-wide">
            Teams
          </h1>
          <div className="w-11" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <TeamsClient
          teams={(teams ?? []) as any}
          players={(players ?? []) as any}
          initialLocked={initialLocked}
          isActive={hasActiveRound}
        />
      </div>
    </div>
  )
}
