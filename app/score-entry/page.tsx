import { supabase } from "@/lib/supabase"
import ScoreEntryForm from "./ScoreEntryForm"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ScoreEntryPage() {
  const [playersRes, coursesRes] = await Promise.all([
    supabase.from("players").select("id, name, role, handicap, gender").order("name"),
    supabase.from("courses").select("id, name").order("name").then(res => {
      if (res.data) {
        const order = ["Sandy Hills", "St Patricks Links", "Old Tom Morris"]
        res.data.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
      }
      return res
    }),
  ])
  console.log("[score-entry] players:", playersRes.data, "error:", playersRes.error)
  console.log("[score-entry] courses:", coursesRes.data, "error:", coursesRes.error)
  const players = playersRes.data
  const courses = coursesRes.data

  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-[#1e3d28] sticky top-0 z-20 bg-[#0a1a0e]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase hover:text-white transition-colors">
            ← Home
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-lg text-white tracking-wide">
            Score Entry
          </h1>
          <Link href="/leaderboard" className="text-white/40 text-xs tracking-[0.2em] uppercase hover:text-[#C9A84C] transition-colors">
            Leaderboard →
          </Link>
        </div>
      </div>

      <ScoreEntryForm
        players={players ?? []}
        courses={courses ?? []}
      />
    </div>
  )
}
