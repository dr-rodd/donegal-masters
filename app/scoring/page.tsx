import Link from "next/link"
import { supabase } from "@/lib/supabase"
import CoursePortalClient from "./CoursePortalClient"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const [{ data: courses }, { count: totalPlayers }] = await Promise.all([
    supabase.from("courses").select("id, name"),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("is_composite", false),
  ])

  const courseIds: Record<string, string> = {}
  for (const c of courses ?? []) {
    courseIds[c.name] = c.id
  }

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors"
          >
            ← Home
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-lg text-white tracking-wide">
            Scoring
          </h1>
          <div className="w-[60px]" />
        </div>
      </div>
      <div className="max-w-lg mx-auto">
        <p className="text-white/35 text-xs tracking-[0.2em] uppercase px-4 pt-5 pb-1">
          Select a course
        </p>
        <CoursePortalClient courseIds={courseIds} totalPlayers={totalPlayers ?? 0} />
      </div>
    </div>
  )
}
