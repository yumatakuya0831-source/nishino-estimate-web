"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Estimate, EstimateItem, WorkCategoryKey } from "@/types/domain";
import { useAppData } from "@/components/app-provider";
import { supabase } from "@/lib/supabase/client";
import {
  createEstimateItemFromPriceItem,
  formatCurrency,
  generateEstimateNumber,
  getCategoryTotal,
  getDirectCost,
  getGrandTotal,
  getLaborCostTotal,
  getOverhead,
  recalculateItem,
} from "@/lib/calculations";

type EstimateEditorProps = {
  estimateId?: string;
};

type EditableNumberInputProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  step?: number;
  className?: string;
};

function EditableNumberInput({
  value,
  onValueChange,
  min = 0,
  step,
  className = "input",
}: EditableNumberInputProps) {
  const [text, setText] = useState(String(value));
  const lastValueBeforeClear = useRef(value);

  useEffect(() => {
    setText(String(value));
    lastValueBeforeClear.current = value;
  }, [value]);

  const clearValue = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace" && event.key !== "Delete") {
      return;
    }
    event.preventDefault();
    if (text !== "") {
      lastValueBeforeClear.current = Number(text);
    }
    setText("");
  };

  return (
    <input
      className={className}
      type="number"
      min={min}
      step={step}
      value={text}
      onClick={(event) => event.currentTarget.select()}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={clearValue}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        if (nextText !== "") {
          const nextValue = Number(nextText);
          lastValueBeforeClear.current = nextValue;
          onValueChange(nextValue);
        }
      }}
      onBlur={() => {
        if (text === "") {
          setText(String(lastValueBeforeClear.current));
          onValueChange(lastValueBeforeClear.current);
        }
      }}
    />
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja-JP"));
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function nullableUuid(value: string | undefined): string | null {
  return isUuid(value) ? value : null;
}

function uuidOrNew(value: string): string {
  return isUuid(value) ? value : crypto.randomUUID();
}

