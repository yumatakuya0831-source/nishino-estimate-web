"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppData } from "@/lib/store";
import { loadData, resetData, saveData } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { CompanySettings, Customer, Estimate, PriceItem, Profile, WorkCategory } from "@/types/domain";

type AppContextValue = {
  data: AppData;
  setData: (updater: AppData | ((current: AppData) => AppData)) => void;
  reset: () => void;
  isAdmin: boolean;
  session: Session | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => loadData());
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      const { data: sessionData } = await client.auth.getSession();
      if (!cancelled) {
        setSession(sessionData.session);
        setAuthLoading(false);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !session?.user) {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      const { data: row } = await client
        .from("profiles")
        .select("id, name, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      const profile: Profile = {
        id: session.user.id,
        name: row?.name || session.user.email || "ログインユーザー",
        email: session.user.email || "",
        role: row?.role === "admin" ? "admin" : "user",
      };

      setDataState((current) => {
        const otherProfiles = current.profiles.filter((item) => item.id !== profile.id);
        return {
          ...current,
          activeProfileId: profile.id,
          profiles: [profile, ...otherProfiles],
        };
      });
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const client = supabase;
    if (!client || !session) {
      return;
    }

    let cancelled = false;

    const loadPriceItems = async () => {
      const [{ data: customerRows, error: customersError }, { data: categoryRows, error: categoriesError }, { data: companyRows, error: companyError }] =
        await Promise.all([
          client
            .from("customers")
            .select("id, name, honorific, price_coefficient, address, phone, memo")
            .order("created_at", { ascending: true }),
          client.from("work_categories").select("id, name, sort_order, active").order("sort_order", { ascending: true }),
          client
            .from("company_settings")
            .select("id, company_name, postal_code, address, tel, fax, default_expense_rate, estimate_number_pattern")
            .limit(1),
        ]);

      if (customersError) {
        console.error("Failed to load customers from Supabase", customersError);
      }
      if (categoriesError) {
        console.error("Failed to load work categories from Supabase", categoriesError);
      }
      if (companyError) {
        console.error("Failed to load company settings from Supabase", companyError);
      }

      const loadedCustomers: Customer[] =
        customerRows?.map((row) => ({
          id: row.id,
          name: row.name,
          honorific: row.honorific,
          priceCoefficient: Number(row.price_coefficient),
          address: row.address,
          phone: row.phone,
          memo: row.memo,
        })) || [];

      const loadedCategories: WorkCategory[] =
        categoryRows?.map((row) => ({
          id: row.id as WorkCategory["id"],
          name: row.name,
          sortOrder: row.sort_order,
          active: row.active,
        })) || [];

      const loadedCompanySettings: CompanySettings | null = companyRows?.[0]
        ? {
            id: companyRows[0].id,
            companyName: companyRows[0].company_name,
            postalCode: companyRows[0].postal_code,
            address: companyRows[0].address,
            tel: companyRows[0].tel,
            fax: companyRows[0].fax,
            defaultExpenseRate: Number(companyRows[0].default_expense_rate),
            estimateNumberPattern: companyRows[0].estimate_number_pattern,
          }
        : null;

      const [{ data: estimateRows, error: estimatesError }, { data: estimateItemRows, error: estimateItemsError }] =
        await Promise.all([
          client
            .from("estimates")
            .select(
              "id, estimate_no, customer_id, customer_name_snapshot, customer_honorific_snapshot, price_coefficient_snapshot, project_name, payment_terms, valid_until, expense_rate, status, created_at, updated_at",
            )
            .order("updated_at", { ascending: false }),
          client
            .from("estimate_items")
            .select(
              "id, estimate_id, work_category_id, price_item_id, name, specification, quantity, unit, material_cost, labor_cost, expense, unit_price, amount, memo, sort_order",
            )
            .order("sort_order", { ascending: true }),
        ]);

      if (estimatesError) {
        console.error("Failed to load estimates from Supabase", estimatesError);
      }
      if (estimateItemsError) {
        console.error("Failed to load estimate items from Supabase", estimateItemsError);
      }

      const loadedEstimates: Estimate[] =
        estimateRows?.map((row) => ({
          id: row.id,
          estimateNo: row.estimate_no,
          customerId: row.customer_id || "",
          customerNameSnapshot: row.customer_name_snapshot,
          customerHonorificSnapshot: row.customer_honorific_snapshot,
          priceCoefficientSnapshot: Number(row.price_coefficient_snapshot),
          projectName: row.project_name,
          paymentTerms: row.payment_terms,
          validUntil: row.valid_until || "",
          expenseRate: Number(row.expense_rate),
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          items:
            estimateItemRows
              ?.filter((itemRow) => itemRow.estimate_id === row.id)
              .map((itemRow) => ({
                id: itemRow.id,
                workCategoryId: itemRow.work_category_id,
                priceItemId: itemRow.price_item_id || undefined,
                name: itemRow.name,
                specification: itemRow.specification,
                quantity: Number(itemRow.quantity),
                unit: itemRow.unit,
                materialCost: Number(itemRow.material_cost),
                laborCost: Number(itemRow.labor_cost),
                expense: Number(itemRow.expense),
                unitPrice: Number(itemRow.unit_price),
                amount: Number(itemRow.amount),
                memo: itemRow.memo,
                sortOrder: itemRow.sort_order,
              })) || [],
        })) || [];

      const pageSize = 1000;
      const loadedItems: PriceItem[] = [];

      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data: rows, error } = await client
          .from("price_items")
          .select(
            "id, year, page_no, name, specification, note, construction, unit, material_unit_price, material_cost, labor_cost, expense, composite_unit_price, active",
          )
          .order("year", { ascending: false })
          .order("page_no", { ascending: true })
          .range(from, to);

        if (error) {
          console.error("Failed to load price items from Supabase", error);
          return;
        }

        if (!rows || rows.length === 0) {
          break;
        }

        loadedItems.push(
          ...rows.map((row) => ({
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
          })),
        );

        if (rows.length < pageSize) {
          break;
        }
      }

      if (!cancelled) {
        setDataState((current) => ({
          ...current,
          customers: loadedCustomers.length > 0 ? loadedCustomers : current.customers,
          workCategories: loadedCategories.length > 0 ? loadedCategories : current.workCategories,
          companySettings: loadedCompanySettings || current.companySettings,
          estimates: loadedEstimates.length > 0 ? loadedEstimates : current.estimates,
          priceItems: loadedItems.length > 0 ? loadedItems : current.priceItems,
        }));
      }
    };

    void loadPriceItems();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const setData = (updater: AppData | ((current: AppData) => AppData)) => {
    setDataState((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId);
  const signOut = async () => {
    await supabase?.auth.signOut();
    setSession(null);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      setData,
      reset: () => setDataState(resetData()),
      isAdmin: activeProfile?.role === "admin",
      session,
      authLoading,
      signOut,
    }),
    [activeProfile?.role, authLoading, data, session],
  );

  if (authLoading) {
    return <AuthStatusPanel title="ログイン状態を確認しています" />;
  }

  if (supabase && !session) {
    return <AuthGate />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppProvider");
  }
  return context;
}

function AuthStatusPanel({ title }: { title: string }) {
  return (
    <section className="auth-card">
      <h1>{title}</h1>
      <p className="muted">Supabase Auth の状態を確認しています。</p>
    </section>
  );
}

function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    }

    setSubmitting(false);
  };

  return (
    <section className="auth-card">
      <h1>ログイン</h1>
      <p className="muted">登録済みのメールアドレスとパスワードでログインしてください。</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>メールアドレス</label>
          <input
            className="input"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>パスワード</label>
          <input
            className="input"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {message && <p className="error-text">{message}</p>}
        <button className="button" disabled={submitting} type="submit">
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </section>
  );
}
