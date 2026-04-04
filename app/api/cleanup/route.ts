import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

// Hourly cleanup of stale live scoring data.
// Protected by CRON_SECRET env var — callers must pass:
//   Authorization: Bearer <CRON_SECRET>
//
// Set up a free external cron (e.g. cron-job.org) to hit this URL hourly,
// or add to vercel.json if deploying on Vercel:
//   { "crons": [{ "path": "/api/cleanup", "schedule": "0 * * * *" }] }
// (Vercel cron calls arrive with x-vercel-signature, not Bearer — see note below)

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // 1. Find (player_id, round_id) pairs whose last submitted_at is >2h ago
  const { data: staleSessions } = await supabaseAdmin
    .from("live_scores")
    .select("player_id, round_id, submitted_at")
    .eq("committed", false)

  const staleKeys = Object.values(
    (staleSessions ?? []).reduce<Record<string, { player_id: string; round_id: string; latest: string }>>(
      (acc, row) => {
        const key = `${row.player_id}:${row.round_id}`
        if (!acc[key] || row.submitted_at > acc[key].latest) {
          acc[key] = { player_id: row.player_id, round_id: row.round_id, latest: row.submitted_at }
        }
        return acc
      },
      {}
    )
  ).filter(s => s.latest < twoHoursAgo)

  // 2. Delete stale live_scores per (player_id, round_id)
  let deletedScores = 0
  for (const { player_id, round_id } of staleKeys) {
    const { count } = await supabaseAdmin
      .from("live_scores")
      .delete({ count: "exact" })
      .eq("player_id", player_id)
      .eq("round_id", round_id)
      .eq("committed", false)
    deletedScores += count ?? 0
  }

  // 3. Close active live_rounds with no recent scoring activity
  const { data: activeRounds } = await supabaseAdmin
    .from("live_rounds")
    .select("id, round_id, activated_at")
    .eq("status", "active")
    .lt("activated_at", twoHoursAgo)

  let closedRounds = 0
  for (const round of activeRounds ?? []) {
    const { data: recentScore } = await supabaseAdmin
      .from("live_scores")
      .select("id")
      .eq("round_id", round.round_id)
      .gte("submitted_at", twoHoursAgo)
      .limit(1)
      .maybeSingle()

    if (!recentScore) {
      await supabaseAdmin
        .from("live_rounds")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", round.id)
      closedRounds++
    }
  }

  return NextResponse.json({ ok: true, deletedScores, closedRounds })
}
