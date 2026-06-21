import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ニシノ設備 見積作成",
  description: "設備工事向け見積作成Webアプリ",
};

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/estimates", label: "見積一覧" },
  { href: "/estimates/new", label: "新規見積" },
  { href: "/masters", label: "マスタ管理" },
  { href: "/price-imports", label: "単価PDF取込" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <aside className="sidebar no-print">
            <div className="brand">
              ニシノ設備
              <br />
              見積作成システム
            </div>
            <nav className="nav">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="content">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}
