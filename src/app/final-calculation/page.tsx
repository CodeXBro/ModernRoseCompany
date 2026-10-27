"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

type Branch = {
  _id?: string;
  id?: string;
  branchId?: string;
  name?: string;
  branchName?: string;
};

type Income = {
  cash?: number;
  visa?: number;
  online?: number;
  other?: number;
  total?: number;
};

type RecordCounts = {
  dailyEntries?: number;
  settlements?: number;
  partnerFundedPayments?: number;
};

type FinalCalculationReport = {
  month?: string;
  branchId?: string;
  income?: Income;
  settlements?: number;
  partnerFundedPayments?: number;
  finalBalance?: number;
  recordCounts?: RecordCounts;
};

type SessionData = {
  user?: {
    role?: string;
    branchId?: string | { _id?: string; id?: string };
    branch?: string | { _id?: string; id?: string };
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const numberValue = (value: unknown): number => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const monthLabel = (month: string) => {
  if (!month) return "";
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
};

const getBranchId = (branch: Branch) =>
  String(branch._id ?? branch.id ?? branch.branchId ?? "");

const getBranchLabel = (branch: Branch) =>
  branch.branchName ?? branch.name ?? "Unnamed Branch";

const getSessionBranchId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const item = value as { _id?: string; id?: string };
    return String(item._id ?? item.id ?? "");
  }
  return "";
};

