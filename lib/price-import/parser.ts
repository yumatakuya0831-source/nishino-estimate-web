import type { PriceImportDiff, PriceItem } from "@/types/domain";

const numberPattern = /^[-+]?\d[\d,]*$/;
const pageNumberPattern = /^\d{1,4}$/;
const specTokenPattern = /[A-Za-zＡ-Ｚａ-ｚ0-9０-９φΦ]/;
const unitTokens = new Set([
  "m",
  "M",
  "ｍ",
  "Ｍ",
  "本",
  "個",
  "組",
  "台",
  "基",
  "式",
  "枚",
  "箇所",
  "か所",
  "ヶ所",
  "ケ所",
  "人",
  "日",
  "時間",
  "kg",
  "KG",
  "ｋｇ",
  "㎡",
  "m2",
  "m3",
  "㎥",
  "セット",
]);
const japaneseTextPattern = /[一-龥ぁ-んァ-ヶ]/;

function toNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  return Number(value.replaceAll(",", ""));
}

function isNumberToken(value: string | undefined): boolean {
  return Boolean(value && numberPattern.test(value));
}

function isPageNumberToken(value: string | undefined): boolean {
  return Boolean(value && pageNumberPattern.test(value));
}

function normalizeToken(value: string): string {
  return value.replace(/\u00a0/g, " ").trim();
}

function isUnitToken(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return unitTokens.has(value.trim());
}

function splitDescription(tokens: string[]) {
  const specStart = tokens.findIndex((token) => specTokenPattern.test(token));
  if (specStart <= 0) {
    return {
      name: tokens[0] || "名称未取得",
      specification: tokens.slice(1).join(" "),
      note: "",
      construction: "",
    };
  }

  const name = tokens.slice(0, specStart).join("");
  const rest = tokens.slice(specStart);
  if (rest.length >= 4) {
    return {
      name,
      specification: rest.slice(0, -2).join(" "),
      note: rest.at(-2) || "",
      construction: rest.at(-1) || "",
    };
  }
  if (rest.length === 3) {
    return {
      name,
      specification: rest[0],
      note: rest[1],
      construction: rest[2],
    };
  }
  return {
    name,
    specification: rest.join(" "),
    note: "",
    construction: "",
  };
}

export function parsePriceRowsFromText(text: string, year: number): PriceItem[] {
  const tokens = text
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)
    .filter((token) => token !== "東京都" && token !== "複合単価");
  const parsed: PriceItem[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (!isPageNumberToken(tokens[index]) || isNumberToken(tokens[index + 1])) {
      continue;
    }

    let unitIndex = -1;
    for (let candidateIndex = index + 2; candidateIndex <= Math.min(index + 24, tokens.length - 6); candidateIndex += 1) {
      if (
        isUnitToken(tokens[candidateIndex]) &&
        isNumberToken(tokens[candidateIndex + 1]) &&
        isNumberToken(tokens[candidateIndex + 2]) &&
        isNumberToken(tokens[candidateIndex + 3]) &&
        isNumberToken(tokens[candidateIndex + 4]) &&
        isNumberToken(tokens[candidateIndex + 5])
      ) {
        unitIndex = candidateIndex;
        break;
      }
    }

    if (unitIndex === -1) {
      continue;
    }

    const pageNo = toNumber(tokens[index]);
    const unit = tokens[unitIndex];
    const [materialUnitPrice, materialCost, laborCost, expense, compositeUnitPrice] = tokens
      .slice(unitIndex + 1, unitIndex + 6)
      .map(toNumber);
    const description = splitDescription(tokens.slice(index + 1, unitIndex));
    if (!japaneseTextPattern.test(description.name)) {
      index = unitIndex + 5;
      continue;
    }

    parsed.push({
      id: crypto.randomUUID(),
      year,
      pageNo,
      name: description.name,
      specification: description.specification,
      note: description.note,
      construction: description.construction,
      unit,
      materialUnitPrice,
      materialCost,
      laborCost,
      expense,
      compositeUnitPrice: compositeUnitPrice || materialCost + laborCost + expense,
      active: true,
    });

    index = unitIndex + 5;
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
        item.note === parsed.note &&
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
