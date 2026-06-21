import type { PriceImportDiff, PriceItem } from "@/types/domain";

const numberPattern = /[-+]?\d[\d,]*/g;

function toNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  return Number(value.replaceAll(",", ""));
}

export function parsePriceRowsFromText(text: string, year: number): PriceItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const parsed: PriceItem[] = [];

  for (const line of lines) {
    const numbers = line.match(numberPattern);
    if (!numbers || numbers.length < 5) {
      continue;
    }

    const [pageNo, materialUnitPrice, materialCost, laborCost, expense, compositeUnitPrice] = numbers.map(toNumber);
    const textPart = line.replace(numberPattern, " ").replace(/\s+/g, " ").trim();
    const parts = textPart.split(" ");
    const name = parts[0] || "名称未取得";
    const specification = parts.slice(1, 3).join(" ");

    parsed.push({
      id: crypto.randomUUID(),
      year,
      pageNo,
      name,
      specification,
      note: "",
      construction: "",
      unit: "式",
      materialUnitPrice,
      materialCost,
      laborCost,
      expense,
      compositeUnitPrice: compositeUnitPrice || materialCost + laborCost + expense,
      active: true,
    });
  }

  return parsed;
}

export function createPriceDiffs(currentItems: PriceItem[], parsedItems: PriceItem[]): PriceImportDiff[] {
  return parsedItems.map((parsed) => {
    const current = currentItems.find(
      (item) =>
        item.year === parsed.year &&
        item.name === parsed.name &&
        item.specification === parsed.specification &&
        item.construction === parsed.construction,
    );

    if (!current) {
      return {
        id: crypto.randomUUID(),
        diffType: parsed.name === "名称未取得" ? "uncertain" : "add",
        parsedData: parsed,
        selected: parsed.name !== "名称未取得",
        confidence: parsed.name === "名称未取得" ? 0.4 : 0.75,
        reason: parsed.name === "名称未取得" ? "名称の抽出に失敗した可能性があります。" : "既存マスタに一致する項目がありません。",
      };
    }

    const changed =
      current.materialCost !== parsed.materialCost ||
      current.laborCost !== parsed.laborCost ||
      current.expense !== parsed.expense ||
      current.compositeUnitPrice !== parsed.compositeUnitPrice;

    return {
      id: crypto.randomUUID(),
      diffType: changed ? "update" : "uncertain",
      currentItemId: current.id,
      parsedData: { ...parsed, id: current.id },
      selected: changed,
      confidence: changed ? 0.9 : 0.55,
      reason: changed ? "単価差分があります。" : "既存マスタと同値、または確認不要の可能性があります。",
    };
  });
}
