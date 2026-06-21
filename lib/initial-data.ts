import type { CompanySettings, Customer, Estimate, PriceItem, Profile, WorkCategory } from "@/types/domain";
import { createEstimateItemFromPriceItem, generateEstimateNumber } from "@/lib/calculations";

export const workCategories: WorkCategory[] = [
  { id: "water", name: "給水設備工事", sortOrder: 1, active: true },
  { id: "drain", name: "排水通気設備工事", sortOrder: 2, active: true },
  { id: "hotWater", name: "給湯設備工事", sortOrder: 3, active: true },
  { id: "sanitary", name: "衛生器具設備工事", sortOrder: 4, active: true },
  { id: "airConditioning", name: "空調設備工事", sortOrder: 5, active: true },
  { id: "ventilation", name: "換気設備工事", sortOrder: 6, active: true },
  { id: "fire", name: "消火設備工事", sortOrder: 7, active: true },
  { id: "gas", name: "ガス設備工事", sortOrder: 8, active: true },
  { id: "other", name: "その他設備工事", sortOrder: 9, active: true },
];

export const companySettings: CompanySettings = {
  id: "company-default",
  companyName: "有限会社　ニシノ設備工業",
  postalCode: "336-0043",
  address: "埼玉県さいたま市南区大字円正寺210番地3",
  tel: "048-813-6350",
  fax: "048-813-6351",
  defaultExpenseRate: 0.15,
  estimateNumberPattern: "YYYY-0001",
};

export const profiles: Profile[] = [
  { id: "admin-demo", name: "管理者", email: "admin@example.com", role: "admin" },
  { id: "user-demo", name: "一般ユーザー", email: "user@example.com", role: "user" },
];

export const customers: Customer[] = [
  {
    id: "customer-1",
    name: "社会福祉法人賛育会",
    honorific: "御中",
    priceCoefficient: 1.1,
    address: "",
    phone: "",
    memo: "標準上乗せ 10%",
  },
  {
    id: "customer-2",
    name: "株式会社サンプル建設",
    honorific: "御中",
    priceCoefficient: 1,
    address: "",
    phone: "",
    memo: "",
  },
];

export const priceItems: PriceItem[] = [
  {
    id: "price-1",
    year: 2026,
    pageNo: 1,
    name: "塩ビライニング鋼管",
    specification: "SGP-VA 15A",
    note: "ねじ接合",
    construction: "屋内一般",
    unit: "ｍ",
    materialUnitPrice: 600,
    materialCost: 1110,
    laborCost: 2470,
    expense: 642,
    compositeUnitPrice: 4220,
    active: true,
  },
  {
    id: "price-2",
    year: 2026,
    pageNo: 2,
    name: "水道用塩ビライニング鋼管",
    specification: "SGP-VA 50A",
    note: "ねじ接合",
    construction: "屋内一般",
    unit: "ｍ",
    materialUnitPrice: 1890,
    materialCost: 3497,
    laborCost: 3914,
    expense: 1240,
    compositeUnitPrice: 8650,
    active: true,
  },
  {
    id: "price-3",
    year: 2026,
    pageNo: 3,
    name: "排水用塩ビライニング鋼管",
    specification: "SGP-D-VA 40A",
    note: "ねじ接合",
    construction: "機械室・便所",
    unit: "ｍ",
    materialUnitPrice: 1390,
    materialCost: 2633,
    laborCost: 4025,
    expense: 1090,
    compositeUnitPrice: 7750,
    active: true,
  },
];

export function createInitialEstimate(): Estimate {
  const customer = customers[0];
  const item = createEstimateItemFromPriceItem(priceItems[0], "water", customer.priceCoefficient, 1);
  return {
    id: "estimate-demo",
    estimateNo: generateEstimateNumber(companySettings.estimateNumberPattern, 1),
    customerId: customer.id,
    customerNameSnapshot: customer.name,
    customerHonorificSnapshot: customer.honorific,
    priceCoefficientSnapshot: customer.priceCoefficient,
    projectName: "（仮称）社会福祉法人賛育会事務所棟新築工事",
    paymentTerms: "打合せによる",
    validUntil: "",
    expenseRate: companySettings.defaultExpenseRate,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [item],
  };
}