export function EstimateEditor({ estimateId }: EstimateEditorProps) {
  const router = useRouter();
  const { data, setData, session } = useAppData();
  const existingEstimate = estimateId ? data.estimates.find((estimate) => estimate.id === estimateId) : undefined;
  const [selectedCategory, setSelectedCategory] = useState<WorkCategoryKey>("water");
  const [priceNameFilter, setPriceNameFilter] = useState("");
  const [priceSpecificationFilter, setPriceSpecificationFilter] = useState("");
  const [priceConstructionFilter, setPriceConstructionFilter] = useState("");
  const [priceKeyword, setPriceKeyword] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<"search" | "items" | "preview">("search");

  const [estimate, setEstimate] = useState<Estimate>(() => {
    if (existingEstimate) {
      return existingEstimate;
    }
    const customer = data.customers[0];
    return {
      id: crypto.randomUUID(),
      estimateNo: generateEstimateNumber(data.companySettings.estimateNumberPattern, data.estimates.length + 1),
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerHonorificSnapshot: customer.honorific,
      priceCoefficientSnapshot: customer.priceCoefficient,
      projectName: "",
      paymentTerms: "打合せによる",
      validUntil: "",
      expenseRate: data.companySettings.defaultExpenseRate,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
  });
  const requestedEstimateNo = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (estimateId || existingEstimate || requestedEstimateNo.current || !client || !session) {
      return;
    }

    requestedEstimateNo.current = true;
    const assignEstimateNumber = async () => {
      const { data: nextNo, error } = await client.rpc("next_estimate_number", {
        pattern_arg: data.companySettings.estimateNumberPattern,
      });

      if (error || typeof nextNo !== "string") {
        console.error("Failed to generate estimate number", error);
        return;
      }

      setEstimate((current) => ({ ...current, estimateNo: nextNo }));
    };

    void assignEstimateNumber();
  }, [data.companySettings.estimateNumberPattern, estimateId, existingEstimate, session]);

  const activePriceItems = useMemo(() => data.priceItems.filter((item) => item.active), [data.priceItems]);
  const priceNameOptions = useMemo(() => uniqueOptions(activePriceItems.map((item) => item.name)), [activePriceItems]);
  const priceSpecificationOptions = useMemo(
    () =>
      uniqueOptions(
        activePriceItems
          .filter((item) => !priceNameFilter || item.name === priceNameFilter)
          .map((item) => item.specification),
      ),
    [activePriceItems, priceNameFilter],
  );
  const priceConstructionOptions = useMemo(
    () =>
      uniqueOptions(
        activePriceItems
          .filter((item) => !priceNameFilter || item.name === priceNameFilter)
          .filter((item) => !priceSpecificationFilter || item.specification === priceSpecificationFilter)
          .map((item) => item.construction),
      ),
    [activePriceItems, priceNameFilter, priceSpecificationFilter],
  );
  const filteredPriceItemCount = useMemo(() => {
    const keyword = priceKeyword.trim().toLocaleLowerCase("ja-JP");
    return activePriceItems.filter((item) => {
      const matchesName = !priceNameFilter || item.name === priceNameFilter;
      const matchesSpecification = !priceSpecificationFilter || item.specification === priceSpecificationFilter;
      const matchesConstruction = !priceConstructionFilter || item.construction === priceConstructionFilter;
      const matchesKeyword =
        !keyword ||
        [item.name, item.specification, item.note, item.construction].join(" ").toLocaleLowerCase("ja-JP").includes(keyword);

      return matchesName && matchesSpecification && matchesConstruction && matchesKeyword;
    }).length;
  }, [activePriceItems, priceConstructionFilter, priceKeyword, priceNameFilter, priceSpecificationFilter]);
  const filteredPriceItems = useMemo(() => {
    const keyword = priceKeyword.trim().toLocaleLowerCase("ja-JP");
    return activePriceItems
      .filter((item) => !priceNameFilter || item.name === priceNameFilter)
      .filter((item) => !priceSpecificationFilter || item.specification === priceSpecificationFilter)
      .filter((item) => !priceConstructionFilter || item.construction === priceConstructionFilter)
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return [item.name, item.specification, item.note, item.construction]
          .join(" ")
          .toLocaleLowerCase("ja-JP")
          .includes(keyword);
      })
      .slice(0, 50);
  }, [activePriceItems, priceConstructionFilter, priceKeyword, priceNameFilter, priceSpecificationFilter]);

  const resetPriceFilters = () => {
    setPriceNameFilter("");
    setPriceSpecificationFilter("");
    setPriceConstructionFilter("");
    setPriceKeyword("");
  };

  const selectCustomer = (customerId: string) => {
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer) {
      return;
    }
    setEstimate((current) => ({
      ...current,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerHonorificSnapshot: customer.honorific,
      priceCoefficientSnapshot: customer.priceCoefficient,
      items: current.items.map((item) => recalculateItem(item, customer.priceCoefficient)),
    }));
  };

  const addPriceItem = (priceItemId: string) => {
    const priceItem = data.priceItems.find((item) => item.id === priceItemId);
    if (!priceItem) {
      return;
    }
    setEstimate((current) => ({
      ...current,
      items: [
        ...current.items,
        createEstimateItemFromPriceItem(
          priceItem,
          selectedCategory,
          current.priceCoefficientSnapshot,
          current.items.length + 1,
        ),
      ],
    }));
  };

  const updateItem = (itemId: string, patch: Partial<EstimateItem>) => {
    setEstimate((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? recalculateItem({ ...item, ...patch }, current.priceCoefficientSnapshot) : item,
      ),
    }));
  };

  const removeItem = (itemId: string) => {
    setEstimate((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
  };

  const updateLaborCostTotal = (nextTotal: number) => {
    setEstimate((current) => {
      const laborItems = current.items.filter((item) => item.quantity > 0 && current.priceCoefficientSnapshot > 0);

      if (laborItems.length === 0) {
        return current;
      }

      const currentTotal = getLaborCostTotal(current);
      const scale = currentTotal > 0 ? nextTotal / currentTotal : 0;
      const equalShare = nextTotal / laborItems.length;
      return {
        ...current,
        items: current.items.map((item) => {
          if (!laborItems.some((laborItem) => laborItem.id === item.id)) {
            return item;
          }
          const laborCost =
            currentTotal > 0
              ? item.laborCost * scale
              : equalShare / (item.quantity * current.priceCoefficientSnapshot);
          return recalculateItem({ ...item, laborCost }, current.priceCoefficientSnapshot);
        }),
      };
    });
  };

  const saveEstimate = async () => {
    const saved = {
      ...estimate,
      id: supabase && session ? uuidOrNew(estimate.id) : estimate.id,
      updatedAt: new Date().toISOString(),
      items:
        supabase && session
          ? estimate.items.map((item) => ({ ...item, id: uuidOrNew(item.id) }))
          : estimate.items,
    };

    if (supabase && session) {
      const { error: estimateError } = await supabase.from("estimates").upsert({
        id: saved.id,
        estimate_no: saved.estimateNo,
        customer_id: nullableUuid(saved.customerId),
        customer_name_snapshot: saved.customerNameSnapshot,
        customer_honorific_snapshot: saved.customerHonorificSnapshot,
        price_coefficient_snapshot: saved.priceCoefficientSnapshot,
        project_name: saved.projectName,
        payment_terms: saved.paymentTerms,
        valid_until: saved.validUntil || null,
        expense_rate: saved.expenseRate,
        status: saved.status,
        created_by: session.user.id,
        updated_at: saved.updatedAt,
      });

      if (estimateError) {
        window.alert(`見積の保存に失敗しました: ${estimateError.message}`);
        return;
      }

      const { error: deleteError } = await supabase.from("estimate_items").delete().eq("estimate_id", saved.id);
      if (deleteError) {
        window.alert(`見積明細の更新に失敗しました: ${deleteError.message}`);
        return;
      }

      if (saved.items.length > 0) {
        const { error: itemsError } = await supabase.from("estimate_items").insert(
          saved.items.map((item) => ({
            id: item.id,
            estimate_id: saved.id,
            work_category_id: item.workCategoryId,
            price_item_id: nullableUuid(item.priceItemId),
            name: item.name,
            specification: item.specification,
            quantity: item.quantity,
            unit: item.unit,
            material_cost: item.materialCost,
            labor_cost: item.laborCost,
            include_material_cost: item.includeMaterialCost,
            include_labor_cost: item.includeLaborCost,
            expense: item.expense,
            unit_price: item.unitPrice,
            amount: item.amount,
            memo: item.memo,
            sort_order: item.sortOrder,
          })),
        );

        if (itemsError) {
          window.alert(`見積明細の保存に失敗しました: ${itemsError.message}`);
          return;
        }
      }
    }

    setData((current) => ({
      ...current,
      estimates: current.estimates.some((item) => item.id === saved.id)
        ? current.estimates.map((item) => (item.id === saved.id ? saved : item))
        : [...current.estimates, saved],
    }));
    router.push(`/estimates/${saved.id}/preview`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{existingEstimate ? "見積編集" : "新規見積"}</h1>
          <p className="page-subtitle">材料費は計算対象を選択し、労務費は帳票表示を切り替えます。労務費合計は現場難易度に合わせて調整できます。</p>
        </div>
        <div className="toolbar">
          <button className="button" type="button" onClick={() => setActiveEditorTab("preview")}>
            プレビュー
          </button>
          <Link className="button secondary" href="/">
            メニューへ戻る
          </Link>
        </div>
      </div>

      <div className="grid cols-2">
        <section className="panel">
          <h2>基本情報</h2>
          <div className="grid cols-2">
            <div className="field">
              <label>見積番号</label>
              <input
                className="input"
                value={estimate.estimateNo}
                onChange={(event) => setEstimate({ ...estimate, estimateNo: event.target.value })}
              />
            </div>
            <div className="field">
              <label>顧客</label>
              <select className="select" value={estimate.customerId} onChange={(event) => selectCustomer(event.target.value)}>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}（係数 {customer.priceCoefficient}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>工事件名</label>
              <input
                className="input"
                value={estimate.projectName}
                onChange={(event) => setEstimate({ ...estimate, projectName: event.target.value })}
              />
            </div>
            <div className="field">
              <label>支払条件</label>
              <input
                className="input"
                value={estimate.paymentTerms}
                onChange={(event) => setEstimate({ ...estimate, paymentTerms: event.target.value })}
              />
            </div>
            <div className="field">
              <label>有効期限</label>
              <input
                className="input"
                type="date"
                value={estimate.validUntil}
                onChange={(event) => setEstimate({ ...estimate, validUntil: event.target.value })}
              />
            </div>
            <div className="field">
              <label>諸経費計算</label>
              <input className="input" value="明細経費の合計" readOnly />
            </div>
            <div className="field">
              <label>顧客係数</label>
              <input className="input" value={estimate.priceCoefficientSnapshot} readOnly />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>合計</h2>
          <div className="estimate-summary-grid">
            <div>
              <div className="muted">労務費</div>
              <EditableNumberInput
                className="input numeric estimate-summary-input"
                value={getLaborCostTotal(estimate)}
                onValueChange={updateLaborCostTotal}
              />
            </div>
            <div>
              <div className="muted">直接工事費</div>
              <div className="summary-number">{formatCurrency(getDirectCost(estimate))}</div>
            </div>
            <div>
              <div className="muted">諸経費</div>
              <div className="summary-number">{formatCurrency(getOverhead(estimate))}</div>
            </div>
            <div>
              <div className="muted">総額</div>
              <div className="summary-number">{formatCurrency(getGrandTotal(estimate))}</div>
            </div>
          </div>
          <p className="muted">消費税は現行通り計算せず、帳票に「別途申し受けます」と表示します。</p>
        </section>
      </div>

      <nav aria-label="見積編集メニュー" className="estimate-editor-tabs" role="tablist">
        <button
          aria-selected={activeEditorTab === "search"}
          className={activeEditorTab === "search" ? "estimate-editor-tab active" : "estimate-editor-tab"}
          role="tab"
          type="button"
          onClick={() => setActiveEditorTab("search")}
        >
          単価を探す
        </button>
        <button
          aria-selected={activeEditorTab === "items"}
          className={activeEditorTab === "items" ? "estimate-editor-tab active" : "estimate-editor-tab"}
          role="tab"
          type="button"
          onClick={() => setActiveEditorTab("items")}
        >
          見積明細
          <span className="estimate-editor-tab-meta">
            {estimate.items.length}件・{formatCurrency(getGrandTotal(estimate))}
          </span>
        </button>
        <button
          aria-selected={activeEditorTab === "preview"}
          className={activeEditorTab === "preview" ? "estimate-editor-tab active" : "estimate-editor-tab"}
          role="tab"
          type="button"
          onClick={() => setActiveEditorTab("preview")}
        >
          プレビュー
          <span className="estimate-editor-tab-meta">保存前確認</span>
        </button>
      </nav>

      {activeEditorTab === "search" && (
      <section className="panel estimate-editor-tab-panel" role="tabpanel">
        <h2>単価マスタ検索</h2>
        <div className="grid cols-3">
          <div className="field">
            <label>工種</label>
            <select
              className="select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as WorkCategoryKey)}
            >
              {data.workCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>名称</label>
            <select
              className="select"
              value={priceNameFilter}
              onChange={(event) => {
                setPriceNameFilter(event.target.value);
                setPriceSpecificationFilter("");
                setPriceConstructionFilter("");
              }}
            >
              <option value="">すべて</option>
              {priceNameOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>摘要</label>
            <select
              className="select"
              value={priceSpecificationFilter}
              onChange={(event) => {
                setPriceSpecificationFilter(event.target.value);
                setPriceConstructionFilter("");
              }}
            >
              <option value="">すべて</option>
              {priceSpecificationOptions.map((specification) => (
                <option key={specification} value={specification}>
                  {specification}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>施工</label>
            <select className="select" value={priceConstructionFilter} onChange={(event) => setPriceConstructionFilter(event.target.value)}>
              <option value="">すべて</option>
              {priceConstructionOptions.map((construction) => (
                <option key={construction} value={construction}>
                  {construction}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>キーワード</label>
            <input
              className="input"
              placeholder="備考などを補助検索"
              value={priceKeyword}
              onChange={(event) => setPriceKeyword(event.target.value)}
            />
          </div>
          <div className="field">
            <label>操作</label>
            <button className="button secondary" type="button" onClick={resetPriceFilters}>
              条件クリア
            </button>
          </div>
        </div>
        <p className="muted">
          候補 {filteredPriceItemCount.toLocaleString()}件中、最大{filteredPriceItems.length.toLocaleString()}件を表示しています。
        </p>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>摘要</th>
                <th>備考</th>
                <th>施工</th>
                <th>単位</th>
                <th>材料費</th>
                <th>労務費</th>
                <th>経費</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPriceItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.specification}</td>
                  <td>{item.note}</td>
                  <td>{item.construction}</td>
                  <td>{item.unit}</td>
                  <td className="numeric">{item.materialCost.toLocaleString()}</td>
                  <td className="numeric">{item.laborCost.toLocaleString()}</td>
                  <td className="numeric">{item.expense.toLocaleString()}</td>
                  <td>
                    <button className="button secondary" type="button" onClick={() => addPriceItem(item.id)}>
                      追加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeEditorTab === "items" && (
      <section className="panel estimate-editor-tab-panel" role="tabpanel">
        <h2>工種別明細</h2>
        {estimate.items.length === 0 && <p className="muted">選択した明細はありません。「単価を探す」から追加してください。</p>}
        {data.workCategories.filter((category) =>
          estimate.items.some((item) => item.workCategoryId === category.id),
        ).map((category) => {
          const items = estimate.items.filter((item) => item.workCategoryId === category.id);
          return (
            <div className="paper-section" key={category.id}>
              <h3>
                {category.name} <span className="badge">{formatCurrency(getCategoryTotal(estimate, category.id))}</span>
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>仕様</th>
                      <th>数量</th>
                      <th>単位</th>
                      <th>計算/表示</th>
                      <th>材料費</th>
                      <th>労務費</th>
                      <th>明細経費</th>
                      <th>単価</th>
                      <th>金額</th>
                      <th>備考</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="muted">
                          明細はありません。
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input className="input" value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={item.specification}
                              onChange={(event) => updateItem(item.id, { specification: event.target.value })}
                            />
                          </td>
                          <td>
                            <EditableNumberInput
                              value={item.quantity}
                              onValueChange={(value) => updateItem(item.id, { quantity: value })}
                            />
                          </td>
                          <td>
                            <input className="input" value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} />
                          </td>
                          <td>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={item.includeMaterialCost}
                                onChange={(event) => updateItem(item.id, { includeMaterialCost: event.target.checked })}
                              />
                              材料を計算
                            </label>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={item.includeLaborCost}
                                onChange={(event) => updateItem(item.id, { includeLaborCost: event.target.checked })}
                              />
                              労務を表示
                            </label>
                          </td>
                          <td>
                            <EditableNumberInput
                              className="input numeric"
                              value={item.materialCost}
                              onValueChange={(value) => updateItem(item.id, { materialCost: value })}
                            />
                          </td>
                          <td>
                            <EditableNumberInput
                              className="input numeric"
                              value={item.laborCost}
                              onValueChange={(value) => updateItem(item.id, { laborCost: value })}
                            />
                          </td>
                          <td>
                            <EditableNumberInput
                              className="input numeric"
                              value={item.expense}
                              onValueChange={(value) => updateItem(item.id, { expense: value })}
                            />
                          </td>
                          <td className="numeric">{formatCurrency(item.unitPrice)}</td>
                          <td className="numeric">{formatCurrency(item.amount)}</td>
                          <td>
                            <input className="input" value={item.memo} onChange={(event) => updateItem(item.id, { memo: event.target.value })} />
                          </td>
                          <td>
                            <button className="button danger" type="button" onClick={() => removeItem(item.id)}>
                              削除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>
      )}

      {activeEditorTab === "preview" && (
      <section className="panel estimate-editor-tab-panel" role="tabpanel">
        <div className="estimate-review-header">
          <div>
            <h2>保存前プレビュー</h2>
            <p className="muted">PDF画面へ進む前に、帳票に載る内容と金額を確認・修正できます。</p>
          </div>
          <div className="toolbar">
            <button className="button secondary" type="button" onClick={() => setActiveEditorTab("items")}>
              明細を修正
            </button>
            <button className="button" type="button" onClick={saveEstimate}>
              保存してPDFプレビュー
            </button>
          </div>
        </div>

        <div className="estimate-review-cover">
          <div className="estimate-review-title">御 見 積 書</div>
          <div className="estimate-review-meta">
            <span>見積番号: {estimate.estimateNo}</span>
            <span>顧客: {estimate.customerNameSnapshot} {estimate.customerHonorificSnapshot}</span>
          </div>
          <div className="estimate-review-project">
            <span>工事名称</span>
            <strong>{estimate.projectName || "未入力"}</strong>
          </div>
          <div className="estimate-review-total">
            <span>見積金額</span>
            <strong>{formatCurrency(getGrandTotal(estimate))}</strong>
          </div>
        </div>

        <div className="estimate-summary-grid estimate-review-summary">
          <div>
            <div className="muted">労務費</div>
            <EditableNumberInput
              className="input numeric estimate-summary-input"
              value={getLaborCostTotal(estimate)}
              onValueChange={updateLaborCostTotal}
            />
          </div>
          <div>
            <div className="muted">直接工事費</div>
            <div className="summary-number">{formatCurrency(getDirectCost(estimate))}</div>
          </div>
          <div>
            <div className="muted">諸経費</div>
            <div className="summary-number">{formatCurrency(getOverhead(estimate))}</div>
          </div>
          <div>
            <div className="muted">総額</div>
            <div className="summary-number">{formatCurrency(getGrandTotal(estimate))}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>工種</th>
                <th>名称</th>
                <th>仕様</th>
                <th>数量</th>
                <th>単位</th>
                <th>計算/表示</th>
                <th>材料費</th>
                <th>労務費</th>
                <th>経費</th>
                <th>単価</th>
                <th>金額</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="muted">
                    明細はありません。「単価を探す」から追加してください。
                  </td>
                </tr>
              ) : (
                estimate.items.map((item) => {
                  const category = data.workCategories.find((workCategory) => workCategory.id === item.workCategoryId);
                  return (
                    <tr key={item.id}>
                      <td>{category?.name || item.workCategoryId}</td>
                      <td>{item.name}</td>
                      <td>{item.specification}</td>
                      <td>
                        <EditableNumberInput
                          className="input numeric"
                          value={item.quantity}
                          onValueChange={(value) => updateItem(item.id, { quantity: value })}
                        />
                      </td>
                      <td>{item.unit}</td>
                      <td>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={item.includeMaterialCost}
                            onChange={(event) => updateItem(item.id, { includeMaterialCost: event.target.checked })}
                          />
                          材料を計算
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={item.includeLaborCost}
                            onChange={(event) => updateItem(item.id, { includeLaborCost: event.target.checked })}
                          />
                          労務を表示
                        </label>
                      </td>
                      <td>
                        <EditableNumberInput
                          className="input numeric"
                          value={item.materialCost}
                          onValueChange={(value) => updateItem(item.id, { materialCost: value })}
                        />
                      </td>
                      <td>
                        <EditableNumberInput
                          className="input numeric"
                          value={item.laborCost}
                          onValueChange={(value) => updateItem(item.id, { laborCost: value })}
                        />
                      </td>
                      <td>
                        <EditableNumberInput
                          className="input numeric"
                          value={item.expense}
                          onValueChange={(value) => updateItem(item.id, { expense: value })}
                        />
                      </td>
                      <td className="numeric">{formatCurrency(item.unitPrice)}</td>
                      <td className="numeric">{formatCurrency(item.amount)}</td>
                      <td>
                        <input className="input" value={item.memo} onChange={(event) => updateItem(item.id, { memo: event.target.value })} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data.workCategories.filter((category) =>
          estimate.items.some((item) => item.workCategoryId === category.id),
        ).length > 0 && (
          <div className="estimate-review-category-totals">
            <h3>内訳集計</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>工種</th>
                    <th>数量</th>
                    <th>単位</th>
                    <th>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workCategories.filter((category) =>
                    estimate.items.some((item) => item.workCategoryId === category.id),
                  ).map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td className="numeric">1</td>
                      <td>式</td>
                      <td className="numeric">{formatCurrency(getCategoryTotal(estimate, category.id))}</td>
                    </tr>
                  ))}
                  <tr>
                    <th colSpan={3}>直接工事費 計</th>
                    <td className="numeric">{formatCurrency(getDirectCost(estimate))}</td>
                  </tr>
                  <tr>
                    <th colSpan={3}>労務費</th>
                    <td className="numeric">{formatCurrency(getLaborCostTotal(estimate))}</td>
                  </tr>
                  <tr>
                    <th colSpan={3}>諸経費</th>
                    <td className="numeric">{formatCurrency(getOverhead(estimate))}</td>
                  </tr>
                  <tr>
                    <th colSpan={3}>合計</th>
                    <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      )}
    </>
  );
}