const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function FinalCalculationPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [report, setReport] = useState<FinalCalculationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  const isEmployee = role.toLowerCase() === "employee";

  const branchName = useMemo(() => {
    if (selectedBranchId === "all") return "All Branches";

    const branch = branches.find(
      (item) => getBranchId(item) === selectedBranchId,
    );

    return branch ? getBranchLabel(branch) : "Selected Branch";
  }, [branches, selectedBranchId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [branchResponse, sessionResponse] = await Promise.all([
        fetch("/api/branches", { cache: "no-store" }),
        fetch("/api/auth/session", { cache: "no-store" }),
      ]);

      let branchList: Branch[] = [];
      if (branchResponse.ok) {
        const branchJson = await branchResponse.json();
        branchList = Array.isArray(branchJson)
          ? branchJson
          : Array.isArray(branchJson.branches)
            ? branchJson.branches
            : [];
      }

      let session: SessionData = {};
      if (sessionResponse.ok) {
        session = await sessionResponse.json();
      }

      const user = session.user;
      const currentRole = String(user?.role ?? "");
      setRole(currentRole);

      const employeeBranchId = getSessionBranchId(
        user?.branchId ?? user?.branch,
      );

      if (currentRole.toLowerCase() === "employee") {
        setSelectedBranchId(employeeBranchId);
      }

      setBranches(branchList);

      const branchToFetch =
        currentRole.toLowerCase() === "employee"
          ? employeeBranchId
          : selectedBranchId;

      const params = new URLSearchParams({ month });
      if (branchToFetch && branchToFetch !== "all") {
        params.set("branchId", branchToFetch);
      }

      const response = await fetch(
        `/api/reports/final-calculation?${params.toString()}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || result?.error || "Could not load the report.",
        );
      }

      setReport(result.report ?? result.data ?? result);
    } catch (err) {
      setReport(null);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the report.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, selectedBranchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const income = report?.income ?? {};
  const cashIncome = numberValue(income.cash);
  const visaIncome = numberValue(income.visa);
  const onlineIncome = numberValue(income.online);
  const otherIncome = numberValue(income.other);

  const totalIncome =
    income.total !== undefined
      ? numberValue(income.total)
      : cashIncome + visaIncome + onlineIncome + otherIncome;

  const settlements = numberValue(report?.settlements);
  const partnerFundedPayments = numberValue(report?.partnerFundedPayments);

  // Keep the existing custom formula unchanged.
  const calculatedBalance =
    totalIncome - settlements - partnerFundedPayments - cashIncome;

  const finalBalance =
    report?.finalBalance !== undefined
      ? numberValue(report.finalBalance)
      : calculatedBalance;

  const recordCounts = report?.recordCounts ?? {};

  const incomeRows = [
    { label: "Cash Income", value: cashIncome },
    { label: "Visa Machine", value: visaIncome },
    { label: "Online Income", value: onlineIncome },
    { label: "Other Income", value: otherIncome },
  ];

  const handleExportExcel = () => {
    if (!report) return;

    setExporting("excel");

    try {
      const summaryData = [
        ["MODERN ROSE", ""],
        ["FINAL CALCULATION REPORT", ""],
        ["Month", monthLabel(month)],
        ["Branch", branchName],
        [],
        ["FINANCIAL SUMMARY", "Amount (AED)"],
        ["Total Monthly Income", totalIncome],
        ["Monthly Settlements", settlements],
        ["Monthly Partner-Funded Payments", partnerFundedPayments],
        ["Monthly Cash Income", cashIncome],
        ["Final Balance", finalBalance],
        [],
        ["CALCULATION FORMULA", ""],
        [
          "Final Balance = Total Monthly Income - Monthly Settlements - Monthly Partner-Funded Payments - Monthly Cash Income",
          "",
        ],
        [],
        ["RECORD SUMMARY", "Count"],
        ["Daily Entries", numberValue(recordCounts.dailyEntries)],
        ["Settlements", numberValue(recordCounts.settlements)],
        [
          "Partner-Funded Payments",
          numberValue(recordCounts.partnerFundedPayments),
        ],
      ];

      const incomeData = [
        ["INCOME BREAKDOWN", "Amount (AED)"],
        ...incomeRows.map((row) => [row.label, row.value]),
        ["Total Monthly Income", totalIncome],
      ];

      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);

      summarySheet["!cols"] = [{ wch: 48 }, { wch: 28 }];
      incomeSheet["!cols"] = [{ wch: 28 }, { wch: 22 }];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Final Calculation");
      XLSX.utils.book_append_sheet(workbook, incomeSheet, "Income Breakdown");

      XLSX.writeFile(workbook, `Modern-Rose-Final-Calculation-${month}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = () => {
    if (!report) return;

    setExporting("pdf");

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const M = 15;
      const CW = W - M * 2;

      // Modern Rose restrained palette
      const forest: [number, number, number] = [38, 63, 52];
      const sage: [number, number, number] = [112, 137, 120];
      const pale: [number, number, number] = [241, 245, 241];
      const ink: [number, number, number] = [42, 48, 44];
      const muted: [number, number, number] = [116, 123, 117];
      const line: [number, number, number] = [222, 228, 222];
      const white: [number, number, number] = [255, 255, 255];

      const fill = (c: [number, number, number]) =>
        pdf.setFillColor(c[0], c[1], c[2]);

      const text = (c: [number, number, number]) =>
        pdf.setTextColor(c[0], c[1], c[2]);

      const stroke = (c: [number, number, number]) =>
        pdf.setDrawColor(c[0], c[1], c[2]);

      const safeMoney = (value: number) =>
        `AED ${Math.abs(value).toLocaleString("en-AE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      const displayAmount = (value: number) =>
        value < 0 ? `- ${safeMoney(value)}` : safeMoney(value);

      const sectionHeading = (label: string, y: number) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        text(forest);
        pdf.text(label.toUpperCase(), M, y);

        stroke(line);
        pdf.setLineWidth(0.35);
        pdf.line(M, y + 2.5, W - M, y + 2.5);
      };

      // Header: understated and consistent with the management system
      fill(forest);
      pdf.rect(0, 0, W, 31, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      text(white);
      pdf.text("MODERN ROSE", M, 13);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      text([220, 230, 222]);
      pdf.text("MONTHLY FINANCIAL REPORT", M, 20);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      text(white);
      pdf.text("FINAL CALCULATION", W - M, 12, { align: "right" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      text([220, 230, 222]);
      pdf.text(monthLabel(month), W - M, 18, { align: "right" });

      // Report metadata
      let y = 40;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      text(muted);
      pdf.text("REPORTING MONTH", M, y);
      pdf.text("BRANCH", W / 2 + 3, y);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      text(ink);
      pdf.text(monthLabel(month), M, y + 5);
      pdf.text(branchName, W / 2 + 3, y + 5);

      // Final balance panel
      y += 12;

      fill(pale);
      pdf.roundedRect(M, y, CW, 25, 2, 2, "F");

      fill(forest);
      pdf.rect(M, y, 2, 25, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      text(muted);
      pdf.text("FINAL BALANCE", M + 7, y + 8);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      text(forest);
      pdf.text(displayAmount(finalBalance), M + 7, y + 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      text(muted);
      pdf.text(
        finalBalance < 0 ? "Negative balance" : "Calculated monthly balance",
        W - M - 6,
        y + 17,
        { align: "right" },
      );

      y += 34;

      // Compact financial overview
      sectionHeading("Financial Overview", y);
      y += 7;

      const overview = [
        { label: "TOTAL INCOME", value: totalIncome },
        { label: "SETTLEMENTS", value: settlements },
        { label: "PARTNER-FUNDED", value: partnerFundedPayments },
      ];

      const gap = 4;
      const boxW = (CW - gap * 2) / 3;

      overview.forEach((item, i) => {
        const x = M + i * (boxW + gap);

        stroke(line);
        fill(white);
        pdf.roundedRect(x, y, boxW, 18, 1.5, 1.5, "FD");

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        text(muted);
        pdf.text(item.label, x + 3, y + 6);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        text(forest);
        pdf.text(safeMoney(item.value), x + 3, y + 13);
      });

      y += 26;

      // Compact income chart
      sectionHeading("Income Breakdown", y);
      y += 7;

      const incomeRows = [
        { label: "Cash Income", value: cashIncome },
        { label: "Visa Machine", value: visaIncome },
        { label: "Online Income", value: onlineIncome },
        { label: "Other Income", value: otherIncome },
      ];

      const chartX = M;
      const chartW = CW;
      const labelW = 31;
      const amountW = 32;
      const barX = chartX + labelW;
      const barW = chartW - labelW - amountW - 7;
      const maxIncome = Math.max(
        1,
        ...incomeRows.map((r) => Math.max(0, r.value)),
      );

      incomeRows.forEach((item, i) => {
        const rowY = y + i * 8;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        text(ink);
        pdf.text(item.label, chartX, rowY + 3.5);

        fill(pale);
        pdf.roundedRect(barX, rowY, barW, 3.5, 1, 1, "F");

        const width = Math.min(
          barW,
          (Math.max(0, item.value) / maxIncome) * barW,
        );

        if (width > 0) {
          fill(sage);
          pdf.roundedRect(barX, rowY, Math.max(width, 0.5), 3.5, 1, 1, "F");
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        text(ink);
        pdf.text(safeMoney(item.value), W - M, rowY + 3.5, {
          align: "right",
        });
      });

      y += incomeRows.length * 8 + 7;

      // Calculation table
      sectionHeading("Calculation Details", y);
      y += 6;

      const rows = [
        { label: "Total Monthly Income", value: totalIncome },
        { label: "Less: Monthly Settlements", value: -settlements },
        {
          label: "Less: Monthly Partner-Funded Payments",
          value: -partnerFundedPayments,
        },
        { label: "Less: Monthly Cash Income", value: -cashIncome },
      ];

      const tableRowH = 7.5;

      // Table heading
      fill(forest);
      pdf.rect(M, y, CW, 7, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      text(white);
      pdf.text("DESCRIPTION", M + 3, y + 4.7);
      pdf.text("AMOUNT", W - M - 3, y + 4.7, { align: "right" });

      y += 7;

      rows.forEach((row, i) => {
        if (i % 2 === 0) {
          fill(pale);
          pdf.rect(M, y, CW, tableRowH, "F");
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        text(ink);
        pdf.text(row.label, M + 3, y + 4.8);
        pdf.text(displayAmount(row.value), W - M - 3, y + 4.8, {
          align: "right",
        });

        stroke(line);
        pdf.setLineWidth(0.2);
        pdf.line(M, y + tableRowH, W - M, y + tableRowH);

        y += tableRowH;
      });

      y += 5;

      // Formula note
      fill(pale);
      pdf.roundedRect(M, y, CW, 14, 1.5, 1.5, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      text(forest);
      pdf.text("FORMULA", M + 3, y + 4.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.7);
      text(ink);
      pdf.text(
        "Income - Settlements - Partner-Funded Payments - Cash Income",
        M + 3,
        y + 9.5,
      );

      y += 20;

      // Record counts in one compact row
      sectionHeading("Record Summary", y);
      y += 7;

      const records = [
        {
          label: "Daily Entries",
          value: numberValue(recordCounts.dailyEntries),
        },
        {
          label: "Settlements",
          value: numberValue(recordCounts.settlements),
        },
        {
          label: "Partner-Funded Payments",
          value: numberValue(recordCounts.partnerFundedPayments),
        },
      ];

      const recordText = records
        .map((item) => `${item.label}: ${item.value}`)
        .join("     |     ");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      text(ink);

      const wrappedRecords = pdf.splitTextToSize(recordText, CW - 2);
      pdf.text(wrappedRecords, M, y);

      // Footer stays at the bottom of the single A4 page
      stroke(line);
      pdf.setLineWidth(0.35);
      pdf.line(M, H - 13, W - M, H - 13);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      text(muted);
      pdf.text("MODERN ROSE  |  FINAL CALCULATION", M, H - 8);
      pdf.text("AED", W - M, H - 8, { align: "right" });

      pdf.save(`Modern-Rose-Final-Calculation-${month}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      setError("PDF export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Modern Rose
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Final Calculation
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review monthly income, deductions and the final balance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPDF}
              disabled={!report || loading || exporting !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting === "pdf" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Export PDF
            </button>

            <button
              onClick={handleExportExcel}
              disabled={!report || loading || exporting !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting === "excel" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Report Filters</h2>
              <p className="text-xs text-slate-500">
                Choose the reporting month and branch.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Month
              </span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Branch
              </span>
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                disabled={isEmployee}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              >
                {!isEmployee && <option value="all">All Branches</option>}
                {branches.map((branch) => {
                  const id = getBranchId(branch);
                  if (!id) return null;

                  return (
                    <option key={id} value={id}>
                      {getBranchLabel(branch)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing:{" "}
              <span className="font-semibold text-slate-800">
                {monthLabel(month)}
              </span>
              {" · "}
              <span className="font-semibold text-slate-800">{branchName}</span>
            </p>

            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Unable to complete the request</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-emerald-800" />
              <p className="mt-3 text-sm text-slate-500">
                Loading final calculation...
              </p>
            </div>
          </div>
        ) : report ? (
          <>
            {/* Final balance */}
            <section className="relative overflow-hidden rounded-2xl bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-2 -top-8 h-40 w-40 rounded-full border border-white/10" />

              <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-emerald-100">
                    Final Balance
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    {money(finalBalance)}
                  </p>
                  <p className="mt-3 text-sm text-emerald-100">
                    {monthLabel(month)} · {branchName}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm text-emerald-50 sm:self-auto">
                  <CheckCircle2 className="h-4 w-4" />
                  Monthly summary
                </div>
              </div>
            </section>

            {/* Summary cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Total Monthly Income",
                  value: totalIncome,
                  icon: TrendingUp,
                  style: "bg-emerald-50 text-emerald-800",
                },
                {
                  title: "Monthly Settlements",
                  value: settlements,
                  icon: Wallet,
                  style: "bg-amber-50 text-amber-800",
                },
                {
                  title: "Partner-Funded Payments",
                  value: partnerFundedPayments,
                  icon: Building2,
                  style: "bg-sky-50 text-sky-800",
                },
                {
                  title: "Monthly Cash Income",
                  value: cashIncome,
                  icon: Banknote,
                  style: "bg-violet-50 text-violet-800",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-5 text-slate-500">
                        {card.title}
                      </p>
                      <div className={`rounded-xl p-2.5 ${card.style}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-xl font-bold tracking-tight text-slate-900">
                      {money(card.value)}
                    </p>
                  </div>
                );
              })}
            </section>

            {/* Income breakdown */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Income Breakdown
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Monthly income by payment method
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  {incomeRows.map((item, index) => {
                    const colors = [
                      "bg-emerald-700",
                      "bg-amber-500",
                      "bg-sky-600",
                      "bg-slate-400",
                    ];
                    const percentage =
                      totalIncome > 0
                        ? Math.max(0, (item.value / totalIncome) * 100)
                        : 0;

                    return (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-700">
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {money(item.value)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${colors[index]}`}
                            style={{
                              width: `${Math.min(100, percentage)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs text-slate-400">
                          {percentage.toFixed(1)}% of total income
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculation summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 sm:p-6">
                <h2 className="font-semibold text-slate-900">
                  Calculation Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  How the final balance is calculated
                </p>

                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-slate-600">
                      Total Monthly Income
                    </span>
                    <span className="text-right text-sm font-semibold text-emerald-800">
                      {money(totalIncome)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-slate-600">
                      Monthly Settlements
                    </span>
                    <span className="text-right text-sm font-semibold text-red-700">
                      − {money(settlements)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-slate-600">
                      Partner-Funded Payments
                    </span>
                    <span className="text-right text-sm font-semibold text-red-700">
                      − {money(partnerFundedPayments)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-slate-600">
                      Monthly Cash Income
                    </span>
                    <span className="text-right text-sm font-semibold text-red-700">
                      − {money(cashIncome)}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Final Balance
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {money(finalBalance)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs leading-5 text-slate-600">
                    Final Balance = Total Monthly Income − Monthly Settlements −
                    Monthly Partner-Funded Payments − Monthly Cash Income
                  </p>
                </div>
              </div>
            </section>

            {/* Record summary */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="font-semibold text-slate-900">
                  Monthly Record Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Number of records included in the report
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    label: "Daily Entries",
                    value: numberValue(recordCounts.dailyEntries),
                    icon: FileText,
                  },
                  {
                    label: "Settlements",
                    value: numberValue(recordCounts.settlements),
                    icon: CreditCard,
                  },
                  {
                    label: "Partner-Funded Payments",
                    value: numberValue(recordCounts.partnerFundedPayments),
                    icon: Globe,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="rounded-xl bg-white p-3 text-emerald-800 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{item.label}</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Export footer */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center">
              <p>
                Report: {monthLabel(month)} · {branchName}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={exporting !== null}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={exporting !== null}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Excel
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">
              No report available
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Try another month or refresh the report.
            </p>
            <button
              onClick={() => void loadData()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
