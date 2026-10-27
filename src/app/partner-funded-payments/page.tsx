"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  CalendarDays,
  Building2,
  IndianRupee,
  Pencil,
  Trash2,
  X,
  ArrowUpRight,
  HandCoins,
  RefreshCw,
  ReceiptText,
} from "lucide-react";

type Branch = {
  _id: string;
  name: string;
};

type Payment = {
  _id: string;
  date: string;
  branchId: string | Branch;
  amount: number;
};

export default function PartnerFundedPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");

  const formatAmount = (value: number) =>
    Number(value || 0).toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getPaymentBranchId = (payment: Payment) =>
    typeof payment.branchId === "string"
      ? payment.branchId
      : payment.branchId?._id || "";

  const getBranchName = (payment: Payment) => {
    if (typeof payment.branchId === "object") {
      return payment.branchId?.name || "Unknown branch";
    }

    return (
      branches.find((branch) => branch._id === payment.branchId)?.name ||
      "Unknown branch"
    );
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [branchRes, paymentRes, sessionRes] = await Promise.all([
        fetch("/api/branches"),
        fetch("/api/partner-funded-payments"),
        fetch("/api/auth/session"),
      ]);

      const branchData = await branchRes.json();
      const paymentData = await paymentRes.json();
      const sessionData = await sessionRes.json();

      if (!branchRes.ok || !paymentRes.ok) {
        throw new Error(
          branchData.message || paymentData.message || "Failed to load data.",
        );
      }

      const branchList: Branch[] = Array.isArray(branchData)
        ? branchData
        : branchData.branches || [];

      const paymentList: Payment[] = Array.isArray(paymentData)
        ? paymentData
        : paymentData.payments || paymentData.records || [];

      setBranches(branchList);
      setPayments(paymentList);
      setRole(sessionData?.user?.role || "");

      if (!branchId && branchList.length > 0) {
        setBranchId(branchList[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setEditingId(null);
  };

  const handleEdit = (payment: Payment) => {
    setEditingId(payment._id);
    setDate(new Date(payment.date).toISOString().slice(0, 10));
    setBranchId(getPaymentBranchId(payment));
    setAmount(String(payment.amount));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!date || !branchId || !amount || Number(amount) <= 0) {
      setError(
        "Please enter a date, select a branch, and enter a valid amount.",
      );
      return;
    }

    setSaving(true);

    try {
      const url = editingId
        ? `/api/partner-funded-payments/${editingId}`
        : "/api/partner-funded-payments";

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          branchId,
          amount: Number(amount),
          // Required defaults for the existing API.
          paidTo: "Partner-funded payment",
          paymentMethod: "other",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || data.error || "Failed to save payment.",
        );
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (role !== "owner" && role !== "admin") {
      setError("You do not have permission to delete payments.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this payment?")) {
      return;
    }

    setError("");

    try {
      const res = await fetch(`/api/partner-funded-payments/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || data.error || "Failed to delete payment.",
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete payment.",
      );
    }
  };

  const totalAmount = payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0,
  );

  const branchTotals = branches.map((branch) => {
    const branchPayments = payments.filter(
      (payment) => getPaymentBranchId(payment) === branch._id,
    );

    return {
      branchId: branch._id,
      branchName: branch.name,
      total: branchPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      ),
      count: branchPayments.length,
    };
  });

  const filteredPayments = payments.filter((payment) => {
    const matchesBranch =
      filterBranch === "all" || getPaymentBranchId(payment) === filterBranch;

    const matchesSearch = getBranchName(payment)
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesBranch && matchesSearch;
  });

  const canWrite = ["owner", "admin", "employee"].includes(role);
  const canDelete = ["owner", "admin"].includes(role);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Page header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <HandCoins size={17} />
              <span>Finance Management</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partner-Funded Payments
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Track partner funding and monitor payments across your branches.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-800 p-5 text-white shadow-sm sm:p-6">
            <div className="absolute -right-6 -top-8 h-36 w-36 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">
                  Total Partner Funding
                </p>
                <p className="mt-4 text-3xl font-bold tracking-tight">
                  AED {formatAmount(totalAmount)}
                </p>
                <p className="mt-2 text-xs text-emerald-100">
                  Across all recorded payments
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <Wallet size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Payments
                </p>
                <p className="mt-4 text-3xl font-bold text-slate-900">
                  {payments.length}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  All recorded transactions
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <ReceiptText size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Active Branches
                </p>
                <p className="mt-4 text-3xl font-bold text-slate-900">
                  {branches.length}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Branches in your system
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <Building2 size={23} />
              </div>
            </div>
          </div>
        </div>

        {/* Add / Edit payment form */}
        {canWrite && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-bold text-slate-900">
                  {editingId ? "Edit Payment" : "Record a Payment"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the date, branch, and amount.
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                {editingId ? <Pencil size={20} /> : <Plus size={20} />}
              </div>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Payment Date
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Branch
                  </label>
                  <div className="relative">
                    <Building2
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Amount (AED)
                  </label>
                  <div className="relative">
                    <IndianRupee
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : editingId ? (
                    <Pencil size={17} />
                  ) : (
                    <Plus size={18} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Payment"
                      : "Save Payment"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Branch totals */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="font-bold text-slate-900">
                Branch Funding Overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A breakdown of partner-funded payments for each branch.
              </p>
            </div>
            <span className="self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:self-auto">
              {branches.length} branches
            </span>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">
              Loading branch totals...
            </div>
          ) : branchTotals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No branches found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {branchTotals.map((branch) => (
                <div
                  key={branch.branchId}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {branch.branchName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {branch.count} recorded payment
                        {branch.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">
                        Total funded amount
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-emerald-800">
                        AED {formatAmount(branch.total)}
                      </p>
                    </div>
                    <ArrowUpRight size={18} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payment history */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-bold text-slate-900">Payment History</h2>
              <p className="mt-1 text-sm text-slate-500">
                View and manage recorded payments.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branch..."
                className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 sm:w-44"
              />

              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              >
                <option value="all">All branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold sm:px-6">Date</th>
                  <th className="px-5 py-4 font-semibold">Branch</th>
                  <th className="px-5 py-4 text-right font-semibold">Amount</th>
                  <th className="px-5 py-4 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Loading payment history...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <ReceiptText size={22} />
                      </div>
                      <p className="mt-3 font-semibold text-slate-800">
                        No payments found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try changing your search or add a new payment.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr
                      key={payment._id}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 sm:px-6">
                        {new Date(payment.date).toLocaleDateString("en-GB")}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Building2 size={17} />
                          </div>
                          <span className="font-medium text-slate-800">
                            {getBranchName(payment)}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                        AED {formatAmount(Number(payment.amount))}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleEdit(payment)}
                              title="Edit payment"
                              aria-label="Edit payment"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(payment._id)}
                              title="Delete payment"
                              aria-label="Delete payment"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredPayments.length > 0 && (
            <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <p className="text-xs text-slate-500">
                Showing {filteredPayments.length} of {payments.length} payments
              </p>
              <p className="text-sm font-semibold text-slate-800">
                Filtered total: AED{" "}
                {formatAmount(
                  filteredPayments.reduce(
                    (sum, payment) => sum + Number(payment.amount || 0),
                    0,
                  ),
                )}
              </p>
            </div>
          )}
        </section>

        <p className="pb-2 text-center text-xs text-slate-400">
          Partner funding is tracked separately. Avoid recording the same funded
          amount again as a new expense.
        </p>
      </div>
    </div>
  );
}
