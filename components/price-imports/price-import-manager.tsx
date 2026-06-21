"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import { createPriceDiffs, parsePriceRowsFromText } from "@/lib/price-import/parser";

export function PriceImportManager() {
  const { data, setData, isAdmin } = useAppData();
  const [year, setYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState("");
  const latestBatch = data.priceImportBatches[0];

  const handleFile = async (file: File) => {
    if (!isAdmin) {
      setMessage("管理者のみPDF取込を実行できます。");
      return;
    }
    setMessage("PDFを解析しています。");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      const texts: string[] = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        texts.push(content.items.map((item) => ("str" in item ? item.str : "")).join("\n"));
      }
      const parsedItems = parsePriceRowsFromText(texts.join("\n"), year);
      const diffs = createPriceDiffs(data.priceItems, parsedItems);
      const batch = {
        id: crypto.randomUUID(),
        year,
        fileName: file.name,
        status: "parsed" as const,
        diffs,
        createdAt: new Date().toISOString(),
      };
      setData((current) => ({ ...current, priceImportBatches: [batch, ...current.priceImportBatches] }));
      setMessage(`${parsedItems.length}件を解析し、${diffs.length}件の差分候補を作成しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF解析に失敗しました。");
    }
  };

  const toggleDiff = (diffId: string, selected: boolean) => {
    if (!latestBatch) {
      return;
    }
    setData((current) => ({
      ...current,
      priceImportBatches: current.priceImportBatches.map((batch) =>
        batch.id === latestBatch.id
          ? { ...batch, diffs: batch.diffs.map((diff) => (diff.id === diffId ? { ...diff, selected } : diff)) }
          : batch,
      ),
    }));
  };

  const applySelected = () => {
    if (!latestBatch || !isAdmin) {
      return;
    }
    const selectedDiffs = latestBatch.diffs.filter((diff) => diff.selected);
    setData((current) => {
      let nextPrices = [...current.priceItems];
      for (const diff of selectedDiffs) {
        if (diff.diffType === "add") {
          nextPrices = [...nextPrices, diff.parsedData];
        }
        if (diff.diffType === "update" && diff.currentItemId) {
          nextPrices = nextPrices.map((item) => (item.id === diff.currentItemId ? { ...diff.parsedData, id: item.id } : item));
        }
      }
      return {
        ...current,
        priceItems: nextPrices,
        priceImportBatches: current.priceImportBatches.map((batch) =>
          batch.id === latestBatch.id ? { ...batch, status: "applied" } : batch,
        ),
      };
    });
    setMessage(`${selectedDiffs.length}件を単価マスタへ反映しました。`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">単価PDF取込</h1>
          <p className="page-subtitle">PDFを自動解析し、差分を確認してから単価マスタへ反映します。</p>
        </div>
        {!isAdmin && <span className="badge warn">管理者のみ実行可能</span>}
      </div>

      <section className="panel">
        <div className="grid cols-3">
          <div className="field">
            <label>対象年度</label>
            <input className="input" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>単価PDF</label>
            <input
              className="input"
              disabled={!isAdmin}
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />
          </div>
        </div>
        {message && <p>{message}</p>}
        <p className="muted">
          レイアウト変更に備え、読み取り信頼度が低い行は「不確実」として表示します。反映前に管理者が確認してください。
        </p>
      </section>

      {latestBatch && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2>差分確認</h2>
              <p className="muted">
                {latestBatch.fileName} / {latestBatch.status}
              </p>
            </div>
            <button className="button" disabled={!isAdmin || latestBatch.status === "applied"} type="button" onClick={applySelected}>
              選択項目を反映
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>反映</th>
                  <th>種別</th>
                  <th>信頼度</th>
                  <th>名称</th>
                  <th>仕様</th>
                  <th>材料費</th>
                  <th>労務費</th>
                  <th>経費</th>
                  <th>理由</th>
                </tr>
              </thead>
              <tbody>
                {latestBatch.diffs.map((diff) => (
                  <tr key={diff.id}>
                    <td>
                      <input
                        checked={diff.selected}
                        disabled={!isAdmin || latestBatch.status === "applied"}
                        type="checkbox"
                        onChange={(event) => toggleDiff(diff.id, event.target.checked)}
                      />
                    </td>
                    <td>
                      <span className={diff.diffType === "uncertain" ? "badge warn" : "badge ok"}>{diff.diffType}</span>
                    </td>
                    <td>{Math.round(diff.confidence * 100)}%</td>
                    <td>{diff.parsedData.name}</td>
                    <td>{diff.parsedData.specification}</td>
                    <td className="numeric">{diff.parsedData.materialCost.toLocaleString()}</td>
                    <td className="numeric">{diff.parsedData.laborCost.toLocaleString()}</td>
                    <td className="numeric">{diff.parsedData.expense.toLocaleString()}</td>
                    <td>{diff.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
