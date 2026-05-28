"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { BookOpenCheck, LibraryBig, LogOut, Sparkles } from "lucide-react";

const links = [
  { href: "/workshop-generator", label: "Workshop Generator", icon: Sparkles },
  { href: "/workshop-generator/commons", label: "Workshop Commons", icon: LibraryBig }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignInRoute = pathname.startsWith("/sign-in");

  if (isSignInRoute) {
    return <main>{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BookOpenCheck size={24} />
          </span>
          <span>
            <span className="brand-title">Workshop Generator</span>
            <span className="brand-subtitle">Machinists Institute</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`nav-link ${active ? "active" : ""}`}>
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          className="btn ghost"
          style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
