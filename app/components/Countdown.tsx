"use client";

import { useEffect, useState } from "react";

// 16 April 2026, 1pm Irish Standard Time (UTC+1)
const TARGET = new Date("2026-04-16T12:00:00Z");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft | null {
  const diff = TARGET.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

// ── Static shell ──────────────────────────────────────────────────────────────
// Rendered on the server AND by the client before hydration completes.
// Must be structurally identical on both sides — no Date.now(), no window.
// Layout matches the pre-expiry countdown so there is no shift on mount.
function StaticShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center w-full">

      {/* Timer block — always visible in shell so server/client HTML is identical */}
      <div className="grid w-full" style={{ gridTemplateRows: "1fr" }}>
        <div className="overflow-hidden flex flex-col items-center">

          <div className="flex items-center gap-4 mb-2">
            <div className="h-px w-16 bg-gold/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
            <div className="h-px w-16 bg-gold/40" />
          </div>

          {/* Fixed-height placeholder — matches digit block height to prevent CLS */}
          <div className="h-[84px]" />

          <div className="mt-2" />
        </div>
      </div>

      {/* Divider always above nav */}
      <div className="flex items-center gap-4 mb-3">
        <div className="h-px w-16 bg-gold/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
        <div className="h-px w-16 bg-gold/40" />
      </div>

      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Countdown({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted]     = useState(false);
  const [timeLeft, setTimeLeft]   = useState<TimeLeft | null>(null);
  const [timerGone, setTimerGone] = useState(false);

  // Initialise + start ticker.
  // React 18 batches both setState calls here into one re-render, so when the
  // countdown is already expired setMounted(true) + setTimerGone(true) resolve
  // together — the shell is never briefly shown with the timer block visible.
  useEffect(() => {
    setMounted(true);
    const initial = getTimeLeft();
    if (!initial) {
      setTimerGone(true);
      return;
    }
    setTimeLeft(initial);
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  // When ticker reaches zero, animate collapse then remove from DOM
  useEffect(() => {
    if (!mounted || timerGone || timeLeft !== null) return;
    const t = setTimeout(() => setTimerGone(true), 700);
    return () => clearTimeout(t);
  }, [timeLeft, mounted, timerGone]);

  // ── Before hydration: return the static shell so server HTML == client HTML ──
  if (!mounted) return <StaticShell>{children}</StaticShell>;

  // ── After mount: full dynamic rendering ──────────────────────────────────────
  const collapsing = !timeLeft && !timerGone; // mounted is always true here

  return (
    <div className="flex flex-col items-center w-full">

      {/* Collapsible timer block — absent once timerGone */}
      {!timerGone && (
        <div
          className="grid w-full"
          style={{
            gridTemplateRows: collapsing ? "0fr" : "1fr",
            transition: "grid-template-rows 700ms ease-in-out",
          }}
        >
          <div className="overflow-hidden flex flex-col items-center">

            <div className="flex items-center gap-4 mb-2">
              <div className="h-px w-16 bg-gold/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
              <div className="h-px w-16 bg-gold/40" />
            </div>

            {timeLeft ? (
              <div className="flex gap-5 sm:gap-8 bg-black/40 px-5 py-4 backdrop-blur-sm">
                {[
                  { label: "Days",    value: timeLeft.days },
                  { label: "Hours",   value: timeLeft.hours },
                  { label: "Minutes", value: timeLeft.minutes },
                  { label: "Seconds", value: timeLeft.seconds },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <span
                      className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-bold tabular-nums"
                      style={{ color: "#C9A84C", textShadow: "0 0 30px rgba(201,168,76,0.5), 0 2px 4px rgba(0,0,0,1)" }}
                    >
                      {String(value).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] tracking-[0.25em] uppercase text-white/70 font-light">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-2" />
          </div>
        </div>
      )}

      {/* Divider always present above nav */}
      <div className="flex items-center gap-4 mb-3">
        <div className="h-px w-16 bg-gold/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-gold/60" />
        <div className="h-px w-16 bg-gold/40" />
      </div>

      {/* Nav buttons — always in DOM */}
      {children}
    </div>
  );
}
