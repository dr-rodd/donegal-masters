"use server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

function revalidateUlster() {
  revalidatePath("/ulster/settings")
  revalidatePath("/ulster")
  revalidatePath("/")
}

// ── Players ─────────────────────────────────────────────────

export async function updateUlsterPlayerHandicap(
  id: string,
  handicap_index: number,
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_players")
    .update({ handicap_index })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/ulster/settings")
  return {}
}

export async function removeUlsterPlayer(id: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_players")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/ulster/settings")
  return {}
}

export async function addUlsterPlayer(
  player_id: string,
  handicap_index: number,
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_players")
    .insert({ player_id, handicap_index })
  if (error) return { error: error.message }
  revalidatePath("/ulster/settings")
  return {}
}

// ── Tees ────────────────────────────────────────────────────

export type TeePayload = {
  tee_name: string
  gender: string
  total_yards: number
  course_rating: number
  slope_rating: number
  par_front: number
  par_back: number
  par_total: number
  yardages: number[]
  pars: number[]
  stroke_index: number[]
}

export async function updateUlsterTee(
  id: string,
  data: TeePayload,
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_course_tees")
    .update(data)
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/ulster/settings")
  return {}
}

export async function addUlsterTee(
  course_id: string,
  data: TeePayload,
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_course_tees")
    .insert({ course_id, ...data })
  if (error) return { error: error.message }
  revalidatePath("/ulster/settings")
  return {}
}

// ── Dev ──────────────────────────────────────────────────────

export async function updateRevealAt(reveal_at: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("ulster_trip")
    .update({ reveal_at })
    .not("id", "is", null)
  if (error) return { error: error.message }
  revalidateUlster()
  return {}
}

export async function resetRevealAt(): Promise<{ error?: string }> {
  // 2026-04-19 15:00 IST = 14:00 UTC
  return updateRevealAt("2026-04-19T14:00:00Z")
}
