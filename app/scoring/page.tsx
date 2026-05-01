import { supabase } from "@/lib/supabase"
import { getCurrentYear } from "@/lib/getCurrentYear"
import CoursePortalClient from "./CoursePortalClient"
import BackButton from "@/app/components/BackButton"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const currentYear = await getCurrentYear()
  const [{ data: courses }, { count: totalPlayers }] = await Promise.all([
    supabase.from("courses").select("id, name"),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("is_composite", false).eq("edition_year", currentYear),
  ])

  // Key by slug using candidate name matching — avoids fragile exact-name lookups
  const SLUG_NAMES: Record<string, string[]> = {
    "old-tom-morris":    ["Old Tom Morris"],
    "st-patricks-links": ["St Patrick Links", "St Patricks Links", "St Patrick's Links"],
    "sandy-hills":       ["Sandy Hills", "Sandy Hills Links"],
  }
  const courseIds: Record<string, string> = {}
  for (const [slug, candidates] of Object.entries(SLUG_NAMES)) {
    const match = (courses ?? []).find(c =>
      candidates.some(n => c.name.toLowerCase() === n.toLowerCase())
    )
    if (match) courseIds[slug] = match.id
  }

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="font-[family-name:var(--font-playfair)] text-lg text-white tracking-wide">
            Scoring
          </h1>
          <div className="w-[60px]" />
        </div>
      </div>
      <div className="max-w-lg mx-auto">
        <p className="text-white/35 text-xs tracking-[0.2em] uppercase px-4 pt-5 pb-1">
          Live Sessions
        </p>
        <CoursePortalClient courseIds={courseIds} totalPlayers={totalPlayers ?? 0} currentYear={currentYear} />
      </div>
    </div>
  )
}
