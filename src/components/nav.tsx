"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarBlank, ListBullets, MagnifyingGlass, Scissors } from "@phosphor-icons/react";

const LINKS = [
  { href: "/", label: "Meetings", icon: ListBullets, match: (p: string) => p === "/" || p.startsWith("/meetings") },
  { href: "/search", label: "Search", icon: MagnifyingGlass, match: (p: string) => p.startsWith("/search") },
  { href: "/clips", label: "Clips", icon: Scissors, match: (p: string) => p.startsWith("/clips") },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank, match: (p: string) => p.startsWith("/calendar") },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="brand">
        Fanth<i>o</i>m
      </Link>
      <div className="ws">
        <div className="ws-name">Demo workspace</div>
        <div className="ws-note">Public demo, no sign-in</div>
      </div>
      <ul>
        {LINKS.map(({ href, label, icon: Icon, match }) => (
          <li key={href}>
            <Link href={href} className={match(path) ? "on" : undefined}>
              <Icon size={16} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="nav-foot">
        <b>Recording is stubbed.</b> These are real meetings, transcribed and summarised ahead of
        time, so the demo works without a bot joining a call. <Link href="/calendar">How capture would work</Link>
      </div>
    </nav>
  );
}
