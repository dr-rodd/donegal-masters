import { supabase } from "@/lib/supabase"
import UlsterTabNav from "./UlsterTabNav"

async function getPortsRevealed(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("ulster_trip")
      .select("reveal_at")
      .single()
    if (!data?.reveal_at) return false
    return new Date(data.reveal_at) <= new Date()
  } catch {
    return false
  }
}

export default async function UlsterLayout({ children }: { children: React.ReactNode }) {
  const revealed = await getPortsRevealed()

  if (!revealed) {
    return (
      <div className="min-h-dvh bg-[#0a1a0e] flex items-center justify-center">
        <p className="text-white/35 text-sm tracking-[0.25em] uppercase font-[family-name:var(--font-playfair)]">
          Unlocks soon.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0a1a0e] text-white">
      <header className="border-b border-[#1e3d28]">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-white tracking-wide">
            Ports
          </h1>
          <p className="text-white/45 text-[11px] tracking-[0.2em] uppercase mt-1">
            Portstewart · Royal Portrush · 19–20 April 2026
          </p>
        </div>
      </header>

      <UlsterTabNav />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
