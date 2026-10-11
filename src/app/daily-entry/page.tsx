"use client";

import { useCallback, useEffect, useState } from "react";

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

interface DailyEntry {
  _id: string;
  date: string;
  branchId: {
    _id: string;
    name: string;
  };
  income: {
    cash: number;
    visa: number;
    online: number;
    other: number;
  };
  notes?: string;
}

export default function DailyEntryPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  const [branchId, setBranchId] = useState("");
  const [assignedBranchId, setAssignedBranchId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [date, setDate] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? "";

    return `${part("year")}-${part("month")}-${part("day")}`;
  });

  const [cash, setCash] = useState("");
  const [visa, setVisa] = useState("");
  const [online, setOnline] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/daily-entries", {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setEntries(result.entries);
      } else {
        console.error(result.message || "Failed to load daily entries");
      }
    } catch (error) {
      console.error("Error fetching daily entries:", error);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializePage() {
      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        const session = await sessionResponse.json();

        if (!active) return;

        const role = session?.user?.role ?? "";
        const assignedId = session?.user?.branchId ?? "";

        setUserRole(role);
        setAssignedBranchId(assignedId);

        if (role === "employee") {
          if (!assignedId) {
            console.error("Employee has no assigned branch.");
            return;
          }

          // Employees always use their assigned branch.
          setBranchId(assignedId);
        }

        const branchResponse = await fetch("/api/branches", {
          cache: "no-store",
        });
        const branchResult = await branchResponse.json();

        if (!active) return;

        if (branchResponse.ok && branchResult.success) {
          const activeBranches: Branch[] = branchResult.branches.filter(
            (branch: Branch) => branch.isActive,
          );

          setBranches(activeBranches);

          if (role !== "employee") {
            setBranchId((current) => {
              if (
                current &&
                activeBranches.some((branch) => branch._id === current)
              ) {
                return current;
              }

              return activeBranches[0]?._id ?? "";
            });
          }
        }

        await fetchEntries();
      } catch (error) {
        console.error("Error initializing Daily Entry:", error);
      } finally {
        if (active) {
          setSessionLoaded(true);
        }
      }
    }

    initializePage();

    return () => {
      active = false;
    };
  }, [fetchEntries]);

  const totalIncome =
    Number(cash || 0) +
    Number(visa || 0) +
    Number(online || 0) +
    Number(other || 0);

  function resetForm() {
    setEditingId(null);
    setCash("");
    setVisa("");
    setOnline("");
    setOther("");
    setNotes("");

    // Keep the employee assigned to their own branch.
    if (userRole === "employee") {
      setBranchId(assignedBranchId);
    }
  }

  function handleEdit(entry: DailyEntry) {
    if (userRole === "employee" && entry.branchId._id !== assignedBranchId) {
      alert("You can only edit entries for your assigned branch.");
      return;
    }

    setEditingId(entry._id);

    if (userRole !== "employee") {
      setBranchId(entry.branchId._id);
    }

    setDate(new Date(entry.date).toISOString().split("T")[0]);
    setCash(String(entry.income.cash));
    setVisa(String(entry.income.visa));
    setOnline(String(entry.income.online));
    setOther(String(entry.income.other));
    setNotes(entry.notes || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const effectiveBranchId =
      userRole === "employee" ? assignedBranchId : branchId;

    if (!effectiveBranchId) {
      alert("No branch is selected or assigned.");
      return;
    }

    if (!date) {
      alert("Please select a date.");
      return;
    }

    try {
      setLoading(true);

      const url = editingId
        ? `/api/daily-entries/${editingId}`
        : "/api/daily-entries";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          cash,
          visa,
          online,
          other,
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "Failed to save daily entry.");
        return;
      }

      alert(
        editingId
          ? "Daily entry updated successfully."
          : "Daily entry saved successfully.",
      );

      resetForm();
      await fetchEntries();
    } catch (error) {
      console.error("Error saving daily entry:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionLoaded) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] p-8">
        Loading your account...
      </main>
    );
  }

  if (!userRole) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] p-8">
        Your session could not be loaded. Please log in again.
      </main>
    );
  }

  if (userRole === "employee" && !assignedBranchId) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] p-8">
        Your account has no assigned branch. Please contact the administrator.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">Daily Entry</h1>
          <p className="mt-1 text-gray-500">Record daily branch income</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold">
              {editingId ? "Edit Daily Entry" : "Add Daily Entry"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {userRole !== "employee" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Branch
                  </label>

                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {userRole === "employee" && (
                <div className="rounded-lg bg-[#eef4f0] p-3 text-sm text-[#253d2f]">
                  Branch is automatically set to your assigned branch.
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              {[
                { label: "Cash", value: cash, setter: setCash },
                { label: "Visa Machine", value: visa, setter: setVisa },
                { label: "Online", value: online, setter: setOnline },
                { label: "Other", value: other, setter: setOther },
              ].map((field) => (
                <div key={field.label}>
                  <label className="mb-1 block text-sm font-medium">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div className="rounded-lg bg-[#eef4f0] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    Total Income
                  </span>
                  <span className="text-xl font-bold text-[#253d2f]">
                    AED {totalIncome.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !branchId}
                  className="flex-1 rounded-lg bg-[#253d2f] px-4 py-3 font-medium text-white disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Update Daily Entry"
                      : "Save Daily Entry"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold">Recent Daily Entries</h2>

            {entries.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
                No daily entries found.
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => {
                  const total =
                    entry.income.cash +
                    entry.income.visa +
                    entry.income.online +
                    entry.income.other;

                  return (
                    <div
                      key={entry._id}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">
                            {entry.branchId.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[#253d2f]">
                            AED {total.toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-500">
                        <span>Cash: AED {entry.income.cash.toFixed(2)}</span>
                        <span>Visa: AED {entry.income.visa.toFixed(2)}</span>
                        <span>
                          Online: AED {entry.income.online.toFixed(2)}
                        </span>
                        <span>Other: AED {entry.income.other.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
