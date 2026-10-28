"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Banknote,
  CreditCard,
  Globe,
  TrendingUp,
  Receipt,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardData {
  date: string;
  period?: {
    month?: string;
    startDate?: string;
    endDate?: string;
  };
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
    cash?: number;
    visa?: number;
    online?: number;
    other?: number;
    expenses: number;
    generalExpenses?: number;
    flowerPurchases?: number;
    profit: number;
  }[];
}

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

interface UserSession {
  user?: {
    name?: string;
    email?: string;
    role?: string;
    branchId?: string;
  };
}

function getUaeDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getPeriodLabel(date: string) {
  if (date) {
    const [year, month, day] = date.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);

    return selectedDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const today = getUaeDate();
  const [year, month] = today.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const router = useRouter();

  // Empty date means the whole current month.
  // Selecting a date switches the dashboard to that day.
  const [date, setDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [assignedBranchId, setAssignedBranchId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const periodLabel = getPeriodLabel(date);

  // 1. Verify the logged-in user and load their name.
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to verify your session.");
        }

        const session = (await response.json()) as UserSession;

        if (cancelled) return;

        if (!session.user) {
          router.replace("/login");
          return;
        }

        const role = session.user.role ?? "";
        const assigned = session.user.branchId ?? "";

        // Show the actual logged-in user's name.
        setUserName(
          session.user.name?.trim() || session.user.email?.trim() || "User",
        );

        if (!role) {
          throw new Error("Your account role could not be verified.");
        }

        if (role === "employee" && !assigned) {
          setError(
            "Your account has no assigned branch. Please contact your administrator.",
          );
          setLoading(false);
          setSessionLoaded(true);
          return;
        }

        setUserRole(role);
        setAssignedBranchId(assigned);

        if (role === "employee") {
          setBranchId(assigned);
        }

        setSessionLoaded(true);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error ? err.message : "Unable to load your account.",
        );
        setLoading(false);
        setSessionLoaded(true);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2. Load branches for non-employees.
  useEffect(() => {
    if (!sessionLoaded || !userRole || userRole === "employee") return;

    let cancelled = false;

    async function loadBranches() {
      try {
        const response = await fetch("/api/branches", {
          cache: "no-store",
        });

        const result = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load branches.");
        }

        setBranches(result.branches ?? []);
      } catch (err) {
        if (!cancelled) {
          console.error("Branches error:", err);
          setError(
            err instanceof Error ? err.message : "Unable to load branches.",
          );
        }
      }
    }

    loadBranches();

    return () => {
      cancelled = true;
    };
  }, [sessionLoaded, userRole]);

  // 3. Load monthly data by default, or daily data for a selected date.
  useEffect(() => {
    if (!sessionLoaded || !userRole) return;
    if (userRole === "employee" && !assignedBranchId) return;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const params = new URLSearchParams();

        params.set("mode", date ? "day" : "month");
        params.set("date", date || getUaeDate());

        // Employees can only view their assigned branch.
        if (userRole === "employee") {
          params.set("branchId", assignedBranchId);
        } else if (branchId) {
          params.set("branchId", branchId);
        }

        const response = await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load dashboard.");
        }

        const dashboard = result.dashboard as DashboardData;

        // Verify that employees receive only their own branch.
        if (userRole === "employee") {
          const permittedRows = dashboard.branchPerformance.filter(
            (branch) => branch.branchId === assignedBranchId,
          );

          if (permittedRows.length !== 1) {
            throw new Error(
              "Your assigned branch could not be verified. Please contact your administrator.",
            );
          }

          setBranchName(permittedRows[0].branchName);
        } else {
          setBranchName("");
        }

        setData(dashboard);
      } catch (err) {
        if (!cancelled) {
          console.error("Dashboard error:", err);
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard data.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [date, branchId, sessionLoaded, userRole, assignedBranchId]);

  function formatMoney(amount: number | undefined | null) {
    return `AED ${Number(amount || 0).toFixed(2)}`;
  }

  if (!sessionLoaded) {
    return <div className="p-8 text-gray-600">Loading your account...</div>;
  }

  if (!userRole) {
    return (
      <div className="p-8">
        <p className="text-red-600">
          {error || "Unable to verify your account."}
        </p>
        <button
          onClick={() => router.replace("/login")}
          className="mt-4 rounded-lg bg-[#253d2f] px-4 py-2 text-white"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (userRole === "employee" && !assignedBranchId) {
    return (
      <div className="m-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error || "Your account is not assigned to a branch."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            {/* Personalized welcome message */}
            <p className="mb-2 text-sm font-medium text-gray-500">
              Welcome back,
            </p>

            <h1 className="text-3xl font-bold text-[#253d2f]">{userName}!</h1>

            <p className="mt-2 text-xl font-semibold text-gray-800">
              {userRole === "employee" ? "Employee Dashboard" : "Dashboard"}
            </p>

            <p className="mt-1 text-gray-500">
              {userRole === "employee"
                ? `Branch: ${branchName || "Loading branch..."}`
                : "Overview of your flower business"}
            </p>

            <p className="mt-2 text-sm font-medium text-[#253d2f]">
              {date
                ? `Daily overview: ${periodLabel}`
                : `Monthly overview: ${periodLabel}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="dashboard-date" className="text-xs text-gray-500">
                Select a date (optional)
              </label>

              <input
                id="dashboard-date"
                type="date"
                value={date}
                max={getUaeDate()}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-[#253d2f]"
              />
            </div>

            {date && (
              <button
                type="button"
                onClick={() => setDate("")}
                className="self-end rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Show Whole Month
              </button>
            )}

            {userRole !== "employee" && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="dashboard-branch"
                  className="text-xs text-gray-500"
                >
                  Branch
                </label>

                <select
                  id="dashboard-branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
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
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <section
          className={`grid gap-5 ${
            userRole === "employee" ? "md:grid-cols-2" : "md:grid-cols-3"
          }`}
        >
          <SummaryCard
            label="Total Income"
            amount={data?.income.total ?? 0}
            loading={loading}
            icon={<TrendingUp size={22} />}
          />

          <SummaryCard
            label="Total Expenses"
            amount={data?.expenses.total ?? 0}
            loading={loading}
            icon={<Receipt size={22} />}
          />

          {userRole !== "employee" && (
            <SummaryCard
              label="Net Profit"
              amount={data?.netProfit ?? 0}
              loading={loading}
              icon={<Wallet size={22} />}
            />
          )}
        </section>

        {/* Income breakdown */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Income Breakdown
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {date
              ? "Income received on the selected date"
              : "Income received during the whole month"}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <BreakdownCard
              label="Cash"
              amount={data?.income.cash ?? 0}
              loading={loading}
              icon={<Banknote size={20} />}
            />

            <BreakdownCard
              label="Visa Machine"
              amount={data?.income.visa ?? 0}
              loading={loading}
              icon={<CreditCard size={20} />}
            />

            <BreakdownCard
              label="Online"
              amount={data?.income.online ?? 0}
              loading={loading}
              icon={<Globe size={20} />}
            />

            <BreakdownCard
              label="Other"
              amount={data?.income.other ?? 0}
              loading={loading}
              icon={<Wallet size={20} />}
            />
          </div>
        </section>

        {/* Expense breakdown */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Expense Breakdown
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {date
              ? "Expenses recorded on the selected date"
              : "Expenses recorded during the whole month"}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <BreakdownCard
              label="General Expenses"
              amount={data?.expenses.general ?? 0}
              loading={loading}
            />

            <BreakdownCard
              label="Flower Purchases"
              amount={data?.expenses.flowerPurchases ?? 0}
              loading={loading}
            />
          </div>
        </section>

        {/* Branch performance */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            {userRole === "employee"
              ? "Your Assigned Branch"
              : "Branch Performance"}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {date
              ? `Performance on ${periodLabel}`
              : `Performance for ${periodLabel}`}
          </p>

          {loading ? (
            <p className="py-8 text-center text-gray-500">
              Loading branch performance...
            </p>
          ) : data?.branchPerformance.length ? (
            <div className="mt-6 overflow-x-auto">
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

                    {userRole !== "employee" && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Profit
                      </th>
                    )}
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

                      {userRole !== "employee" && (
                        <td
                          className={`px-4 py-4 text-right font-semibold ${
                            branch.profit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatMoney(branch.profit)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-gray-500">
              No branch data available for this period.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  amount,
  loading,
  icon,
}: {
  label: string;
  amount: number;
  loading: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>

          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "Loading..." : `AED ${Number(amount || 0).toFixed(2)}`}
          </h2>
        </div>

        <div className="rounded-lg bg-[#eef4f0] p-3 text-[#253d2f]">{icon}</div>
      </div>
    </div>
  );
}

function BreakdownCard({
  label,
  amount,
  loading,
  icon,
}: {
  label: string;
  amount: number;
  loading: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-3 text-gray-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-3 text-xl font-semibold">
        {loading ? "Loading..." : `AED ${Number(amount || 0).toFixed(2)}`}
      </p>
    </div>
  );
}
  