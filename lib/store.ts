"use client";

import type {
  CompanySettings,
  Customer,
  Estimate,
  PriceImportBatch,
  PriceItem,
  Profile,
  WorkCategory,
} from "@/types/domain";
import {
  companySettings,
  createInitialEstimate,
  customers,
  priceItems,
  profiles,
  workCategories,
} from "@/lib/initial-data";

export type AppData = {
  activeProfileId: string;
  profiles: Profile[];
  customers: Customer[];
  priceItems: PriceItem[];
  workCategories: WorkCategory[];
  companySettings: CompanySettings;
  estimates: Estimate[];
  priceImportBatches: PriceImportBatch[];
};

const storageKey = "nishino-estimate-web-data-v1";

export function createDefaultData(): AppData {
  return {
    activeProfileId: profiles[0].id,
    profiles,
    customers,
    priceItems,
    workCategories,
    companySettings,
    estimates: [createInitialEstimate()],
    priceImportBatches: [],
  };
}

export function loadData(): AppData {
  if (typeof window === "undefined") {
    return createDefaultData();
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    const data = createDefaultData();
    saveData(data);
    return data;
  }
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    const data = createDefaultData();
    saveData(data);
    return data;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function resetData(): AppData {
  const data = createDefaultData();
  saveData(data);
  return data;
}
