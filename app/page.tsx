import Link from "next/link";
import Countdown from "./components/Countdown";

export default function Home() {
  return (
    <main
      className="relative min-h-dvh flex flex-col items-center justify-center px-6 pt-10 pb-10"
      style={{
        backgroundImage: "url(/rosapenna.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/75 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center w-full">

        {/* Top ornament */}
        <div className="flex items-center gap-4 mb-5">
          <div className="h-px w-14 bg-gold opacity-70" />
          <span className="text-gold text-xs tracking-[0.3em] uppercase">Est. 2023</span>
          <div className="h-px w-14 bg-gold opacity-70" />
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight mb-2 [text-shadow:0_2px_20px_rgba(0,0,0,0.9),0_4px_40px_rgba(0,0,0,0.7)]">
          The Donegal Masters
        </h1>

        {/* Subtitle */}
        <p className="text-white/80 text-sm sm:text-lg tracking-[0.3em] uppercase mb-1 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          16 – 18 April 2026
        </p>
        <p className="text-white/60 text-xs tracking-[0.2em] uppercase mb-6 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
          Rosapenna Hotel &amp; Golf Resort, Co. Donegal
        </p>

        {/* Countdown collapses when expired; nav always in DOM below it */}
        <Countdown>
          <nav className="flex flex-col gap-3">
            <Link
              href="/teams"
              className="w-[312px] text-center py-[18px] border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
            >
              Team Selection
            </Link>
            <Link
              href="/score-entry"
              className="w-[312px] text-center py-[18px] border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
            >
              Score Entry
            </Link>
            <Link
              href="/leaderboard"
              className="w-[312px] text-center py-[18px] border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
            >
              Leaderboard
            </Link>
            <Link
              href="/tee-times"
              className="w-[312px] text-center py-[18px] border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
            >
              Tee Times
            </Link>
          </nav>
        </Countdown>

      </div>
    </main>
  );
}
