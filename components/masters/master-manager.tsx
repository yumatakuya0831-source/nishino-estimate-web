"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/app-provider";
import { supabase } from "@/lib/supabase/client";
import type { CompanySettings, Customer, PriceItem, Profile, UserRole, WorkCategory } from "@/types/domain";

type MasterTab = "customers" | "prices" | "categories" | "company" | "users";
type PriceActiveFilter = "all" | "active" | "inactive";

const PRICE_PAGE_SIZE = 50;

function toPriceItem(row: {
  id: string;
  year: number;
  page_no: number;
  name: string;
  specification: string;
  note: string;
  construction: string;
  unit: string;
  material_unit_price: number;
  material_cost: number;
  labor_cost: number;
  expense: number;
  composite_unit_price: number;
  active: boolean;
}): PriceItem {
  return {
    id: row.id,
    year: row.year,
    pageNo: row.page_no,
    name: row.name,
    specification: row.specification,
    note: row.note,
    construction: row.construction,
    unit: row.unit,
    materialUnitPrice: Number(row.material_unit_price),
    materialCost: Number(row.material_cost),
    laborCost: Number(row.labor_cost),
    expense: Number(row.expense),
    compositeUnitPrice: Number(row.composite_unit_price),
    active: row.active,
  };
}

export function MasterManager() {
  const { data, setData, isAdmin, dataLoading, dataLoadingLabel, session } = useAppData();
  const [tab, setTab] = useState<MasterTab>("customers");
  const [tabLoading, setTabLoading] = useState(false);
  const [tabLoadingLabel, setTabLoadingLabel] = useState("");
  const [priceSearch, setPriceSearch] = useState("");
  const [priceYearFilter, setPriceYearFilter] = useState("all");
  const [priceActiveFilter, setPriceActiveFilter] = useState<PriceActiveFilter>("active");
  const [pricePage, setPricePage] = useState(1);
  const [pricePageItems, setPricePageItems] = useState<PriceItem[]>([]);
  const [priceTotalCount, setPriceTotalCount] = useState(0);
  const [pricePageLoading, setPricePageLoading] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const disabled = !isAdmin;
  const priceYears = useMemo(
    () => Array.from(new Set(data.priceItems.map((item) => item.year))).sort((a, b) => b - a),
    [data.priceItems],
  );
  const localFilteredPriceItems = useMemo(() => {
    const keyword = priceSearch.trim().toLocaleLowerCase("ja-JP");

    return data.priceItems.filter((item) => {
      const matchesYear = priceYearFilter === "all" || item.year === Number(priceYearFilter);
      const matchesActive =
        priceActiveFilter === "all" ||
        (priceActiveFilter === "active" && item.active) ||
        (priceActiveFilter === "inactive" && !item.active);
      const targetText = [item.name, item.specification, item.note, item.construction, item.unit]
        .join(" ")
        .toLocaleLowerCase("ja-JP");
      const matchesKeyword = keyword === "" || targetText.includes(keyword);

      return matchesYear && matchesActive && matchesKeyword;
    });
  }, [data.priceItems, priceActiveFilter, priceSearch, priceYearFilter]);
  const localPricePageItems = useMemo(() => {
    const start = (pricePage - 1) * PRICE_PAGE_SIZE;
    return localFilteredPriceItems.slice(start, start + PRICE_PAGE_SIZE);
  }, [localFilteredPriceItems, pricePage]);
  const displayedPriceItems = supabase ? pricePageItems : localPricePageItems;
  const displayedPriceCount = supabase ? priceTotalCount : localFilteredPriceItems.length;
  const pricePageCount = Math.max(1, Math.ceil(displayedPriceCount / PRICE_PAGE_SIZE));

  useEffect(() => {
    setPricePage(1);
  }, [priceActiveFilter, priceSearch, priceYearFilter]);

  useEffect(() => {
    const client = supabase;
    if (!client || tab !== "prices") {
      return;
    }

    let cancelled = false;

    const loadPricePage = async () => {
      const keyword = priceSearch.trim().replace(/[%_,()]/g, " ");
      const from = (pricePage - 1) * PRICE_PAGE_SIZE;
      const to = from + PRICE_PAGE_SIZE - 1;

      setPricePageLoading(true);
      let query = client
        .from("price_items")
        .select(
          "id, year, page_no, name, specification, note, construction, unit, material_unit_price, material_cost, labor_cost, expense, composite_unit_price, active",
          { count: "exact" },
        )
        .order("year", { ascending: false })
        .order("page_no", { ascending: true })
        .range(from, to);

      if (priceYearFilter !== "all") {
        query = query.eq("year", Number(priceYearFilter));
      }
      if (priceActiveFilter !== "all") {
        query = query.eq("active", priceActiveFilter === "active");
      }
      if (keyword) {
        query = query.or(
          `name.ilike.%${keyword}%,specification.ilike.%${keyword}%,note.ilike.%${keyword}%,construction.ilike.%${keyword}%,unit.ilike.%${keyword}%`,
        );
      }

      const { data: rows, count, error } = await query;

      if (cancelled) {
        return;
      }

      if (error) {
        setMessage(`単価マスタの取得に失敗しました: ${error.message}`);
        setPricePageItems([]);
        setPriceTotalCount(0);
        setPricePageLoading(false);
        return;
      }

      setPricePageItems((rows || []).map(toPriceItem));
      setPriceTotalCount(count || 0);
      setPricePageLoading(false);
    };

    void loadPricePage();

    return () => {
      cancelled = true;
    };
  }, [priceActiveFilter, pricePage, priceSearch, priceYearFilter, tab]);

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

  const persistProfile = async (profile: Profile) => {
    if (!supabase || disabled) return false;
    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      name: profile.name,
      role: profile.role,
    });
    showResult("ユーザーマスタ", error);
    return !error;
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
    setPricePageItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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

  const updateProfile = (id: string, patch: Partial<Profile>) => {
    setData((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)),
    }));
  };

  const deleteProfile = async (profile: Profile) => {
    if (profile.id === session?.user.id) {
      setMessage("ログイン中のユーザーは削除できません。別の管理者でログインしてから削除してください。");
      return;
    }

    if (!window.confirm(`${profile.name} をユーザーマスタから削除しますか？`)) {
      return;
    }

    if (supabase) {
      const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
      if (error) {
        showResult("ユーザーマスタ", error);
        return;
      }
    }

    setData((current) => ({
      ...current,
      profiles: current.profiles.filter((item) => item.id !== profile.id),
    }));
    setEditingProfileId(null);
    setMessage("ユーザーマスタから削除しました。");
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
    setPricePageItems((current) => [item, ...current].slice(0, PRICE_PAGE_SIZE));
    setPriceTotalCount((current) => current + 1);
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
          <div className="grid cols-3" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>キーワード</label>
              <input
                className="input"
                placeholder="名称・摘要・備考・施工"
                value={priceSearch}
                onChange={(event) => setPriceSearch(event.target.value)}
              />
            </div>
            <div className="field">
              <label>年度</label>
              <select className="select" value={priceYearFilter} onChange={(event) => setPriceYearFilter(event.target.value)}>
                <option value="all">すべて</option>
                {priceYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>有効状態</label>
              <select
                className="select"
                value={priceActiveFilter}
                onChange={(event) => setPriceActiveFilter(event.target.value as PriceActiveFilter)}
              >
                <option value="active">有効のみ</option>
                <option value="inactive">無効のみ</option>
                <option value="all">すべて</option>
              </select>
            </div>
          </div>
          {pricePageLoading && (
            <div className="loading-box" role="status" aria-live="polite" style={{ marginBottom: 12 }}>
              <span className="loading-spinner" aria-hidden="true" />
              <div>
                <strong>単価マスタを取得しています</strong>
                <p className="muted">現在の条件に一致する単価をページ単位で読み込んでいます。</p>
              </div>
            </div>
          )}
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <p className="muted" style={{ margin: 0 }}>
              {displayedPriceCount.toLocaleString()}件中 {(displayedPriceCount === 0 ? 0 : (pricePage - 1) * PRICE_PAGE_SIZE + 1).toLocaleString()}
              -{Math.min(pricePage * PRICE_PAGE_SIZE, displayedPriceCount).toLocaleString()}件を表示
            </p>
            <div className="toolbar">
              <button
                className="button secondary"
                disabled={pricePageLoading || pricePage <= 1}
                type="button"
                onClick={() => setPricePage((current) => Math.max(1, current - 1))}
              >
                前へ
              </button>
              <span className="muted">
                {pricePage} / {pricePageCount}ページ
              </span>
              <button
                className="button secondary"
                disabled={pricePageLoading || pricePage >= pricePageCount}
                type="button"
                onClick={() => setPricePage((current) => Math.min(pricePageCount, current + 1))}
              >
                次へ
              </button>
            </div>
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
                {displayedPriceItems.map((item) => (
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
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((profile) => {
                  const isEditing = editingProfileId === profile.id;
                  return (
                    <tr key={profile.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="input"
                            disabled={disabled}
                            value={profile.name}
                            onChange={(event) => updateProfile(profile.id, { name: event.target.value })}
                          />
                        ) : (
                          profile.name
                        )}
                      </td>
                      <td>{profile.email || <span className="muted">Auth側で管理</span>}</td>
                      <td>
                        {isEditing ? (
                          <select
                            className="select"
                            disabled={disabled}
                            value={profile.role}
                            onChange={(event) => updateProfile(profile.id, { role: event.target.value as UserRole })}
                          >
                            <option value="admin">管理者</option>
                            <option value="user">一般</option>
                          </select>
                        ) : (
                          <span className="badge">{profile.role === "admin" ? "管理者" : "一般"}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="toolbar">
                            <button
                              className="button"
                              disabled={disabled}
                              type="button"
                              onClick={async () => {
                                const saved = await persistProfile(profile);
                                if (saved) {
                                  setEditingProfileId(null);
                                }
                              }}
                            >
                              保存
                            </button>
                            <button
                              className="button danger"
                              disabled={disabled || profile.id === session?.user.id}
                              type="button"
                              onClick={() => void deleteProfile(profile)}
                            >
                              削除
                            </button>
                          </div>
                        ) : (
                          <button className="button secondary" disabled={disabled} type="button" onClick={() => setEditingProfileId(profile.id)}>
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            名前と権限はこの画面で編集できます。ログイン用メールアドレスとAuthユーザー本体はSupabase Auth側で管理します。
          </p>
        </section>
      )}
    </>
  );
}
