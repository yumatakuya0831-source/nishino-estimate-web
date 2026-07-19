"use client";

import Link from "next/link";
import { FilePlus2, FolderKanban, Printer, Settings, Upload } from "lucide-react";
import { useAppData } from "@/components/app-provider";
import { formatCurrency, getGrandTotal } from "@/lib/calculations";

export default function HomePage() {
  const { data, isAdmin, signOut } = useAppData();
  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId);
  const latestEstimates = [...data.estimates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">ホーム</h1>
          <p className="page-subtitle">見積作成、閲覧、印刷を行います。</p>
        </div>
        <div className="toolbar">
          <span className="badge">{activeProfile?.email || activeProfile?.name}</span>
          <button className="button secondary" type="button" onClick={() => void signOut()}>
            ログアウト
          </button>
        </div>
      </div>

      <div className={isAdmin ? "grid cols-3" : "grid cols-2"}>
        <Link className="panel" href="/estimates/new">
          <FilePlus2 />
          <h2>新規見積</h2>
          <p className="muted">顧客を選択し、工種別の明細を作成します。</p>
        </Link>
        <Link className="panel" href="/estimates">
          <FolderKanban />
          <h2>見積一覧</h2>
          <p className="muted">保存済み見積を編集、閲覧します。</p>
        </Link>
        {isAdmin && (
          <Link className="panel" href="/price-imports">
            <Upload />
            <h2>単価取込</h2>
            <p className="muted">単価データを読み込み、既存マスタとの差分を確認します。</p>
          </Link>
        )}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>現在の権限</h2>
          <p className="summary-number">{isAdmin ? "管理者" : "一般ユーザー"}</p>
          <p className="muted">{isAdmin ? "全ての機能を利用できます。" : "見積作成と閲覧を利用できます。"}</p>
        </section>
        <section className="panel">
          <h2>主要操作</h2>
          <div className="toolbar">
            {isAdmin && (
              <Link className="button secondary" href="/masters">
                <Settings size={18} />
                マスタ管理
              </Link>
            )}
            <Link className="button secondary" href="/estimates/estimate-demo/preview">
              <Printer size={18} />
              帳票プレビュー
            </Link>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>最近の見積</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>見積番号</th>
                <th>顧客</th>
                <th>工事件名</th>
                <th>総額</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {latestEstimates.map((estimate) => (
                <tr key={estimate.id}>
                  <td>{estimate.estimateNo}</td>
                  <td>{estimate.customerNameSnapshot}</td>
                  <td>{estimate.projectName}</td>
                  <td className="numeric">{formatCurrency(getGrandTotal(estimate))}</td>
                  <td>
                    <span className="badge">{estimate.status === "draft" ? "下書き" : "発行済み"}</span>
                  </td>
                  <td>
                    <Link className="button secondary" href={`/estimates/${estimate.id}`}>
                      編集
                    </Link>
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
