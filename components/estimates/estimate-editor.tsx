"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Estimate, EstimateItem, WorkCategoryKey } from "@/types/domain";
import { useAppData } from "@/components/app-provider";
import {
  createEstimateItemFromPriceItem,
  formatCurrency,
  generateEstimateNumber,
  getCategoryTotal,
  getDirectCost,
  getGrandTotal,
  getOverhead,
  recalculateItem,
} from "@/lib/calculations";

type EstimateEditorProps = {
  estimateId?: string;
};

export function EstimateEditor({ estimateId }: EstimateEditorProps) {
  const router = useRouter();
  const { data, setData } = useAppData();
  const existingEstimate = estimateId ? data.estimates.find((estimate) => estimate.id === estimateId) : undefined;
  const [selectedCategory, setSelectedCategory] = useState<WorkCategoryKey>("water");
  const [priceQuery, setPriceQuery] = useState("");

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

  const filteredPriceItems = useMemo(() => {
    const query = priceQuery.trim().toLowerCase();
    return data.priceItems
      .filter((item) => item.active)
      .filter((item) => {
        if (!query) {
          return true;
        }
        return [item.name, item.specification, item.note, item.construction]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 20);
  }, [data.priceItems, priceQuery]);

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

  const saveEstimate = () => {
    const saved = { ...estimate, updatedAt: new Date().toISOString() };
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
          <p className="page-subtitle">顧客係数を材料費+労務費+経費に反映して明細金額を計算します。</p>
        </div>
        <div className="toolbar">
          <button className="button" type="button" onClick={saveEstimate}>
            保存してプレビュー
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
              <label>諸経費率</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={estimate.expenseRate}
                onChange={(event) => setEstimate({ ...estimate, expenseRate: Number(event.target.value) })}
              />
            </div>
            <div className="field">
              <label>顧客係数</label>
              <input className="input" value={estimate.priceCoefficientSnapshot} readOnly />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>合計</h2>
          <div className="grid cols-3">
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

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>単価マスタ検索</h2>
        <div className="toolbar">
          <select
            className="select"
            style={{ maxWidth: 260 }}
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as WorkCategoryKey)}
          >
            {data.workCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            style={{ maxWidth: 420 }}
            placeholder="名称、仕様、備考、施工で検索"
            value={priceQuery}
            onChange={(event) => setPriceQuery(event.target.value)}
          />
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>仕様</th>
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

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>工種別明細</h2>
        {data.workCategories.map((category) => {
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
                      <th>単価</th>
                      <th>金額</th>
                      <th>備考</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="muted">
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
                            <input
                              className="input"
                              type="number"
                              value={item.quantity}
                              onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                            />
                          </td>
                          <td>{item.unit}</td>
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
    </>
  );
}
