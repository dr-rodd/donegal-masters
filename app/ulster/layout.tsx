import UlsterTabNav from "./UlsterTabNav"

export default function UlsterLayout({ children }: { children: React.ReactNode }) {
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
