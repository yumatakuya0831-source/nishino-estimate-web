"use client";

import Link from "next/link";
import { useAppData } from "@/components/app-provider";
import { formatCurrency, getDirectCost, getGrandTotal, getOverhead } from "@/lib/calculations";

export default function EstimatesPage() {
  const { data } = useAppData();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">見積一覧</h1>
          <p className="page-subtitle">見積の編集、閲覧、印刷用プレビューを行います。</p>
        </div>
        <Link className="button" href="/estimates/new">
          新規見積
        </Link>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>見積番号</th>
                <th>顧客</th>
                <th>工事件名</th>
                <th>直接工事費</th>
                <th>諸経費</th>
                <th>総額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.estimates.map((estimate) => (
                <tr key={estimate.id}>
                  <td>{estimate.estimateNo}</td>
                  <td>{estimate.customerNameSnapshot}</td>
                  <td>{estimate.projectName}</td>
                  <td className="numeric">{formatCurrency(getDirectCost(estimate))}</td>
                  <td className="numeric">{formatCurrency(getOverhead(estimate))}</td>
                  <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  <td>
                    <div className="toolbar">
                      <Link className="button secondary" href={`/estimates/${estimate.id}`}>
                        編集
                      </Link>
                      <Link className="button secondary" href={`/estimates/${estimate.id}/preview`}>
                        印刷/PDF
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
