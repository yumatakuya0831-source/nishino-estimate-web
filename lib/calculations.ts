import type { Estimate, EstimateItem, PriceItem, WorkCategoryKey } from "@/types/domain";

export function roundDownToHundreds(value: number): number {
  return Math.floor(value / 100) * 100;
}

export function getBaseUnitPrice(item: Pick<PriceItem, "materialCost" | "laborCost" | "expense">): number {
  return item.materialCost + item.laborCost + item.expense;
}

export function createEstimateItemFromPriceItem(
  priceItem: PriceItem,
  workCategoryId: WorkCategoryKey,
  priceCoefficient: number,
  sortOrder: number,
): EstimateItem {
  const unitPrice = getBaseUnitPrice(priceItem) * priceCoefficient;
  return {
    id: crypto.randomUUID(),
    workCategoryId,
    priceItemId: priceItem.id,
    name: priceItem.name,
    specification: priceItem.specification,
    quantity: 1,
    unit: priceItem.unit,
    materialCost: priceItem.materialCost,
    laborCost: priceItem.laborCost,
    expense: priceItem.expense,
    unitPrice,
    amount: unitPrice,
    memo: priceItem.note,
    sortOrder,
  };
}

export function recalculateItem(item: EstimateItem, priceCoefficient: number): EstimateItem {
  const unitPrice = (item.materialCost + item.laborCost + item.expense) * priceCoefficient;
  return {
    ...item,
    unitPrice,
    amount: item.quantity * unitPrice,
  };
}

export function getCategoryTotal(estimate: Estimate, workCategoryId: WorkCategoryKey): number {
  return estimate.items
    .filter((item) => item.workCategoryId === workCategoryId)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function getDirectCost(estimate: Estimate): number {
  return estimate.items.reduce((sum, item) => sum + item.amount, 0);
}

export function getOverhead(estimate: Estimate): number {
  return roundDownToHundreds(getDirectCost(estimate) * estimate.expenseRate);
}

export function getGrandTotal(estimate: Estimate): number {
  return getDirectCost(estimate) + getOverhead(estimate);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function generateEstimateNumber(pattern: string, sequence: number, now = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return pattern.replaceAll("YYYY", year).replaceAll("MM", month).replaceAll("0001", seq);
}
