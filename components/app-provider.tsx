"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppData } from "@/lib/store";
import { loadData, resetData, saveData } from "@/lib/store";

type AppContextValue = {
  data: AppData;
  setData: (updater: AppData | ((current: AppData) => AppData)) => void;
  reset: () => void;
  isAdmin: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const setData = (updater: AppData | ((current: AppData) => AppData)) => {
    setDataState((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId);

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      setData,
      reset: () => setDataState(resetData()),
      isAdmin: activeProfile?.role === "admin",
    }),
    [activeProfile?.role, data],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppProvider");
  }
  return context;
}
