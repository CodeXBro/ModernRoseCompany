"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

type ReportType = "daily" | "weekly" | "monthly" | "custom";

type Branch = {
  _id: string;
  id?: string;
  name?: string;
  branchName?: string;
};

type ReportData = Record<string, any>;

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function getWeekDates(dateString: string) {
  const selected = new Date(`${dateString}T12:00:00`);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

function getMonthDates(dateString: string) {
  const selected = new Date(`${dateString}T12:00:00`);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

function formatMoney(value: unknown): string {
  const number = Number(value ?? 0);

  return `AED ${
    Number.isFinite(number)
      ? number.toLocaleString("en-AE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00"
  }`;
}

function getAmount(report: ReportData | null, keys: string[]): number {
  if (!report) return 0;

  const containers = [
    report,
    report.income,
    report.summary,
    report.totals,
    report.data,
    report.data?.income,
    report.report,
    report.report?.income,
    report.summary?.income,
    report.totals?.income,
  ];

  for (const container of containers) {
    if (!container || typeof container !== "object") continue;

    for (const key of keys) {
      const value = container[key];

      if (value === undefined || value === null || value === "") {
        continue;
      }

      const amount =
        typeof value === "object"
          ? (value.amount ?? value.value ?? value.total)
          : value;

      if (amount === undefined || amount === null || amount === "") {
        continue;
      }

      const number = Number(amount);

      if (Number.isFinite(number)) return number;
    }
  }

  return 0;
}

/**
 * Supports the daily API response:
 * report.expenses.flowerPurchases
 *
 * Also supports common date-range API response shapes.
 * General expenses are deliberately excluded.
 */
function getFlowerPurchases(report: ReportData | null): number {
  if (!report) return 0;

  const candidates = [
    report.expenses?.flowerPurchases,
    report.expenses?.purchases,
    report.flowerPurchases,
    report.totalPurchases,
    report.purchaseTotal,
    report.totalPurchase,
    report.summary?.flowerPurchases,
    report.summary?.totalPurchases,
    report.totals?.flowerPurchases,
    report.totals?.totalPurchases,
    report.data?.expenses?.flowerPurchases,
    report.data?.expenses?.purchases,
    report.data?.flowerPurchases,
    report.data?.totalPurchases,
    report.report?.expenses?.flowerPurchases,
    report.report?.expenses?.purchases,
    report.report?.flowerPurchases,
    report.report?.totalPurchases,
    report.report?.summary?.flowerPurchases,
    report.report?.totals?.flowerPurchases,
  ];

  for (const value of candidates) {
    if (value === undefined || value === null || value === "") continue;

    const amount =
      typeof value === "object"
        ? (value.amount ?? value.value ?? value.total)
        : value;

    if (amount === undefined || amount === null || amount === "") continue;

    const number = Number(amount);

    if (Number.isFinite(number)) return number;
  }

  return getAmount(report, [
    "flowerPurchaseTotal",
    "totalFlowerPurchases",
    "totalPurchases",
    "purchaseTotal",
    "totalPurchase",
  ]);
}

export default function ReportsPage() {
  const today = getToday();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchBranches() {
      setLoadingBranches(true);

      try {
        const response = await fetch("/api/branches", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load branches.");
        }

        const branchList = Array.isArray(data)
          ? data
          : (data.branches ?? data.data ?? []);

        if (!cancelled) {
          setBranches(Array.isArray(branchList) ? branchList : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Branch loading error:", err);
        }
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    }

    fetchBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchReport() {
    setError("");

    if (reportType !== "custom" && !isValidDateString(date)) {
      setError("Please select a valid date.");
      return;
    }

    if (reportType === "custom") {
      if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        setError("Please select valid start and end dates.");
        return;
      }

      if (startDate > endDate) {
        setError("Start date cannot be after end date.");
        return;
      }
    }

    setLoading(true);
    setReport(null);

    try {
      let url: string;

      if (reportType === "daily") {
        const params = new URLSearchParams();
        params.set("date", date);

        if (branchId) params.set("branchId", branchId);

        url = `/api/reports/profit?${params.toString()}`;
      } else {
        let rangeStart = startDate;
        let rangeEnd = endDate;

        if (reportType === "weekly") {
          const range = getWeekDates(date);
          rangeStart = range.start;
          rangeEnd = range.end;
        }

        if (reportType === "monthly") {
          const range = getMonthDates(date);
          rangeStart = range.start;
          rangeEnd = range.end;
        }

        if (!isValidDateString(rangeStart) || !isValidDateString(rangeEnd)) {
          throw new Error("Please select valid report dates.");
        }

        const params = new URLSearchParams();
        params.set("startDate", rangeStart);
        params.set("endDate", rangeEnd);

        if (branchId) params.set("branchId", branchId);

        url = `/api/reports/date-range?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to generate report.",
        );
      }

      const reportData = data.report ?? data.data ?? data.result ?? data;

      setReport(reportData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the report.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totalCash = getAmount(report, [
    "cash",
    "totalCash",
    "cashIncome",
    "incomeCash",
    "cashAmount",
  ]);

  const totalVisa = getAmount(report, [
    "visa",
    "totalVisa",
    "visaIncome",
    "incomeVisa",
    "visaAmount",
  ]);

  const totalOnline = getAmount(report, [
    "online",
    "totalOnline",
    "onlineIncome",
    "incomeOnline",
    "onlineAmount",
  ]);

  const totalOther = getAmount(report, [
    "other",
    "totalOther",
    "otherIncome",
    "incomeOther",
    "otherAmount",
  ]);

  const totalIncome = getAmount(report, [
    "totalIncome",
    "total",
    "incomeTotal",
    "totalSales",
    "grandTotal",
  ]);

  const totalPurchases = getFlowerPurchases(report);

  // Net profit = income minus flower purchases only.
  // General expenses are not deducted.
  const netProfit = totalIncome - totalPurchases;

  function getReportPeriod(): string {
    if (reportType === "daily") return date;

    if (reportType === "weekly") {
      const range = getWeekDates(date);
      return `${range.start} to ${range.end}`;
    }

    if (reportType === "monthly") {
      const range = getMonthDates(date);
      return `${range.start} to ${range.end}`;
    }

    return `${startDate} to ${endDate}`;
  }

  function getSelectedBranchName(): string {
    if (!branchId) return "All branches";

    const branch = branches.find((item) => (item._id ?? item.id) === branchId);

    return branch?.name ?? branch?.branchName ?? "Selected branch";
  }

  function downloadPDF() {
    if (!report) {
      setError("Please generate a report before downloading.");
      return;
    }

    setDownloading(true);

    try {
      const pdf = new jsPDF();

      pdf.setFontSize(18);
      pdf.text("Modern Rose - Financial Report", 14, 20);

      pdf.setFontSize(11);
      pdf.text(`Report type: ${reportType}`, 14, 32);
      pdf.text(`Period: ${getReportPeriod()}`, 14, 40);
      pdf.text(`Branch: ${getSelectedBranchName()}`, 14, 48);

      pdf.setFontSize(12);

      const rows = [
        ["Total income", formatMoney(totalIncome)],
        ["Cash income", formatMoney(totalCash)],
        ["Visa income", formatMoney(totalVisa)],
        ["Online income", formatMoney(totalOnline)],
        ["Other income", formatMoney(totalOther)],
        ["Flower purchases", formatMoney(totalPurchases)],
        ["Net profit", formatMoney(netProfit)],
      ];

      let y = 64;

      rows.forEach(([label, value]) => {
        pdf.text(label, 14, y);
        pdf.text(value, 196, y, { align: "right" });
        y += 10;
      });

      pdf.save(`modern-rose-report-${getToday()}.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
      setError("Could not create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function printReport() {
    if (!report) {
      setError("Please generate a report before printing.");
      return;
    }

    window.print();
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review income, flower purchases, and net profit.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={printReport}
            disabled={!report}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print
          </button>

          <button
            type="button"
            onClick={downloadPDF}
            disabled={!report || downloading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6 print:hidden">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Report filters
        </h2>

        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["custom", "Custom range"],
            ] as [ReportType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setReportType(value);
                setReport(null);
                setError("");
              }}
              className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                reportType === value
                  ? "border-green-700 bg-green-700 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {reportType !== "custom" && (
            <div>
              <label
                htmlFor="report-date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {reportType === "daily"
                  ? "Report date"
                  : reportType === "weekly"
                    ? "Choose a date in the week"
                    : "Choose a date in the month"}
              </label>

              <input
                id="report-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          )}

          {reportType === "custom" && (
            <>
              <div>
                <label
                  htmlFor="start-date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Start date
                </label>

                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label
                  htmlFor="end-date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  End date
                </label>

                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="branch"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Branch
            </label>

            <select
              id="branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              disabled={loadingBranches}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="">All branches</option>

              {branches.map((branch) => {
                const id = branch._id ?? branch.id ?? "";

                return (
                  <option key={id} value={id}>
                    {branch.name ?? branch.branchName ?? "Branch"}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="rounded-lg bg-green-700 px-5 py-2.5 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>

          <button
            type="button"
            onClick={() => {
              setReport(null);
              setError("");
            }}
            className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear report
          </button>
        </div>
      </section>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
          Generating report...
        </div>
      )}

      {!loading && report && (
        <section className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Financial summary
            </h2>

            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <p>Period: {getReportPeriod()}</p>
              <p>Branch: {getSelectedBranchName()}</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                title="Total income"
                amount={formatMoney(totalIncome)}
              />

              <SummaryCard
                title="Flower purchases"
                amount={formatMoney(totalPurchases)}
              />

              <SummaryCard title="Net profit" amount={formatMoney(netProfit)} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Income breakdown
            </h2>

            <div className="divide-y divide-gray-100">
              <BreakdownRow label="Cash" amount={formatMoney(totalCash)} />

              <BreakdownRow
                label="Visa machine"
                amount={formatMoney(totalVisa)}
              />

              <BreakdownRow label="Online" amount={formatMoney(totalOnline)} />

              <BreakdownRow
                label="Other income"
                amount={formatMoney(totalOther)}
              />

              <BreakdownRow
                label="Total income"
                amount={formatMoney(totalIncome)}
                strong
              />

              <BreakdownRow
                label="Flower purchases"
                amount={formatMoney(totalPurchases)}
              />

              <BreakdownRow
                label="Net profit"
                amount={formatMoney(netProfit)}
                strong
              />
            </div>
          </div>

          <details className="rounded-xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              View raw report data (for troubleshooting)
            </summary>

            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {!loading && !report && !error && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="font-semibold text-gray-800">No report generated</h2>

          <p className="mt-2 text-sm text-gray-500">
            Select your report filters and click Generate Report.
          </p>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ title, amount }: { title: string; amount: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 break-words text-xl font-bold text-gray-900">
        {amount}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span
        className={strong ? "font-semibold text-gray-900" : "text-gray-600"}
      >
        {label}
      </span>

      <span
        className={
          strong ? "font-bold text-gray-900" : "font-medium text-gray-800"
        }
      >
        {amount}
      </span>
    </div>
  );
}
