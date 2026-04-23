import { supabase } from "@/lib/supabase"

let cachedYear: number | null = null
let cacheSetAt: number | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function getCurrentYear(): Promise<number> {
  const now = Date.now()
  if (cachedYear !== null && cacheSetAt !== null && now - cacheSetAt < CACHE_TTL_MS) {
    return cachedYear
  }

  const { data, error } = await supabase
    .from("tournament_config")
    .select("current_year")
    .order("id", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(
      `[getCurrentYear] Failed to read tournament_config.current_year: ${error?.message ?? "no rows returned"}. ` +
      `Cannot proceed — a silent year default would corrupt all data operations.`
    )
  }

  cachedYear = data.current_year
  cacheSetAt = now
  return cachedYear
}

export function invalidateCurrentYearCache(): void {
  cachedYear = null
  cacheSetAt = null
}
