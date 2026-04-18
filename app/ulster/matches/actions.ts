"use server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

function revalidateMatch(id: string) {
  revalidatePath("/ulster/matches")
  revalidatePath(`/ulster/matches/${id}`)
}

export async function updateMatchStatus(
  id: string,
  status: "pending" | "live" | "complete"
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_matches")
    .update({ status })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidateMatch(id)
  return {}
}

export async function upsertUlsterScore(
  match_id: string,
  player_id: string,
  hole: number,
  gross: number | null
): Promise<{ error?: string }> {
  if (gross === null) {
    const { error } = await supabaseAdmin
      .from("ulster_scores")
      .delete()
      .eq("match_id", match_id)
      .eq("player_id", player_id)
      .eq("hole", hole)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabaseAdmin
      .from("ulster_scores")
      .upsert(
        { match_id, player_id, hole, gross },
        { onConflict: "match_id,player_id,hole" }
      )
    if (error) return { error: error.message }
  }
  revalidateMatch(match_id)
  return {}
}

export async function setConcededHole(
  match_id: string,
  hole: number,
  value: "a" | "b" | "halved" | null
): Promise<{ error?: string }> {
  const { data, error: fetchErr } = await supabaseAdmin
    .from("ulster_matches")
    .select("conceded_holes")
    .eq("id", match_id)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  const conceded = { ...(data.conceded_holes ?? {}) }
  if (value === null) {
    delete conceded[String(hole)]
  } else {
    conceded[String(hole)] = value
  }

  const { error } = await supabaseAdmin
    .from("ulster_matches")
    .update({ conceded_holes: conceded })
    .eq("id", match_id)
  if (error) return { error: error.message }
  revalidateMatch(match_id)
  return {}
}
