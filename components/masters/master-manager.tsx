"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import type { Customer, PriceItem, WorkCategory } from "@/types/domain";

export function MasterManager() {
  const { data, setData, isAdmin } = useAppData();
  const [tab, setTab] = useState<"customers" | "prices" | "categories" | "company" | "users">("customers");

  const updateCustomer = (id: string, patch: Partial<Customer>) => {
    setData((current) => ({
      ...current,
      customers: current.customers.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer)),
    }));
  };

  const updatePrice = (id: string, patch: Partial<PriceItem>) => {
    setData((current) => ({
      ...current,
      priceItems: current.priceItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateCategory = (id: string, patch: Partial<WorkCategory>) => {
    setData((current) => ({
      ...current,
      workCategories: current.workCategories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addCustomer = () => {
    setData((current) => ({
      ...current,
      customers: [
        ...current.customers,
        {
          id: crypto.randomUUID(),
          name: "新規顧客",
          honorific: "御中",
          priceCoefficient: 1,
          address: "",
          phone: "",
          memo: "",
        },
      ],
    }));
  };

  const addPrice = () => {
    setData((current) => ({
      ...current,
      priceItems: [
        ...current.priceItems,
        {
          id: crypto.randomUUID(),
          year: new Date().getFullYear(),
          pageNo: 0,
          name: "新規単価",
          specification: "",
          note: "",
          construction: "",
          unit: "式",
          materialUnitPrice: 0,
          materialCost: 0,
          laborCost: 0,
          expense: 0,
          compositeUnitPrice: 0,
          active: true,
        },
      ],
    }));
  };

  const disabled = !isAdmin;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">マスタ管理</h1>
          <p className="page-subtitle">顧客、単価、工種、会社情報、ユーザーを管理します。</p>
        </div>
        {!isAdmin && <span className="badge warn">一般ユーザーは閲覧のみ</span>}
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        {[
          ["customers", "顧客"],
          ["prices", "単価"],
          ["categories", "工種"],
          ["company", "会社情報"],
          ["users", "ユーザー"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "button" : "button secondary"}
            key={key}
            type="button"
            onClick={() => setTab(key as typeof tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "customers" && (
        <section className="panel">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2>顧客マスタ</h2>
            <button className="button" disabled={disabled} type="button" onClick={addCustomer}>
              顧客追加
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th>敬称</th>
                  <th>上乗せ係数</th>
                  <th>住所</th>
                  <th>電話</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input className="input" disabled={disabled} value={customer.name} onChange={(event) => updateCustomer(customer.id, { name: event.target.value })} />
                    </td>
                    <td>
                      <input
                        className="input"
                        disabled={disabled}
                        value={customer.honorific}
                        onChange={(event) => updateCustomer(customer.id, { honorific: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        disabled={disabled}
                        type="number"
                        step="0.01"
                        value={customer.priceCoefficient}
                        onChange={(event) => updateCustomer(customer.id, { priceCoefficient: Number(event.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        disabled={disabled}
                        value={customer.address}
                        onChange={(event) => updateCustomer(customer.id, { address: event.target.value })}
                      />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.phone} onChange={(event) => updateCustomer(customer.id, { phone: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.memo} onChange={(event) => updateCustomer(customer.id, { memo: event.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "prices" && (
        <section className="panel">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2>単価マスタ</h2>
            <button className="button" disabled={disabled} type="button" onClick={addPrice}>
              単価追加
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>年度</th>
                  <th>頁</th>
                  <th>名称</th>
                  <th>仕様</th>
                  <th>施工</th>
                  <th>単位</th>
                  <th>材料費</th>
                  <th>労務費</th>
                  <th>経費</th>
                  <th>有効</th>
                </tr>
              </thead>
              <tbody>
                {data.priceItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input className="input" disabled={disabled} type="number" value={item.year} onChange={(event) => updatePrice(item.id, { year: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} type="number" value={item.pageNo} onChange={(event) => updatePrice(item.id, { pageNo: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={item.name} onChange={(event) => updatePrice(item.id, { name: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={item.specification} onChange={(event) => updatePrice(item.id, { specification: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={item.construction} onChange={(event) => updatePrice(item.id, { construction: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={item.unit} onChange={(event) => updatePrice(item.id, { unit: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} type="number" value={item.materialCost} onChange={(event) => updatePrice(item.id, { materialCost: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} type="number" value={item.laborCost} onChange={(event) => updatePrice(item.id, { laborCost: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} type="number" value={item.expense} onChange={(event) => updatePrice(item.id, { expense: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input checked={item.active} disabled={disabled} type="checkbox" onChange={(event) => updatePrice(item.id, { active: event.target.checked })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "categories" && (
        <section className="panel">
          <h2>工種マスタ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>表示順</th>
                  <th>有効</th>
                </tr>
              </thead>
              <tbody>
                {data.workCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <input className="input" disabled={disabled} value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} />
                    </td>
                    <td>
                      <input
                        className="input"
                        disabled={disabled}
                        type="number"
                        value={category.sortOrder}
                        onChange={(event) => updateCategory(category.id, { sortOrder: Number(event.target.value) })}
                      />
                    </td>
                    <td>
                      <input checked={category.active} disabled={disabled} type="checkbox" onChange={(event) => updateCategory(category.id, { active: event.target.checked })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "company" && (
        <section className="panel">
          <h2>会社情報マスタ</h2>
          <div className="grid cols-2">
            {[
              ["companyName", "会社名"],
              ["postalCode", "郵便番号"],
              ["address", "住所"],
              ["tel", "TEL"],
              ["fax", "FAX"],
              ["estimateNumberPattern", "見積番号形式"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  className="input"
                  disabled={disabled}
                  value={String(data.companySettings[key as keyof typeof data.companySettings])}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      companySettings: { ...current.companySettings, [key]: event.target.value },
                    }))
                  }
                />
              </div>
            ))}
            <div className="field">
              <label>初期諸経費率</label>
              <input
                className="input"
                disabled={disabled}
                type="number"
                step="0.01"
                value={data.companySettings.defaultExpenseRate}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    companySettings: { ...current.companySettings, defaultExpenseRate: Number(event.target.value) },
                  }))
                }
              />
            </div>
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="panel">
          <h2>ユーザーマスタ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メール</th>
                  <th>権限</th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>{profile.name}</td>
                    <td>{profile.email}</td>
                    <td>
                      <span className="badge">{profile.role === "admin" ? "管理者" : "一般"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">本番運用では Supabase Auth と連携してユーザーを管理します。</p>
        </section>
      )}
    </>
  );
}
