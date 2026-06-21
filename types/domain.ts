export type UserRole = "admin" | "user";

export type WorkCategoryKey =
  | "water"
  | "drain"
  | "hotWater"
  | "sanitary"
  | "airConditioning"
  | "ventilation"
  | "fire"
  | "gas"
  | "other";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Customer = {
  id: string;
  name: string;
  honorific: string;
  priceCoefficient: number;
  address: string;
  phone: string;
  memo: string;
};

export type CompanySettings = {
  id: string;
  companyName: string;
  postalCode: string;
  address: string;
  tel: string;
  fax: string;
  defaultExpenseRate: number;
  estimateNumberPattern: string;
};

export type WorkCategory = {
  id: WorkCategoryKey;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type PriceItem = {
  id: string;
  year: number;
  pageNo: number;
  name: string;
  specification: string;
  note: string;
  construction: string;
  unit: string;
  materialUnitPrice: number;
  materialCost: number;
  laborCost: number;
  expense: number;
  compositeUnitPrice: number;
  active: boolean;
};

export type EstimateItem = {
  id: string;
  workCategoryId: WorkCategoryKey;
  priceItemId?: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  materialCost: number;
  laborCost: number;
  expense: number;
  unitPrice: number;
  amount: number;
  memo: string;
  sortOrder: number;
};

export type Estimate = {
  id: string;
  estimateNo: string;
  customerId: string;
  customerNameSnapshot: string;
  customerHonorificSnapshot: string;
  priceCoefficientSnapshot: number;
  projectName: string;
  paymentTerms: string;
  validUntil: string;
  expenseRate: number;
  status: "draft" | "issued";
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
};

export type PriceImportDiffType = "add" | "update" | "delete_candidate" | "uncertain";

export type PriceImportDiff = {
  id: string;
  diffType: PriceImportDiffType;
  currentItemId?: string;
  parsedData: PriceItem;
  selected: boolean;
  confidence: number;
  reason: string;
};

export type PriceImportBatch = {
  id: string;
  year: number;
  fileName: string;
  status: "parsed" | "reviewed" | "applied" | "failed";
  diffs: PriceImportDiff[];
  createdAt: string;
};
