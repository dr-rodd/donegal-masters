import Link from "next/link"
import BackButton from "@/app/components/BackButton"

export default function UlsterHome() {
  return (
    <main
      className="relative min-h-dvh flex flex-col items-center justify-center pt-5 pb-5"
      style={{
        backgroundImage: "url(/ports-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center 40%",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />

      <div className="absolute top-4 left-4 z-20">
        <BackButton href="/" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center w-full">

        {/* Ornament */}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px w-14 bg-[#C9A84C] opacity-70" />
          <span className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase">Est. 2024</span>
          <div className="h-px w-14 bg-[#C9A84C] opacity-70" />
        </div>

        {/* Title */}
        <h1
          className="font-[family-name:var(--font-playfair)] text-[#C9A84C] tracking-[0.12em] uppercase mb-1"
          style={{ fontSize: "clamp(2rem, 8vw, 3.2rem)", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
        >
          The Ports
        </h1>

        {/* Subtitle */}
        <p className="text-white/80 text-sm sm:text-lg tracking-[0.3em] uppercase mb-0 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          19 – 20 April 2026
        </p>
        <p className="text-white/60 text-xs tracking-[0.2em] uppercase mb-8 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
          Portstewart &amp; Royal Portrush, Co. Antrim
        </p>

        {/* Nav */}
        <nav className="flex flex-col gap-3 w-[300px]">
          {([
            { href: "/ulster/setup",    label: "Teams"       },
            { href: "/ulster/matches",  label: "Scoring"     },
            { href: "/ulster/matches",  label: "Leaderboard" },
          ] as const).map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center justify-center w-full py-4 px-6 bg-[#0a1a0e]/65 border border-[#C9A84C]/40 text-white text-[15px] tracking-widest uppercase rounded-xl font-[family-name:var(--font-playfair)] hover:bg-[#0a1a0e]/85 hover:border-[#C9A84C] transition-all duration-300"
              style={{ boxShadow: "inset 0 1px 0 rgba(201,168,76,0.10), 0 2px 16px rgba(0,0,0,0.35)" }}
            >
              {label}
            </Link>
          ))}
        </nav>

      </div>
    </main>
  )
}
