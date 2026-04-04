import Link from "next/link"
import { supabase } from "@/lib/supabase"
import ScoringClient from "../ScoringClient"

export const dynamic = "force-dynamic"

const SLUG_TO_COURSE: Record<string, string> = {
  "old-tom-morris":   "Old Tom Morris",
  "st-patricks-links": "St Patrick Links",
  "sandy-hills":      "Sandy Hills",
}

export default async function CourseDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const courseName = SLUG_TO_COURSE[slug]

  if (!courseName) {
    return (
      <div className="min-h-screen bg-[#071210] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-white/50 text-sm">Course not found</p>
          <Link href="/scoring" className="text-[#C9A84C] text-sm underline">
            Back to courses
          </Link>
        </div>
      </div>
    )
  }

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
      .eq("status", "active"),
  ])

  // Find active live round for this course
  const courseRounds = (liveRoundsRes.data ?? []).filter(
    (lr: any) => lr.courses?.name === courseName
  )
  const activeLiveRound = courseRounds[0] ?? null

  return (
    <div>
      <div className="px-4 pt-4 pb-1">
        <Link
          href="/scoring"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          ← Courses
        </Link>
      </div>
      <ScoringClient
        players={(playersRes.data ?? []) as any}
        rounds={(roundsRes.data ?? []) as any}
        holes={(holesRes.data ?? []) as any}
        tees={(teesRes.data ?? []) as any}
        roundHandicaps={hcpsRes.data ?? []}
        activeLiveRound={activeLiveRound as any}
      />
    </div>
  )
}
