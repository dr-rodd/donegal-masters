"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/ulster/matches",  label: "Matches"  },
  { href: "/ulster/setup",    label: "Setup"    },
  { href: "/ulster/settings", label: "Settings" },
] as const

export default function UlsterTabNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[#1e3d28] bg-[#0a1a0e]">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex gap-2 py-2">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center justify-center min-h-[44px] px-4 rounded-full
                  text-[13px] tracking-widest uppercase font-[family-name:var(--font-playfair)]
                  transition-colors duration-200
                  ${active
                    ? "bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30"
                    : "text-white/45 hover:text-white/65 border border-transparent"
                  }
                `}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
