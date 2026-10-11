"use client";

import { useEffect, useState } from "react";

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
  const [date, setDate] = useState("2026-09-29");

  const [cash, setCash] = useState("");
  const [visa, setVisa] = useState("");
  const [online, setOnline] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ownerId = "6abbb773907472cc5ac6f063";

  async function fetchBranches() {
    try {
      const response = await fetch("/api/branches");
      const data = await response.json();

      if (data.success) {
        const activeBranches = data.branches.filter(
          (branch: Branch) => branch.isActive,
        );

        setBranches(activeBranches);

        if (activeBranches.length > 0 && !branchId) {
          setBranchId(activeBranches[0]._id);
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }

  async function fetchEntries() {
    try {
      const response = await fetch("/api/daily-entries");
      const data = await response.json();

      if (data.success) {
        setEntries(data.entries);
      }
    } catch (error) {
      console.error("Error fetching daily entries:", error);
    }
  }

  useEffect(() => {
    fetchBranches();
    fetchEntries();
  }, []);

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
  }

  function handleEdit(entry: DailyEntry) {
    setEditingId(entry._id);

    setBranchId(entry.branchId._id);

    setDate(new Date(entry.date).toISOString().split("T")[0]);

    setCash(String(entry.income.cash));
    setVisa(String(entry.income.visa));
    setOnline(String(entry.income.online));
    setOther(String(entry.income.other));
    setNotes(entry.notes || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!branchId) {
      alert("Please select a branch");
      return;
    }

    if (!date) {
      alert("Please select a date");
      return;
    }

    try {
      setLoading(true);

      const url = editingId
        ? `/api/daily-entries/${editingId}`
        : "/api/daily-entries";

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId,
          date,
          cash,
          visa,
          online,
          other,
          notes,
          ...(editingId ? {} : { createdBy: ownerId }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to save daily entry");
        return;
      }

      alert(
        editingId
          ? "Daily entry updated successfully"
          : "Daily entry saved successfully",
      );

      resetForm();

      await fetchEntries();
    } catch (error) {
      console.error("Error saving daily entry:", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
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
              <div>
                <label className="mb-1 block text-sm font-medium">Branch</label>

                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
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

              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>

                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Cash</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cash}
                  onChange={(event) => setCash(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Visa Machine
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={visa}
                  onChange={(event) => setVisa(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Online</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={online}
                  onChange={(event) => setOnline(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Other</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={other}
                  onChange={(event) => setOther(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

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
                  disabled={loading}
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
                    onClick={handleCancelEdit}
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
