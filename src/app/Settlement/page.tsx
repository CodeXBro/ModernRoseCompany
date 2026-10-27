"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Handshake,
  Plus,
  RefreshCw,
  Search,
  CalendarDays,
  Building2,
  Wallet,
  Pencil,
  Trash2,
  X,
  LoaderCircle,
  ArrowDownRight,
  FileText,
} from "lucide-react";

type Branch = {
  _id: string;
  name: string;
};

type Settlement = {
  _id: string;
  date: string;
  branchId: Branch | string;
  amount: number;
  description: string;
  notes?: string;
  createdBy?: { name?: string } | string;
  updatedAt?: string;
};

type SessionUser = {
  role?: "owner" | "admin" | "employee" | "viewer";
  branchId?: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function getBranchId(value: Branch | string): string {
  return typeof value === "string" ? value : (value?._id ?? "");
}

function getBranchName(value: Branch | string, branches: Branch[]) {
  if (typeof value !== "string") return value?.name ?? "Unknown branch";
  return (
    branches.find((branch) => branch._id === value)?.name ?? "Unknown branch"
  );
}

function formatAED(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateInputValue(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export default function PartnershipSettlementsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [user, setUser] = useState<SessionUser>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(dateInputValue());
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const canWrite = user.role !== "viewer";
  const canDelete = user.role === "owner" || user.role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [branchResponse, settlementResponse, sessionResponse] =
        await Promise.all([
          fetch("/api/branches", { cache: "no-store" }),
          fetch("/api/partnership-settlements", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

      if (!branchResponse.ok) {
        throw new Error("Could not load branches.");
      }

      if (!settlementResponse.ok) {
        const data = await settlementResponse.json().catch(() => ({}));
        throw new Error(data.message || "Could not load settlements.");
      }

      const branchData = await branchResponse.json();
      const settlementData = await settlementResponse.json();
      const sessionData = await sessionResponse.json().catch(() => ({}));

      const branchList = Array.isArray(branchData)
        ? branchData
        : (branchData.branches ?? []);

      const settlementList = Array.isArray(settlementData)
        ? settlementData
        : (settlementData.settlements ?? []);

      const currentUser: SessionUser = {
        role: sessionData?.user?.role,
        branchId: sessionData?.user?.branchId,
      };

      setBranches(branchList);
      setSettlements(settlementList);
      setUser(currentUser);

      const assignedBranch = currentUser.branchId || "";
      setBranchId(
        (previous) => previous || assignedBranch || branchList[0]?._id || "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredSettlements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return settlements.filter((item) => {
      const itemBranchId = getBranchId(item.branchId);

      const matchesBranch =
        branchFilter === "all" || itemBranchId === branchFilter;

      const matchesSearch =
        !query ||
        item.description?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        getBranchName(item.branchId, branches).toLowerCase().includes(query);

      return matchesBranch && matchesSearch;
    });
  }, [settlements, search, branchFilter, branches]);

  const totalAmount = useMemo(
    () =>
      filteredSettlements.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
    [filteredSettlements],
  );

  const allTimeTotal = useMemo(
    () =>
      settlements.reduce((total, item) => total + Number(item.amount || 0), 0),
    [settlements],
  );

  const branchTotals = useMemo(() => {
    return branches.map((branch) => ({
      ...branch,
      total: settlements
        .filter((item) => getBranchId(item.branchId) === branch._id)
        .reduce((total, item) => total + Number(item.amount || 0), 0),
      count: settlements.filter(
        (item) => getBranchId(item.branchId) === branch._id,
      ).length,
    }));
  }, [branches, settlements]);

  function resetForm() {
    setEditingId(null);
    setDate(dateInputValue());
    setBranchId(user.branchId || branches[0]?._id || "");
    setAmount("");
    setDescription("");
    setNotes("");
    setShowForm(false);
  }

  function startEdit(item: Settlement) {
    setEditingId(item._id);
    setDate(dateInputValue(item.date));
    setBranchId(getBranchId(item.branchId));
    setAmount(String(item.amount));
    setDescription(item.description || "");
    setNotes(item.notes || "");
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!date || !branchId || !amount || !description.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        editingId
          ? `/api/partnership-settlements/${editingId}`
          : "/api/partnership-settlements",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            branchId,
            amount: numericAmount,
            description: description.trim(),
            notes: notes.trim(),
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not save settlement.");
      }

      setSuccess(
        editingId
          ? "Settlement updated successfully."
          : "Settlement recorded successfully.",
      );
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settlement.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete this partnership settlement? This action cannot be undone.",
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/partnership-settlements/${id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not delete settlement.");
      }

      setSuccess("Settlement deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete settlement.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Handshake size={17} />
              Finance Management
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Partnership Settlement
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Record money exchanged between partners separately from shop
              expenses and flower purchases.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            {canWrite && (
              <button
                type="button"
                onClick={() => {
                  if (showForm && !editingId) {
                    resetForm();
                  } else {
                    setError("");
                    setSuccess("");
                    setShowForm(true);
                  }
                }}
                className={`${buttonClass} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}
              >
                <Plus size={17} />
                New Settlement
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet size={21} />
              </div>
              <span className="text-xs font-medium text-slate-400">
                All records
              </span>
            </div>
            <p className="mt-5 text-sm text-slate-500">Total Settlements</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatAED(allTimeTotal)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FileText size={21} />
              </div>
              <span className="text-xs font-medium text-slate-400">
                Current filter
              </span>
            </div>
            <p className="mt-5 text-sm text-slate-500">Matching Records</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {filteredSettlements.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <ArrowDownRight size={21} />
              </div>
              <span className="text-xs font-medium text-slate-400">
                Current filter
              </span>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Filtered Settlement Amount
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatAED(totalAmount)}
            </p>
          </div>
        </div>

        {showForm && canWrite && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingId
                    ? "Edit Settlement"
                    : "Record Partnership Settlement"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Use a clear description so the transaction can be understood
                  later.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Settlement Date *
                  </span>
                  <span className="relative block">
                    <CalendarDays
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className={`${inputClass} pl-10`}
                      required
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Branch *
                  </span>
                  <span className="relative block">
                    <Building2
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <select
                      value={branchId}
                      onChange={(event) => setBranchId(event.target.value)}
                      className={`${inputClass} pl-10`}
                      required
                      disabled={user.role === "employee"}
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Amount (AED) *
                  </span>
                  <span className="relative block">
                    <Wallet
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      className={`${inputClass} pl-10`}
                      required
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Description *
                  </span>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Partner contribution"
                    className={inputClass}
                    maxLength={200}
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add any additional details..."
                  className={inputClass}
                  rows={3}
                  maxLength={1000}
                />
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Plus size={17} />
                  )}
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Save Settlement"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Settlement History
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review and manage recorded partner transactions.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search settlements..."
                    className={`${inputClass} pl-10 sm:w-64`}
                  />
                </div>

                <select
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                  className={`${inputClass} sm:w-48`}
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
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={20} className="animate-spin" />
              Loading settlements...
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Handshake size={25} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-800">
                No settlements found
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Add a partnership settlement or change your search and branch
                filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Date</th>
                      <th className="px-5 py-4 font-semibold">Branch</th>
                      <th className="px-5 py-4 font-semibold">Description</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Amount
                      </th>
                      <th className="px-5 py-4 font-semibold">Notes</th>
                      {(canWrite || canDelete) && (
                        <th className="px-5 py-4 text-right font-semibold">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSettlements.map((item) => (
                      <tr
                        key={item._id}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {new Date(item.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                            <Building2 size={14} />
                            {getBranchName(item.branchId, branches)}
                          </span>
                        </td>
                        <td className="max-w-xs px-5 py-4">
                          <p className="font-medium text-slate-800">
                            {item.description}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                          {formatAED(Number(item.amount))}
                        </td>
                        <td className="max-w-xs px-5 py-4 text-slate-500">
                          <span
                            className="block truncate"
                            title={item.notes || ""}
                          >
                            {item.notes || "—"}
                          </span>
                        </td>
                        {(canWrite || canDelete) && (
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label="Edit settlement"
                                  title="Edit"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item._id)}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Delete settlement"
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing {filteredSettlements.length} of {settlements.length}{" "}
                  records
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  Filtered total:{" "}
                  <span className="text-emerald-700">
                    {formatAED(totalAmount)}
                  </span>
                </p>
              </div>
            </>
          )}
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-slate-900">Branch Overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Total recorded settlement amounts for each branch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {branchTotals.map((branch) => (
              <button
                key={branch._id}
                type="button"
                onClick={() =>
                  setBranchFilter((current) =>
                    current === branch._id ? "all" : branch._id,
                  )
                }
                className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  branchFilter === branch._id
                    ? "border-emerald-400 ring-2 ring-emerald-500/10"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Building2 size={19} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                    {branch.count} records
                  </span>
                </div>
                <p className="mt-4 font-semibold text-slate-800">
                  {branch.name}
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {formatAED(branch.total)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Click to filter settlement history
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
