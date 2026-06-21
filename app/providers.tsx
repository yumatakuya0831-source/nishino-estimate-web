"use client";

import { AppProvider } from "@/components/app-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
