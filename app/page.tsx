import Link from "next/link";
import Countdown from "./components/Countdown";
import SettingsButton from "./components/SettingsButton";

export default function Home() {
  return (
    <main
      className="relative min-h-dvh flex flex-col items-center justify-center pt-5 pb-5"
      style={{
        backgroundImage: "url(/rosapenna.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />

      <SettingsButton />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center w-full">

        {/* Est. ornament */}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px w-14 bg-gold opacity-70" />
          <span className="text-gold text-xs tracking-[0.3em] uppercase">Est. 2023</span>
          <div className="h-px w-14 bg-gold opacity-70" />
        </div>

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Retro_donegal_masters_logo.png"
          alt="The Donegal Masters"
          style={{ width: "90vw", marginLeft: "auto", marginRight: "auto", height: "auto", display: "block", filter: "brightness(0) saturate(100%) invert(74%) sepia(27%) saturate(739%) hue-rotate(5deg) brightness(95%) contrast(95%)" }}
        />

        {/* Subtitle */}
        <p className="text-white/80 text-sm sm:text-lg tracking-[0.3em] uppercase mb-0 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          16 – 18 April 2026
        </p>
        <p className="text-white/60 text-xs tracking-[0.2em] uppercase mb-3 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
          Rosapenna Hotel &amp; Golf Resort, Co. Donegal
        </p>

        {/* Countdown collapses when expired; nav always in DOM below it */}
        <Countdown>
          <nav className="flex flex-col gap-3 w-[300px]">
            {([
              { href: "/teams",       label: "Team Selection" },
              { href: "/tee-times",   label: "Tee Times"      },
              { href: "/scoring",     label: "Scoring"        },
              { href: "/leaderboard", label: "Leaderboard"    },
            ] as const).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-center w-full py-4 px-6 bg-[#0a1a0e]/65 border border-[#C9A84C]/40 text-white text-[15px] tracking-widest uppercase rounded-xl font-[family-name:var(--font-playfair)] hover:bg-[#0a1a0e]/85 hover:border-[#C9A84C] transition-all duration-300"
                style={{ boxShadow: "inset 0 1px 0 rgba(201,168,76,0.10), 0 2px 16px rgba(0,0,0,0.35)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </Countdown>

      </div>
    </main>
  );
}
