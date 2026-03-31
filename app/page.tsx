import Image from "next/image";
import Link from "next/link";
import Countdown from "./components/Countdown";

export default function Home() {
  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden">

      {/* Background image */}
      <Image
        src="/rosapenna.jpg"
        alt="Rosapenna Golf Resort"
        fill
        priority
        className="object-cover object-center"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/75" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">

        {/* Top ornament */}
        <div className="flex items-center gap-4 mb-10">
          <div className="h-px w-16 bg-gold opacity-70" />
          <span className="text-gold text-sm tracking-[0.3em] uppercase">Est. 2023</span>
          <div className="h-px w-16 bg-gold opacity-70" />
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-7xl font-bold text-white tracking-tight leading-tight mb-4 [text-shadow:0_2px_20px_rgba(0,0,0,0.9),0_4px_40px_rgba(0,0,0,0.7)]">
          The Donegal Masters
        </h1>

        {/* Subtitle */}
        <p className="text-white/80 text-base sm:text-xl tracking-[0.3em] uppercase mb-2 [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          16 – 18 April 2026
        </p>
        <p className="text-white/70 text-sm tracking-[0.25em] uppercase mb-12 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
          Rosapenna Hotel &amp; Golf Resort, Co. Donegal
        </p>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-12">
          <div className="h-px w-24 bg-gold/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
          <div className="h-px w-24 bg-gold/40" />
        </div>

        {/* Countdown */}
        <Countdown />

        {/* Divider */}
        <div className="flex items-center gap-4 mt-12 mb-12">
          <div className="h-px w-24 bg-gold/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
          <div className="h-px w-24 bg-gold/40" />
        </div>

        {/* Nav links */}
        <nav className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/teams"
            className="w-52 text-center py-3 border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
          >
            Team Selection
          </Link>
          <Link
            href="/score-entry"
            className="w-52 text-center py-3 border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
          >
            Score Entry
          </Link>
          <Link
            href="/leaderboard"
            className="w-52 text-center py-3 border border-white/30 text-white/70 text-sm tracking-[0.25em] uppercase hover:border-gold hover:text-gold transition-colors duration-300"
          >
            Leaderboard
          </Link>
        </nav>

      </div>
    </main>
  );
}
