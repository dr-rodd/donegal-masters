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

export default function Countdown() {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(getTimeLeft());
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pre-mount: empty placeholder prevents hydration mismatch
  if (!mounted) {
    return <div className="h-16" />;
  }

  // Tournament has started
  if (!timeLeft) {
    return (
      <p className="text-gold text-xl tracking-widest uppercase [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
        Tournament Underway
      </p>
    );
  }

  const units = [
    { label: "Days",    value: timeLeft.days },
    { label: "Hours",   value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-8 sm:gap-12 bg-black/40 px-8 py-6 backdrop-blur-sm">
      {units.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <span
            className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl font-bold tabular-nums"
            style={{ color: "#C9A84C", textShadow: "0 0 30px rgba(201,168,76,0.5), 0 2px 4px rgba(0,0,0,1)" }}
          >
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-xs tracking-[0.25em] uppercase text-white font-light">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
