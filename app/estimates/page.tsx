"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import { formatCurrency, getDirectCost, getGrandTotal, getOverhead } from "@/lib/calculations";
import { supabase } from "@/lib/supabase/client";

export default function EstimatesPage() {
  const { data, setData, isAdmin, session } = useAppData();
  const [deletingEstimateId, setDeletingEstimateId] = useState<string | null>(null);
  const canDeleteEstimates = isAdmin || !supabase;

  const deleteEstimate = async (estimateId: string, estimateNo: string) => {
    if (!canDeleteEstimates) {
      window.alert("見積を削除できるのは管理者のみです。");
      return;
    }

    const confirmed = window.confirm(`見積番号「${estimateNo}」を削除しますか？\n削除した見積は元に戻せません。`);
    if (!confirmed) {
      return;
    }

    setDeletingEstimateId(estimateId);
    try {
      if (supabase && session) {
        const { error } = await supabase.from("estimates").delete().eq("id", estimateId);
        if (error) {
          window.alert(`見積の削除に失敗しました: ${error.message}`);
          return;
        }
      }

      setData((current) => ({
        ...current,
        estimates: current.estimates.filter((estimate) => estimate.id !== estimateId),
      }));
    } finally {
      setDeletingEstimateId(null);
    }
  };

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
                      {canDeleteEstimates && (
                        <button
                          className="button danger"
                          disabled={deletingEstimateId === estimate.id}
                          type="button"
                          onClick={() => void deleteEstimate(estimate.id, estimate.estimateNo)}
                        >
                          {deletingEstimateId === estimate.id ? "削除中" : "削除"}
                        </button>
                      )}
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
