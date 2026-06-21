"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import { createPriceDiffs, parsePriceRowsFromSheetRows, parsePriceRowsFromText } from "@/lib/price-import/parser";
import { supabase } from "@/lib/supabase/client";
import type { PriceImportDiff, PriceItem } from "@/types/domain";

function toPriceRow(item: PriceItem) {
  return {
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
  };
}

async function insertDiffRows(batchId: string, diffs: PriceImportDiff[]) {
  if (!supabase || diffs.length === 0) {
    return null;
  }

  const chunkSize = 500;
  for (let index = 0; index < diffs.length; index += chunkSize) {
    const chunk = diffs.slice(index, index + chunkSize);
    const { error } = await supabase.from("price_import_diffs").insert(
      chunk.map((diff) => ({
        id: diff.id,
        batch_id: batchId,
        diff_type: diff.diffType,
        current_item_id: diff.currentItemId || null,
        parsed_data: diff.parsedData,
        selected: diff.selected,
        confidence: diff.confidence,
        reason: diff.reason,
      })),
    );

    if (error) {
      return error;
    }
  }

  return null;
}

export function PriceImportManager() {
  const { data, setData, isAdmin, session } = useAppData();
  const [year, setYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState("");
  const latestBatch = data.priceImportBatches[0];

  if (!isAdmin) {
    return (
      <section className="panel">
        <h1 className="page-title">権限がありません</h1>
        <p className="muted">単価取込は管理者のみ利用できます。</p>
      </section>
    );
  }

  const saveParsedItems = async (file: File, parsedItems: PriceItem[]) => {
    const currentItems = data.priceItems.filter((item) => item.year === year);
    const diffs = createPriceDiffs(currentItems, parsedItems);
    let batchId = crypto.randomUUID();

    if (supabase && session) {
      const { data: batchRow, error: batchError } = await supabase
        .from("price_import_batches")
        .insert({
          id: batchId,
          year,
          file_name: file.name,
          file_path: "",
          status: "parsed",
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (batchError) {
        setMessage(`取込履歴の保存に失敗しました: ${batchError.message}`);
        return;
      }

      batchId = batchRow.id;
      const diffError = await insertDiffRows(batchId, diffs);
      if (diffError) {
        setMessage(`差分データの保存に失敗しました: ${diffError.message}`);
        return;
      }
    }

    const batch = {
      id: batchId,
      year,
      fileName: file.name,
      status: "parsed" as const,
      diffs,
      createdAt: new Date().toISOString(),
    };

    const counts = {
      add: diffs.filter((diff) => diff.diffType === "add").length,
      update: diffs.filter((diff) => diff.diffType === "update").length,
      deleteCandidate: diffs.filter((diff) => diff.diffType === "delete_candidate").length,
      uncertain: diffs.filter((diff) => diff.diffType === "uncertain").length,
    };

    setData((current) => ({ ...current, priceImportBatches: [batch, ...current.priceImportBatches] }));
    setMessage(
      `${parsedItems.length}件を解析しました。追加${counts.add}件、更新${counts.update}件、削除候補${counts.deleteCandidate}件、確認${counts.uncertain}件です。`,
    );
  };

  const handlePdfFile = async (file: File) => {
    setMessage("PDFを解析しています。");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: buffer,
      cMapPacked: true,
      cMapUrl: "/cmaps/",
    }).promise;

    const texts: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      texts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }

    await saveParsedItems(file, parsePriceRowsFromText(texts.join("\n"), year));
  };

  const handleExcelFile = async (file: File) => {
    setMessage("Excelを解析しています。");
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames.includes("データベース") ? "データベース" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });

    await saveParsedItems(file, parsePriceRowsFromSheetRows(rows, year));
  };

  const handleFile = async (file: File) => {
    if (!isAdmin) {
      setMessage("管理者のみ単価取込を実行できます。");
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        await handleExcelFile(file);
        return;
      }

      if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        await handlePdfFile(file);
        return;
      }

      setMessage("PDF、xlsx、xls のいずれかを選択してください。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "単価取込に失敗しました。");
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

    if (supabase) {
      void supabase.from("price_import_diffs").update({ selected }).eq("id", diffId);
    }
  };

  const applySelected = async () => {
    if (!latestBatch || !isAdmin) {
      return;
    }

    const selectedDiffs = latestBatch.diffs.filter((diff) => diff.selected);
    if (selectedDiffs.length === 0) {
      setMessage("反映対象が選択されていません。");
      return;
    }

    if (supabase) {
      const upsertItems = selectedDiffs
        .filter((diff) => diff.diffType === "add" || diff.diffType === "update")
        .map((diff) => toPriceRow(diff.currentItemId ? { ...diff.parsedData, id: diff.currentItemId } : diff.parsedData));

      if (upsertItems.length > 0) {
        const { error } = await supabase.from("price_items").upsert(upsertItems);
        if (error) {
          setMessage(`単価マスタへの反映に失敗しました: ${error.message}`);
          return;
        }
      }

      const deleteIds = selectedDiffs
        .filter((diff) => diff.diffType === "delete_candidate" && diff.currentItemId)
        .map((diff) => diff.currentItemId as string);

      if (deleteIds.length > 0) {
        const { error } = await supabase.from("price_items").update({ active: false, updated_at: new Date().toISOString() }).in("id", deleteIds);
        if (error) {
          setMessage(`削除候補の反映に失敗しました: ${error.message}`);
          return;
        }
      }

      await supabase.from("price_import_batches").update({ status: "applied" }).eq("id", latestBatch.id);
    }

    setData((current) => {
      let nextPrices = [...current.priceItems];
      for (const diff of selectedDiffs) {
        if (diff.diffType === "add") {
          nextPrices = [...nextPrices, diff.parsedData];
        }
        if (diff.diffType === "update" && diff.currentItemId) {
          nextPrices = nextPrices.map((item) => (item.id === diff.currentItemId ? { ...diff.parsedData, id: item.id } : item));
        }
        if (diff.diffType === "delete_candidate" && diff.currentItemId) {
          nextPrices = nextPrices.map((item) => (item.id === diff.currentItemId ? { ...item, active: false } : item));
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
          <h1 className="page-title">単価取込</h1>
          <p className="page-subtitle">ExcelまたはPDFをDB上の単価マスタと比較し、差分を確認してから反映します。</p>
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
            <label>単価ファイル</label>
            <input
              className="input"
              disabled={!isAdmin}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />
          </div>
        </div>
        {message && <p className={message.includes("失敗") ? "error-text" : "muted"}>{message}</p>}
        <p className="muted">Excelは「データベース」シートを優先して読み込みます。削除候補は実削除せず、単価マスタを無効化します。</p>
      </section>

      {latestBatch && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2>差分確認</h2>
              <p className="muted">
                {latestBatch.fileName} / {latestBatch.status} / {latestBatch.diffs.length}件
              </p>
            </div>
            <button className="button" disabled={!isAdmin || latestBatch.status === "applied"} type="button" onClick={() => void applySelected()}>
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
                  <th>摘要</th>
                  <th>備考</th>
                  <th>施工</th>
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
                      <span className={diff.diffType === "uncertain" || diff.diffType === "delete_candidate" ? "badge warn" : "badge ok"}>
                        {diff.diffType}
                      </span>
                    </td>
                    <td>{Math.round(diff.confidence * 100)}%</td>
                    <td>{diff.parsedData.name}</td>
                    <td>{diff.parsedData.specification}</td>
                    <td>{diff.parsedData.note}</td>
                    <td>{diff.parsedData.construction}</td>
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
