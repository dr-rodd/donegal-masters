import Link from "next/link"
import { supabase } from "@/lib/supabase"

const FORMAT_LABELS: Record<string, string> = {
  "4bbb_matchplay": "4BBB Matchplay",
  "strokeplay_cumulative": "Strokeplay",
  "bbb_agg": "BBB Agg",
}

const STATUS_ORDER = ["live", "pending", "complete"] as const
const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  pending: "Upcoming",
  complete: "Complete",
}

export default async function MatchesPage() {
  const { data: matches } = await supabase
    .from("ulster_matches")
    .select(`
      id, name, match_date, format, status,
      team_a_players, team_b_players,
      ulster_courses(name),
      ulster_course_tees(tee_name)
    `)
    .order("match_date")

  const allIds = new Set<string>()
  ;(matches ?? []).forEach((m: any) => {
    m.team_a_players.forEach((id: string) => allIds.add(id))
    m.team_b_players.forEach((id: string) => allIds.add(id))
  })

  const { data: ulsterPlayers } = allIds.size
    ? await supabase
        .from("ulster_players")
        .select("id, players(name)")
        .in("id", Array.from(allIds))
    : { data: [] }

  const playerMap = new Map<string, string>()
  ;(ulsterPlayers ?? []).forEach((up: any) => {
    playerMap.set(up.id, up.players?.name ?? "?")
  })

  const grouped: Record<string, any[]> = { live: [], pending: [], complete: [] }
  ;(matches ?? []).forEach((m: any) => {
    grouped[m.status]?.push(m)
  })

  const hasAny = Object.values(grouped).some(g => g.length > 0)
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="font-[family-name:var(--font-playfair)] text-white/25 text-base tracking-wide">
          No matches yet
        </p>
        <p className="text-white/20 text-sm text-center max-w-xs">
          Create matches in the Setup tab.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {STATUS_ORDER.map(status => {
        const list = grouped[status]
        if (!list.length) return null
        return (
          <section key={status}>
            <div className="flex items-center gap-2 mb-3">
              {status === "live" && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              <h2 className="text-xs tracking-[0.2em] uppercase text-white/40">
                {STATUS_LABELS[status]}
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {list.map((m: any) => {
                const aNames = m.team_a_players.map((id: string) => playerMap.get(id) ?? "?")
                const bNames = m.team_b_players.map((id: string) => playerMap.get(id) ?? "?")
                const courseName = m.ulster_courses?.name ?? ""
                const shortCourse = courseName.includes("Portstewart")
                  ? "Portstewart"
                  : courseName.includes("Portrush")
                  ? "Portrush"
                  : courseName
                return (
                  <Link
                    key={m.id}
                    href={`/ulster/matches/${m.id}`}
                    className="block bg-[#0f2418] border border-[#1e3d28] rounded-xl p-4 hover:border-[#C9A84C]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-[family-name:var(--font-playfair)] text-white text-base leading-tight">
                          {m.name ?? "Match"}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {m.match_date} · {shortCourse}
                          {m.ulster_course_tees?.tee_name
                            ? ` · ${m.ulster_course_tees.tee_name}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-[#1e3d28] text-[#C9A84C] border border-[#C9A84C]/20 mt-0.5">
                        {FORMAT_LABELS[m.format] ?? m.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex flex-wrap gap-1">
                        {aNames.map((n: string) => (
                          <span
                            key={n}
                            className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-[#60a5fa] border border-[#60a5fa]/20"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <span className="text-white/20 text-xs">vs</span>
                      <div className="flex-1 flex flex-wrap gap-1 justify-end">
                        {bNames.map((n: string) => (
                          <span
                            key={n}
                            className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-[#f87171] border border-[#f87171]/20"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
