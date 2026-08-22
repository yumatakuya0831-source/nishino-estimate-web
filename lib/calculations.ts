import type { Estimate, EstimateItem, PriceItem, WorkCategoryKey } from "@/types/domain";

export function getBaseUnitPrice(item: Pick<PriceItem, "materialCost" | "laborCost" | "expense">): number {
  return item.materialCost + item.laborCost;
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
    includeMaterialCost: true,
    includeLaborCost: true,
    expense: priceItem.expense,
    unitPrice,
    amount: unitPrice,
    memo: priceItem.note,
    sortOrder,
  };
}

export function recalculateItem(item: EstimateItem, priceCoefficient: number): EstimateItem {
  const selectedCost = (item.includeMaterialCost ? item.materialCost : 0) + item.laborCost;
  const unitPrice = selectedCost * priceCoefficient;
  return {
    ...item,
    unitPrice,
    amount: item.quantity * unitPrice,
  };
}

export function isEstimateItemIncluded(item: EstimateItem): boolean {
  return item.includeMaterialCost || item.laborCost > 0 || item.expense > 0;
}

export function getCategoryTotal(estimate: Estimate, workCategoryId: WorkCategoryKey): number {
  return estimate.items
    .filter((item) => item.workCategoryId === workCategoryId)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function getDirectCost(estimate: Estimate): number {
  return estimate.items.reduce((sum, item) => sum + item.amount, 0);
}

export function getLaborCostTotal(estimate: Estimate): number {
  return Math.round(estimate.items.reduce(
    (sum, item) =>
      sum +
      item.quantity * item.laborCost * estimate.priceCoefficientSnapshot,
    0,
  ));
}

export function getOverhead(estimate: Estimate): number {
  return Math.round(estimate.items.reduce(
    (sum, item) =>
      sum +
      item.quantity * item.expense * estimate.priceCoefficientSnapshot,
    0,
  ));
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
