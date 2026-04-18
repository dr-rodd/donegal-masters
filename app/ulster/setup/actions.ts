"use server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

function revalidateSetup() {
  revalidatePath("/ulster/setup")
  revalidatePath("/ulster/matches")
}

export type CreateMatchInput = {
  name: string
  match_date: string
  course_id: string
  tee_id: string
  format: "4bbb_matchplay" | "strokeplay_cumulative" | "bbb_agg"
  hcp_allowance: number
  agg_holes: number | null
  team_a_players: string[]
  team_b_players: string[]
}

export async function createMatch(
  input: CreateMatchInput,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from("ulster_matches")
    .insert({
      name: input.name.trim() || null,
      match_date: input.match_date,
      course_id: input.course_id,
      tee_id: input.tee_id,
      format: input.format,
      hcp_allowance: input.hcp_allowance,
      agg_holes: input.agg_holes,
      team_a_players: input.team_a_players,
      team_b_players: input.team_b_players,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidateSetup()
  return { id: data.id }
}

export async function deleteMatch(id: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_matches")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  revalidateSetup()
  return {}
}
