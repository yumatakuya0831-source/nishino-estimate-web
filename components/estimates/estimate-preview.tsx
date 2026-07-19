"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppData } from "@/components/app-provider";
import { getCategoryTotal, getDirectCost, getGrandTotal, getOverhead } from "@/lib/calculations";
import type { EstimateItem, WorkCategory } from "@/types/domain";

const DETAIL_BODY_ROWS = 20;

type DetailPage = {
  category: WorkCategory;
  items: EstimateItem[];
  pageNo: number;
  showCategoryHeader: boolean;
  showCategoryTotal: boolean;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatYen(value: number): string {
  return `¥${formatAmount(value)}`;
}

function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function EstimatePreview({ estimateId }: { estimateId: string }) {
  const { data } = useAppData();
  const estimate = data.estimates.find((item) => item.id === estimateId);
  const visibleCategories = useMemo(() => {
    if (!estimate) {
      return [];
    }
    return data.workCategories
      .filter((category) => estimate.items.some((item) => item.workCategoryId === category.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
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

  const today = formatReportDate(new Date());
  const safeFileName = (value: string) =>
    value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80);
  const safeSheetName = (value: string) => value.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "明細";
  const printEstimate = () => window.print();
  const savePdf = () => {
    const originalTitle = document.title;
    const estimateNo = safeFileName(estimate.estimateNo || "estimate");
    const customerName = safeFileName(estimate.customerNameSnapshot || "customer");

    document.title = `見積書_${estimateNo}_${customerName}`;
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const estimateNo = safeFileName(estimate.estimateNo || "estimate");
    const customerName = safeFileName(estimate.customerNameSnapshot || "customer");
    const workbook = XLSX.utils.book_new();

    const coverRows = [
      ["御 見 積 書"],
      [],
      ["見積番号", estimate.estimateNo],
      ["作成日", today],
      ["宛先", `${estimate.customerNameSnapshot} ${estimate.customerHonorificSnapshot}`.trim()],
      ["工事件名", estimate.projectName],
      ["支払条件", estimate.paymentTerms],
      ["有効期限", estimate.validUntil || ""],
      [],
      ["見積金額", getGrandTotal(estimate)],
      ["直接工事費", getDirectCost(estimate)],
      ["諸経費", getOverhead(estimate)],
      ["経費率", estimate.expenseRate],
      [],
      ["会社名", data.companySettings.companyName],
      ["郵便番号", data.companySettings.postalCode],
      ["住所", data.companySettings.address],
      ["TEL", data.companySettings.tel],
      ["FAX", data.companySettings.fax],
    ];
    const coverSheet = XLSX.utils.aoa_to_sheet(coverRows);
    coverSheet["!cols"] = [{ wch: 16 }, { wch: 42 }];
    coverSheet["B10"].z = "#,##0";
    coverSheet["B11"].z = "#,##0";
    coverSheet["B12"].z = "#,##0";
    coverSheet["B13"].z = "0.0%";
    XLSX.utils.book_append_sheet(workbook, coverSheet, "鏡");

    const summaryRows = [
      ["No.", "工種", "数量", "単位", "金額", "備考"],
      ...visibleCategories.map((category, index) => [
        index + 1,
        category.name,
        1,
        "式",
        getCategoryTotal(estimate, category.id),
        "",
      ]),
      [],
      ["", "直接工事費 計", "", "", getDirectCost(estimate), ""],
      ["", "諸経費", "", "", getOverhead(estimate), `${estimate.expenseRate * 100}%`],
      ["", "合計", "", "", getGrandTotal(estimate), ""],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 20 }];
    for (let row = 2; row <= summaryRows.length; row += 1) {
      const cell = summarySheet[`E${row}`];
      if (cell) {
        cell.z = "#,##0";
      }
    }
    XLSX.utils.book_append_sheet(workbook, summarySheet, "内訳集計");

    visibleCategories.forEach((category) => {
      const items = estimate.items.filter((item) => item.workCategoryId === category.id);
      const detailRows = [
        [category.name],
        [],
        ["名称", "摘要", "数量", "単位", "材料費", "労務費", "経費", "単価", "金額", "備考"],
        ...items.map((item) => [
          item.name,
          item.specification,
          item.quantity,
          item.unit,
          item.materialCost,
          item.laborCost,
          item.expense,
          item.unitPrice,
          item.amount,
          item.memo,
        ]),
        [],
        ["", "", "", "", "", "", "", "計", getCategoryTotal(estimate, category.id), ""],
      ];
      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet["!cols"] = [
        { wch: 28 },
        { wch: 28 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 24 },
      ];
      for (let row = 4; row <= detailRows.length; row += 1) {
        ["E", "F", "G", "H", "I"].forEach((column) => {
          const cell = detailSheet[`${column}${row}`];
          if (cell) {
            cell.z = "#,##0";
          }
        });
      }
      XLSX.utils.book_append_sheet(workbook, detailSheet, safeSheetName(category.name));
    });

    XLSX.writeFile(workbook, `見積書_${estimateNo}_${customerName}.xlsx`);
  };
  const detailPages: DetailPage[] = [];
  visibleCategories.forEach((category) => {
    const categoryItems = estimate.items
      .filter((item) => item.workCategoryId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    let offset = 0;
    let categoryPageIndex = 0;

    do {
      const showCategoryHeader = categoryPageIndex === 0;
      const availableRows = DETAIL_BODY_ROWS - (showCategoryHeader ? 1 : 0);
      const remaining = categoryItems.length - offset;
      const canFinishOnThisPage = remaining <= availableRows - 1;
      const itemCount = canFinishOnThisPage
        ? remaining
        : remaining === availableRows
          ? Math.max(availableRows - 1, 0)
          : availableRows;
      const pageItems = categoryItems.slice(offset, offset + itemCount);

      offset += itemCount;
      detailPages.push({
        category,
        items: pageItems,
        pageNo: detailPages.length + 2,
        showCategoryHeader,
        showCategoryTotal: offset >= categoryItems.length,
      });
      categoryPageIndex += 1;
    } while (offset < categoryItems.length);
  });
  const exportCsv = () => {
    const estimateNo = safeFileName(estimate.estimateNo || "estimate");
    const customerName = safeFileName(estimate.customerNameSnapshot || "customer");
    const headers = [
      "見積番号",
      "作成日",
      "顧客名",
      "敬称",
      "工事件名",
      "工種",
      "名称",
      "摘要",
      "数量",
      "単位",
      "材料費",
      "労務費",
      "経費",
      "単価",
      "金額",
      "備考",
    ];
    const rows = estimate.items.map((item) => {
      const category = data.workCategories.find((workCategory) => workCategory.id === item.workCategoryId);
      return [
        estimate.estimateNo,
        today,
        estimate.customerNameSnapshot,
        estimate.customerHonorificSnapshot,
        estimate.projectName,
        category?.name || "",
        item.name,
        item.specification,
        item.quantity,
        item.unit,
        item.materialCost,
        item.laborCost,
        item.expense,
        item.unitPrice,
        item.amount,
        item.memo,
      ];
    });
    rows.push([
      estimate.estimateNo,
      today,
      estimate.customerNameSnapshot,
      estimate.customerHonorificSnapshot,
      estimate.projectName,
      "合計",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      getGrandTotal(estimate),
      `直接工事費:${getDirectCost(estimate)} / 諸経費:${getOverhead(estimate)}`,
    ]);

    const escapeCsv = (value: string | number) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `見積書_${estimateNo}_${customerName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">帳票プレビュー</h1>
          <p className="page-subtitle">鏡と各種内訳明細を1つの帳票として印刷またはPDF保存できます。</p>
        </div>
        <div className="toolbar">
          <button className="button" type="button" onClick={printEstimate}>
            印刷
          </button>
          <button className="button" type="button" onClick={savePdf}>
            PDF保存
          </button>
          <button className="button secondary" type="button" onClick={exportExcel}>
            Excel出力
          </button>
          <button className="button secondary" type="button" onClick={exportCsv}>
            CSV出力
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
        <section className="print-page cover-page">
          <div className="paper-date">{today}</div>
          <h1 className="paper-title">御 見 積 書</h1>

          <div className="cover-grid">
            <div className="cover-left">
              <div className="customer-name">
                {estimate.customerNameSnapshot} {estimate.customerHonorificSnapshot}
              </div>
              <p className="cover-greeting">下記の通り御見積致します。何卒御用命下さいます様お願い致します。</p>
              <div className="estimate-total-line">
                <span>金額</span>
                <strong>{formatYen(getGrandTotal(estimate))}</strong>
              </div>
            </div>
            <div className="company-block">
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
            </div>
          </div>

          <table className="paper-table cover-info-table">
            <tbody>
              <tr>
                <th>工事名称</th>
                <td>{estimate.projectName}</td>
                <th>支払条件</th>
                <td>{estimate.paymentTerms}</td>
              </tr>
              <tr>
                <th>見積番号</th>
                <td>{estimate.estimateNo}</td>
                <th>有効期限</th>
                <td>{estimate.validUntil || ""}</td>
              </tr>
            </tbody>
          </table>

          <table className="paper-table estimate-lines-table cover-lines-table">
            <thead>
              <tr>
                <th className="col-no" />
                <th className="col-name">名 称</th>
                <th className="col-spec">仕 様</th>
                <th className="col-qty">数量</th>
                <th className="col-unit">単位</th>
                <th className="col-price">単 価</th>
                <th className="col-amount">金 額</th>
                <th className="col-memo">備 考</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td>別紙明細書通り</td>
                <td />
                <td className="numeric">1</td>
                <td>式</td>
                <td />
                <td className="numeric">{formatAmount(getGrandTotal(estimate))}</td>
                <td />
              </tr>
              {Array.from({ length: 7 }).map((_, index) => (
                <tr className="blank-row" key={`cover-blank-${index}`}>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
              <tr>
                <th colSpan={6}>合 計</th>
                <td className="numeric">{formatAmount(getGrandTotal(estimate))}</td>
                <td>消費税は別途申し受けます。</td>
              </tr>
            </tbody>
          </table>

          <h2 className="paper-subtitle">内 訳 明 細 書</h2>
          <table className="paper-table estimate-lines-table summary-lines-table">
            <thead>
              <tr>
                <th className="col-no" />
                <th className="col-name">名 称</th>
                <th className="col-spec">仕 様</th>
                <th className="col-qty">数量</th>
                <th className="col-unit">単位</th>
                <th className="col-price">単 価</th>
                <th className="col-amount">金 額</th>
                <th className="col-memo">備 考</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((category, index) => (
                <tr key={category.id}>
                  <td className="numeric">{index + 1}</td>
                  <td>{category.name}</td>
                  <td />
                  <td className="numeric">1</td>
                  <td>式</td>
                  <td />
                  <td className="numeric">{formatAmount(getCategoryTotal(estimate, category.id))}</td>
                  <td />
                </tr>
              ))}
              <tr>
                <th colSpan={6}>直接工事費 計</th>
                <td className="numeric">{formatAmount(getDirectCost(estimate))}</td>
                <td />
              </tr>
              <tr>
                <td />
                <td>諸経費</td>
                <td />
                <td className="numeric">1</td>
                <td>式</td>
                <td />
                <td className="numeric">{formatAmount(getOverhead(estimate))}</td>
                <td />
              </tr>
              <tr>
                <td />
                <td>法定福利費</td>
                <td />
                <td className="numeric">1</td>
                <td>式</td>
                <td />
                <td />
                <td />
              </tr>
              <tr>
                <th colSpan={6}>合 計</th>
                <td className="numeric">{formatAmount(getGrandTotal(estimate))}</td>
                <td />
              </tr>
            </tbody>
          </table>
          <div className="paper-page-number">№ 1</div>
        </section>

        {detailPages.map((detailPage) => {
          const blankRowCount =
            DETAIL_BODY_ROWS -
            (detailPage.showCategoryHeader ? 1 : 0) -
            detailPage.items.length -
            (detailPage.showCategoryTotal ? 1 : 0);
          return (
            <section className="print-page landscape-page" key={`${detailPage.category.id}-${detailPage.pageNo}`}>
              <h2 className="paper-subtitle">内 訳 明 細 書</h2>
              <table className="paper-table estimate-lines-table detail-lines-table">
                <thead>
                  <tr>
                    <th className="col-no" />
                    <th className="col-name">名 称</th>
                    <th className="col-spec">仕 様</th>
                    <th>数量</th>
                    <th>単位</th>
                    <th>単 価</th>
                    <th>金 額</th>
                    <th>備 考</th>
                  </tr>
                </thead>
                <tbody>
                  {detailPage.showCategoryHeader && (
                    <tr className="category-row">
                      <td className="numeric">{visibleCategories.findIndex((item) => item.id === detailPage.category.id) + 1}</td>
                      <td>{detailPage.category.name}</td>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  )}
                  {detailPage.items.map((item) => (
                    <tr key={item.id}>
                      <td />
                      <td>{item.name}</td>
                      <td>{item.specification}</td>
                      <td className="numeric">{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td className="numeric">{formatAmount(item.unitPrice)}</td>
                      <td className="numeric">{formatAmount(item.amount)}</td>
                      <td>{item.memo}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(blankRowCount, 0) }).map((_, index) => (
                    <tr className="blank-row" key={`blank-${detailPage.pageNo}-${index}`}>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  ))}
                  {detailPage.showCategoryTotal && (
                    <tr>
                      <th colSpan={6}>計</th>
                      <td className="numeric">{formatAmount(getCategoryTotal(estimate, detailPage.category.id))}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="paper-page-number">№ {detailPage.pageNo}</div>
            </section>
          );
        })}
      </article>
    </>
  );
}
