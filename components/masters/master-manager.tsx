"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import { supabase } from "@/lib/supabase/client";
import type { CompanySettings, Customer, PriceItem, WorkCategory } from "@/types/domain";

type MasterTab = "customers" | "prices" | "categories" | "company" | "users";

export function MasterManager() {
  const { data, setData, isAdmin, dataLoading, dataLoadingLabel } = useAppData();
  const [tab, setTab] = useState<MasterTab>("customers");
  const [tabLoading, setTabLoading] = useState(false);
  const [tabLoadingLabel, setTabLoadingLabel] = useState("");
  const [message, setMessage] = useState("");

  const disabled = !isAdmin;

  if (!isAdmin) {
    return (
      <section className="panel">
        <h1 className="page-title">権限がありません</h1>
        <p className="muted">マスタ管理は管理者のみ利用できます。</p>
      </section>
    );
  }

  const showResult = (label: string, error?: { message: string } | null) => {
    setMessage(error ? `${label}の保存に失敗しました: ${error.message}` : `${label}を保存しました。`);
  };

  const persistCustomer = async (customer: Customer) => {
    if (!supabase || disabled) return;
    const { error } = await supabase.from("customers").upsert({
      id: customer.id,
      name: customer.name,
      honorific: customer.honorific,
      price_coefficient: customer.priceCoefficient,
      address: customer.address,
      phone: customer.phone,
      memo: customer.memo,
      updated_at: new Date().toISOString(),
    });
    showResult("顧客マスタ", error);
  };

  const persistPrice = async (item: PriceItem) => {
    if (!supabase || disabled) return;
    const { error } = await supabase.from("price_items").upsert({
      id: item.id,
      year: item.year,
      page_no: item.pageNo,
      name: item.name,
      specification: item.specification,
      note: item.note,
      construction: item.construction,
      unit: item.unit,
      material_unit_price: item.materialUnitPrice,
      material_cost: item.materialCost,
      labor_cost: item.laborCost,
      expense: item.expense,
      composite_unit_price: item.compositeUnitPrice,
      active: item.active,
      updated_at: new Date().toISOString(),
    });
    showResult("単価マスタ", error);
  };

  const persistCategory = async (category: WorkCategory) => {
    if (!supabase || disabled) return;
    const { error } = await supabase.from("work_categories").upsert({
      id: category.id,
      name: category.name,
      sort_order: category.sortOrder,
      active: category.active,
    });
    showResult("工種マスタ", error);
  };

  const persistCompanySettings = async (settings: CompanySettings) => {
    if (!supabase || disabled) return;
    const { error } = await supabase.from("company_settings").upsert({
      id: settings.id,
      company_name: settings.companyName,
      postal_code: settings.postalCode,
      address: settings.address,
      tel: settings.tel,
      fax: settings.fax,
      default_expense_rate: settings.defaultExpenseRate,
      estimate_number_pattern: settings.estimateNumberPattern,
    });
    showResult("会社情報", error);
  };

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

  const updateCategory = (id: WorkCategory["id"], patch: Partial<WorkCategory>) => {
    setData((current) => ({
      ...current,
      workCategories: current.workCategories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateCompanySettings = (patch: Partial<CompanySettings>) => {
    setData((current) => ({
      ...current,
      companySettings: { ...current.companySettings, ...patch },
    }));
  };

  const addCustomer = () => {
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: "新規顧客",
      honorific: "御中",
      priceCoefficient: 1,
      address: "",
      phone: "",
      memo: "",
    };
    setData((current) => ({ ...current, customers: [...current.customers, customer] }));
    void persistCustomer(customer);
  };

  const addPrice = () => {
    const item: PriceItem = {
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
    };
    setData((current) => ({ ...current, priceItems: [...current.priceItems, item] }));
    void persistPrice(item);
  };

  const changeTab = (nextTab: MasterTab, label: string) => {
    if (nextTab === tab) {
      return;
    }

    setTabLoading(true);
    setTabLoadingLabel(`${label}マスタを表示しています`);
    window.setTimeout(() => {
      setTab(nextTab);
      window.setTimeout(() => {
        setTabLoading(false);
        setTabLoadingLabel("");
      }, nextTab === "prices" ? 500 : 180);
    }, 30);
  };

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
            disabled={tabLoading}
            key={key}
            type="button"
            onClick={() => changeTab(key as MasterTab, label)}
          >
            {label}
          </button>
        ))}
      </div>

      {(dataLoading || tabLoading) && (
        <div className="loading-box" role="status" aria-live="polite" style={{ marginBottom: 16 }}>
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <strong>{dataLoading ? dataLoadingLabel || "マスタデータを取得しています" : tabLoadingLabel}</strong>
            <p className="muted">
              {dataLoading
                ? "Supabaseから最新データを読み込んでいます。表示が更新されるまでお待ちください。"
                : "一覧を描画しています。表示が完了するまでお待ちください。"}
            </p>
          </div>
        </div>
      )}

      {message && <p className={message.includes("失敗") ? "error-text" : "muted"}>{message}</p>}

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
                      <input className="input" disabled={disabled} value={customer.name} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { name: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.honorific} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { honorific: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} type="number" step="0.01" value={customer.priceCoefficient} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { priceCoefficient: Number(event.target.value) })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.address} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { address: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.phone} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { phone: event.target.value })} />
                    </td>
                    <td>
                      <input className="input" disabled={disabled} value={customer.memo} onBlur={() => void persistCustomer(customer)} onChange={(event) => updateCustomer(customer.id, { memo: event.target.value })} />
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
                  <th>摘要</th>
                  <th>備考</th>
                  <th>施工</th>
                  <th>単位</th>
                  <th>材料単価</th>
                  <th>材料費</th>
                  <th>労務費</th>
                  <th>経費</th>
                  <th>複合単価</th>
                  <th>有効</th>
                </tr>
              </thead>
              <tbody>
                {data.priceItems.map((item) => (
                  <tr key={item.id}>
                    <td><input className="input" disabled={disabled} type="number" value={item.year} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { year: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.pageNo} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { pageNo: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} value={item.name} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { name: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} value={item.specification} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { specification: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} value={item.note} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { note: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} value={item.construction} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { construction: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} value={item.unit} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { unit: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.materialUnitPrice} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { materialUnitPrice: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.materialCost} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { materialCost: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.laborCost} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { laborCost: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.expense} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { expense: Number(event.target.value) })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={item.compositeUnitPrice} onBlur={() => void persistPrice(item)} onChange={(event) => updatePrice(item.id, { compositeUnitPrice: Number(event.target.value) })} /></td>
                    <td><input checked={item.active} disabled={disabled} type="checkbox" onChange={(event) => { const next = { ...item, active: event.target.checked }; updatePrice(item.id, { active: next.active }); void persistPrice(next); }} /></td>
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
                    <td><input className="input" disabled={disabled} value={category.name} onBlur={() => void persistCategory(category)} onChange={(event) => updateCategory(category.id, { name: event.target.value })} /></td>
                    <td><input className="input" disabled={disabled} type="number" value={category.sortOrder} onBlur={() => void persistCategory(category)} onChange={(event) => updateCategory(category.id, { sortOrder: Number(event.target.value) })} /></td>
                    <td><input checked={category.active} disabled={disabled} type="checkbox" onChange={(event) => { const next = { ...category, active: event.target.checked }; updateCategory(category.id, { active: next.active }); void persistCategory(next); }} /></td>
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
                  value={String(data.companySettings[key as keyof CompanySettings])}
                  onBlur={() => void persistCompanySettings(data.companySettings)}
                  onChange={(event) => updateCompanySettings({ [key]: event.target.value } as Partial<CompanySettings>)}
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
                onBlur={() => void persistCompanySettings(data.companySettings)}
                onChange={(event) => updateCompanySettings({ defaultExpenseRate: Number(event.target.value) })}
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
                    <td><span className="badge">{profile.role === "admin" ? "管理者" : "一般"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">ユーザー追加と権限変更はSupabase Authとprofilesテーブルで管理します。</p>
        </section>
      )}
    </>
  );
}
