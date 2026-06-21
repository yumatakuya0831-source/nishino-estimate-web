"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppData } from "@/components/app-provider";
import { formatCurrency, getCategoryTotal, getDirectCost, getGrandTotal, getOverhead } from "@/lib/calculations";

export function EstimatePreview({ estimateId }: { estimateId: string }) {
  const { data } = useAppData();
  const estimate = data.estimates.find((item) => item.id === estimateId);
  const visibleCategories = useMemo(() => {
    if (!estimate) {
      return [];
    }
    return data.workCategories.filter((category) => estimate.items.some((item) => item.workCategoryId === category.id));
  }, [data.workCategories, estimate]);

  if (!estimate) {
    return (
      <section className="panel">
        <h1>見積が見つかりません</h1>
        <Link className="button secondary" href="/estimates">
          見積一覧へ戻る
        </Link>
      </section>
    );
  }

  const today = new Date().toLocaleDateString("ja-JP");

  return (
    <>
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">帳票プレビュー</h1>
          <p className="page-subtitle">印刷ボタンから、鏡と内訳明細を1つのPDFとして保存できます。</p>
        </div>
        <div className="toolbar">
          <button className="button" type="button" onClick={() => window.print()}>
            印刷 / PDF保存
          </button>
          <Link className="button secondary" href={`/estimates/${estimate.id}`}>
            編集へ戻る
          </Link>
          <Link className="button secondary" href="/">
            メニューへ戻る
          </Link>
        </div>
      </div>

      <article className="estimate-paper">
        <section>
          <div className="paper-title">御　見　積　書</div>
          <div className="paper-grid">
            <div>
              <p>{today}</p>
              <h2>
                {estimate.customerNameSnapshot} {estimate.customerHonorificSnapshot}
              </h2>
              <p>下記の通り御見積致します。何卒御用命下さいます様お願い致します。</p>
              <table className="paper-table">
                <tbody>
                  <tr>
                    <th>金額</th>
                    <td>{formatCurrency(getGrandTotal(estimate))}</td>
                  </tr>
                  <tr>
                    <th>工事名称</th>
                    <td>{estimate.projectName}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <strong>{data.companySettings.companyName}</strong>
              <p>
                〒{data.companySettings.postalCode}
                <br />
                {data.companySettings.address}
              </p>
              <p>
                TEL {data.companySettings.tel}
                <br />
                FAX {data.companySettings.fax}
              </p>
              <table className="paper-table">
                <tbody>
                  <tr>
                    <th>支払条件</th>
                    <td>{estimate.paymentTerms}</td>
                  </tr>
                  <tr>
                    <th>有効期限</th>
                    <td>{estimate.validUntil || ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="paper-section">
            <table className="paper-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>仕様</th>
                  <th>数量</th>
                  <th>単位</th>
                  <th>単価</th>
                  <th>金額</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>別紙明細書通り</td>
                  <td />
                  <td className="numeric">1</td>
                  <td>式</td>
                  <td />
                  <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  <td />
                </tr>
                <tr>
                  <th colSpan={5}>合計</th>
                  <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  <td>消費税は別途申し受けます。</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="paper-section">
            <h2>内　訳　明　細　書</h2>
            <table className="paper-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>名称</th>
                  <th>数量</th>
                  <th>単位</th>
                  <th>金額</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {data.workCategories.map((category, index) => (
                  <tr key={category.id}>
                    <td>{index + 1}</td>
                    <td>{category.name}</td>
                    <td className="numeric">1</td>
                    <td>式</td>
                    <td className="numeric">{formatCurrency(getCategoryTotal(estimate, category.id))}</td>
                    <td />
                  </tr>
                ))}
                <tr>
                  <th colSpan={4}>直接工事費　計</th>
                  <td className="numeric">{formatCurrency(getDirectCost(estimate))}</td>
                  <td />
                </tr>
                <tr>
                  <th colSpan={4}>諸経費</th>
                  <td className="numeric">{formatCurrency(getOverhead(estimate))}</td>
                  <td>{estimate.expenseRate * 100}%</td>
                </tr>
                <tr>
                  <th colSpan={4}>合計</th>
                  <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {visibleCategories.map((category) => {
          const items = estimate.items.filter((item) => item.workCategoryId === category.id);
          return (
            <section className="paper-section" key={category.id}>
              <h2>内　訳　明　細　書</h2>
              <h3>{category.name}</h3>
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>仕様</th>
                    <th>数量</th>
                    <th>単位</th>
                    <th>単価</th>
                    <th>金額</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.specification}</td>
                      <td className="numeric">{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td className="numeric">{formatCurrency(item.unitPrice)}</td>
                      <td className="numeric">{formatCurrency(item.amount)}</td>
                      <td>{item.memo}</td>
                    </tr>
                  ))}
                  <tr>
                    <th colSpan={5}>計</th>
                    <td className="numeric">{formatCurrency(getCategoryTotal(estimate, category.id))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })}
      </article>
    </>
  );
}
