"use client";

import Link from "next/link";
import { useAppData } from "@/components/app-provider";

const navItems = [
  { href: "/", label: "ホーム", adminOnly: false },
  { href: "/estimates", label: "見積一覧", adminOnly: false },
  { href: "/estimates/new", label: "新規見積", adminOnly: false },
  { href: "/masters", label: "マスタ管理", adminOnly: true },
  { href: "/price-imports", label: "単価取込", adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAppData();
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="brand">
          ニシノ設備
          <br />
          見積作成システム
        </div>
        <nav className="nav">
          {visibleNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
