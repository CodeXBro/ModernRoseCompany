"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  Globe,
  TrendingUp,
  Receipt,
  Wallet,
} from "lucide-react";

interface DashboardData {
  date: string;

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

  branchPerformance: {
    branchId: string;
    branchName: string;
    income: number;
    expenses: number;
    profit: number;
  }[];
}

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

export default function DashboardPage() {
  const [date, setDate] = useState("2026-09-30");

  const [branchId, setBranchId] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);

  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [date, branchId]);

  async function loadBranches() {
    try {
      const response = await fetch("/api/branches");

      const result = await response.json();

      if (result.success) {
        setBranches(result.branches || []);
      }
    } catch (error) {
      console.error("Error loading branches:", error);
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      let url = `/api/dashboard?date=${date}`;

      if (branchId) {
        url += `&branchId=${branchId}`;
      }

      const response = await fetch(url);

      const result = await response.json();

      if (result.success) {
        setData(result.dashboard);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(amount: number) {
    return `AED ${amount.toFixed(2)}`;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

            <p className="mt-1 text-gray-500">
              Overview of your flower business
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Date */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-[#253d2f]"
            />

            {/* Branch */}
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-[#253d2f]"
            >
              <option value="">All Branches</option>

              {branches
                .filter((branch) => branch.isActive)
                .map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Income */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today&apos;s Income</p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {loading
                    ? "Loading..."
                    : formatMoney(data?.income.total || 0)}
                </h2>
              </div>

              <div className="rounded-lg bg-[#eef4f0] p-3 text-[#253d2f]">
                <TrendingUp size={22} />
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today&apos;s Expenses</p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {loading
                    ? "Loading..."
                    : formatMoney(data?.expenses.total || 0)}
                </h2>
              </div>

              <div className="rounded-lg bg-red-50 p-3 text-red-600">
                <Receipt size={22} />
              </div>
            </div>
          </div>

          {/* Profit */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today&apos;s Profit</p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {loading ? "Loading..." : formatMoney(data?.netProfit || 0)}
                </h2>
              </div>

              <div className="rounded-lg bg-green-50 p-3 text-green-600">
                <Wallet size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* Income Breakdown */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Income Breakdown
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Income received through different payment methods
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {/* Cash */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <Banknote size={20} className="text-[#253d2f]" />

                <span className="text-sm text-gray-500">Cash</span>
              </div>

              <p className="mt-3 text-xl font-semibold">
                {formatMoney(data?.income.cash || 0)}
              </p>
            </div>

            {/* Visa */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-[#253d2f]" />

                <span className="text-sm text-gray-500">Visa Machine</span>
              </div>

              <p className="mt-3 text-xl font-semibold">
                {formatMoney(data?.income.visa || 0)}
              </p>
            </div>

            {/* Online */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-[#253d2f]" />

                <span className="text-sm text-gray-500">Online</span>
              </div>

              <p className="mt-3 text-xl font-semibold">
                {formatMoney(data?.income.online || 0)}
              </p>
            </div>

            {/* Other */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <Wallet size={20} className="text-[#253d2f]" />

                <span className="text-sm text-gray-500">Other</span>
              </div>

              <p className="mt-3 text-xl font-semibold">
                {formatMoney(data?.income.other || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Expense Breakdown
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Expenses recorded for the selected date
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* General Expenses */}
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">General Expenses</p>

              <p className="mt-2 text-xl font-semibold">
                {formatMoney(data?.expenses.general || 0)}
              </p>
            </div>

            {/* Flower Purchases */}
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Flower Purchases</p>

              <p className="mt-2 text-xl font-semibold">
                {formatMoney(data?.expenses.flowerPurchases || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Branch Performance */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Branch Performance
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Daily performance by branch
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-center text-gray-500">
              Loading branch performance...
            </div>
          ) : data?.branchPerformance && data.branchPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                      Branch
                    </th>

                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                      Income
                    </th>

                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                      Expenses
                    </th>

                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                      Profit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.branchPerformance.map((branch) => (
                    <tr
                      key={branch.branchId}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {branch.branchName}
                      </td>

                      <td className="px-4 py-4 text-right text-gray-700">
                        {formatMoney(branch.income)}
                      </td>

                      <td className="px-4 py-4 text-right text-gray-700">
                        {formatMoney(branch.expenses)}
                      </td>

                      <td
                        className={`px-4 py-4 text-right font-semibold ${
                          branch.profit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatMoney(branch.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-gray-500">
              No branch data available for this date.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
