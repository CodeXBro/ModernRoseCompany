"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

interface ProfitReport {
  startDate?: string;
  endDate?: string;
  date?: string;
  branchId: string;

  income: {
    cash: number;
    visa: number;
    online: number;
    other: number;
    total: number;
  };

  expenses: {
    general: number;
    flowerPurchases: number;
    total: number;
  };

  netProfit: number;
}

type ReportType = "daily" | "weekly" | "monthly" | "range";

export default function ReportsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  const [reportType, setReportType] = useState<ReportType>("daily");

  const [date, setDate] = useState("2026-09-30");

  const [startDate, setStartDate] = useState("2026-09-01");

  const [endDate, setEndDate] = useState("2026-09-30");

  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<ProfitReport | null>(null);

  const [loading, setLoading] = useState(false);

  const [downloading, setDownloading] = useState(false);

  function formatDate(dateValue: Date) {
    const year = dateValue.getFullYear();

    const month = String(dateValue.getMonth() + 1).padStart(2, "0");

    const day = String(dateValue.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getWeekDates() {
    const today = new Date();

    const day = today.getDay();

    const difference = day === 0 ? -6 : 1 - day;

    const monday = new Date(today);

    monday.setDate(today.getDate() + difference);

    const sunday = new Date(monday);

    sunday.setDate(monday.getDate() + 6);

    return {
      start: formatDate(monday),
      end: formatDate(sunday),
    };
  }

  function getMonthDates() {
    const today = new Date();

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return {
      start: formatDate(firstDay),
      end: formatDate(lastDay),
    };
  }

  async function fetchBranches() {
    try {
      const response = await fetch("/api/branches");

      const data = await response.json();

      if (data.success) {
        const activeBranches = data.branches.filter(
          (branch: Branch) => branch.isActive,
        );

        setBranches(activeBranches);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }

  async function fetchReport() {
    try {
      setLoading(true);

      let url = "";

      if (reportType === "daily") {
        if (!date) {
          alert("Please select a date");
          return;
        }

        url = `/api/reports/profit?date=${date}`;
      }

      if (reportType === "weekly") {
        const week = getWeekDates();

        url = `/api/reports/date-range?startDate=${week.start}&endDate=${week.end}`;
      }

      if (reportType === "monthly") {
        const month = getMonthDates();

        url = `/api/reports/date-range?startDate=${month.start}&endDate=${month.end}`;
      }

      if (reportType === "range") {
        if (!startDate || !endDate) {
          alert("Please select start and end dates");
          return;
        }

        if (startDate > endDate) {
          alert("Start date cannot be after end date");
          return;
        }

        url = `/api/reports/date-range?startDate=${startDate}&endDate=${endDate}`;
      }

      if (branchId) {
        url += `&branchId=${branchId}`;
      }

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to load report");

        return;
      }

      if (data.success) {
        setReport(data.report);
      }
    } catch (error) {
      console.error("Error fetching report:", error);

      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function getBranchName() {
    if (!branchId) {
      return "All Branches";
    }

    return branches.find((branch) => branch._id === branchId)?.name || "Branch";
  }

  function getReportTitle() {
    if (reportType === "daily") {
      return "Daily Financial Report";
    }

    if (reportType === "weekly") {
      return "Weekly Financial Report";
    }

    if (reportType === "monthly") {
      return "Monthly Financial Report";
    }

    return "Date Range Financial Report";
  }

  function getReportDateText() {
    if (reportType === "daily") {
      return report?.date || date;
    }

    if (report?.startDate && report?.endDate) {
      return `${report.startDate} to ${report.endDate}`;
    }

    if (reportType === "weekly") {
      const week = getWeekDates();

      return `${week.start} to ${week.end}`;
    }

    if (reportType === "monthly") {
      const month = getMonthDates();

      return `${month.start} to ${month.end}`;
    }

    return `${startDate} to ${endDate}`;
  }

  function printReport() {
    window.print();
  }

  async function downloadPDF() {
    if (!report) {
      alert("Report is not available");
      return;
    }

    try {
      setDownloading(true);

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();

      const money = (amount: number) => `AED ${amount.toFixed(2)}`;

      const branchName = getBranchName();

      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");

      pdf.text("Modern Rose", 20, 25);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");

      pdf.text(getReportTitle(), 20, 33);

      pdf.setFontSize(11);

      pdf.text(`Date: ${getReportDateText()}`, 20, 45);

      pdf.text(`Branch: ${branchName}`, 20, 52);

      pdf.line(20, 58, pageWidth - 20, 58);

      pdf.setFontSize(14);

      pdf.setFont("helvetica", "bold");

      pdf.text("Financial Summary", 20, 70);

      pdf.setFontSize(11);

      pdf.setFont("helvetica", "normal");

      pdf.text(`Total Income: ${money(report.income.total)}`, 25, 80);

      pdf.text(`Total Expenses: ${money(report.expenses.total)}`, 25, 88);

      pdf.text(`Net Profit: ${money(report.netProfit)}`, 25, 96);

      pdf.setFontSize(14);

      pdf.setFont("helvetica", "bold");

      pdf.text("Income Breakdown", 20, 112);

      pdf.setFontSize(11);

      pdf.setFont("helvetica", "normal");

      pdf.text(`Cash: ${money(report.income.cash)}`, 25, 122);

      pdf.text(`Visa Machine: ${money(report.income.visa)}`, 25, 130);

      pdf.text(`Online: ${money(report.income.online)}`, 25, 138);

      pdf.text(`Other: ${money(report.income.other)}`, 25, 146);

      pdf.text(`Total Income: ${money(report.income.total)}`, 25, 156);

      pdf.setFontSize(14);

      pdf.setFont("helvetica", "bold");

      pdf.text("Expense Breakdown", 20, 172);

      pdf.setFontSize(11);

      pdf.setFont("helvetica", "normal");

      pdf.text(`General Expenses: ${money(report.expenses.general)}`, 25, 182);

      pdf.text(
        `Flower Purchases: ${money(report.expenses.flowerPurchases)}`,
        25,
        190,
      );

      pdf.text(`Total Expenses: ${money(report.expenses.total)}`, 25, 200);

      pdf.line(20, 210, pageWidth - 20, 210);

      pdf.setFontSize(16);

      pdf.setFont("helvetica", "bold");

      pdf.text(`Net Profit: ${money(report.netProfit)}`, 20, 222);

      pdf.setFontSize(9);

      pdf.setFont("helvetica", "normal");

      pdf.text("Generated by Modern Rose Management System", 20, 280);

      const fileDate =
        reportType === "daily"
          ? report.date
          : `${report.startDate}-to-${report.endDate}`;

      pdf.save(`Modern-Rose-Report-${fileDate}-${branchName}.pdf`);
    } catch (error) {
      console.error("Error downloading PDF:", error);

      alert("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [reportType, date, startDate, endDate, branchId]);

  return (
    <main className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">Reports</h1>

          <p className="mt-1 text-gray-500">View income, expenses and profit</p>
        </div>

        {/* Filters */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 print:hidden">
          {/* Report Types */}
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setReportType("daily")}
              className={`rounded-lg px-5 py-3 text-sm font-medium ${
                reportType === "daily"
                  ? "bg-[#253d2f] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Daily
            </button>

            <button
              type="button"
              onClick={() => setReportType("weekly")}
              className={`rounded-lg px-5 py-3 text-sm font-medium ${
                reportType === "weekly"
                  ? "bg-[#253d2f] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Weekly
            </button>

            <button
              type="button"
              onClick={() => setReportType("monthly")}
              className={`rounded-lg px-5 py-3 text-sm font-medium ${
                reportType === "monthly"
                  ? "bg-[#253d2f] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setReportType("range")}
              className={`rounded-lg px-5 py-3 text-sm font-medium ${
                reportType === "range"
                  ? "bg-[#253d2f] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Date and Branch Filters */}
          <div className="grid gap-4 md:grid-cols-3">
            {reportType === "daily" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>

                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>
            )}

            {reportType === "range" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    End Date
                  </label>

                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Branch</label>

              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              >
                <option value="">All Branches</option>

                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="mt-5 rounded-lg bg-[#253d2f] px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>

        {/* Report */}
        {report && (
          <div id="report-content">
            {/* Report Header */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-2xl font-bold text-[#253d2f]">Modern Rose</h2>

              <p className="mt-1 text-gray-500">{getReportTitle()}</p>

              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {getReportDateText()}
                </p>

                <p>
                  <span className="font-medium">Branch:</span> {getBranchName()}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mb-6 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                onClick={printReport}
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Print Report
              </button>

              <button
                type="button"
                onClick={downloadPDF}
                disabled={downloading}
                className="rounded-lg bg-[#253d2f] px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {downloading ? "Creating PDF..." : "Download PDF"}
              </button>
            </div>

            {/* Summary */}
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-500">Total Income</p>

                <p className="mt-2 text-2xl font-bold text-[#253d2f]">
                  AED {report.income.total.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-500">Total Expenses</p>

                <p className="mt-2 text-2xl font-bold text-red-600">
                  AED {report.expenses.total.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-500">Net Profit</p>

                <p
                  className={`mt-2 text-2xl font-bold ${
                    report.netProfit >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  AED {report.netProfit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Income */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-6 text-lg font-semibold">Income Breakdown</h2>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cash</span>

                    <span className="font-medium">
                      AED {report.income.cash.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Visa Machine</span>

                    <span className="font-medium">
                      AED {report.income.visa.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Online</span>

                    <span className="font-medium">
                      AED {report.income.online.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Other</span>

                    <span className="font-medium">
                      AED {report.income.other.toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Income</span>

                      <span className="font-bold text-[#253d2f]">
                        AED {report.income.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-6 text-lg font-semibold">
                  Expense Breakdown
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">General Expenses</span>

                    <span className="font-medium">
                      AED {report.expenses.general.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Flower Purchases</span>

                    <span className="font-medium">
                      AED {report.expenses.flowerPurchases.toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Expenses</span>

                      <span className="font-bold text-red-600">
                        AED {report.expenses.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
