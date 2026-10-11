"use client";

import { useEffect, useState } from "react";

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

interface Expense {
  _id: string;
  date: string;
  category: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  branchId: {
    _id: string;
    name: string;
  };
}

const ownerId = "6abbb773907472cc5ac6f063";

export default function ExpensesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState("2026-09-30");
  const [category, setCategory] = useState("delivery");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function fetchExpenses() {
    try {
      const response = await fetch("/api/expenses");
      const data = await response.json();

      if (data.success) {
        setExpenses(data.expenses);
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }
  }

  useEffect(() => {
    fetchBranches();
    fetchExpenses();
  }, []);

  const totalExpenses = expenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  function resetForm() {
    setDescription("");
    setAmount("");
    setCategory("delivery");
    setPaymentMethod("cash");
    setEditingId(null);
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense._id);

    setBranchId(expense.branchId._id);

    const expenseDate = new Date(expense.date);
    const formattedDate = expenseDate.toISOString().split("T")[0];

    setDate(formattedDate);
    setCategory(expense.category);
    setDescription(expense.description || "");
    setAmount(String(expense.amount));
    setPaymentMethod(expense.paymentMethod);

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

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid expense amount");
      return;
    }

    try {
      setLoading(true);

      const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId,
          date,
          category,
          description,
          amount,
          paymentMethod,
          createdBy: ownerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to save expense");
        return;
      }

      alert(
        editingId
          ? "Expense updated successfully"
          : "Expense saved successfully",
      );

      resetForm();

      await fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">Expenses</h1>

          <p className="mt-1 text-gray-500">
            Record and manage business expenses
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold">
              {editingId ? "Edit Expense" : "Add Expense"}
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
                <label className="mb-1 block text-sm font-medium">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                >
                  <option value="delivery">Delivery</option>
                  <option value="salary">Salary</option>
                  <option value="rent">Rent</option>
                  <option value="electricity">Electricity</option>
                  <option value="water">Water</option>
                  <option value="packaging">Packaging</option>
                  <option value="fuel">Fuel</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>

                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Expense description"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Amount</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                >
                  <option value="cash">Cash</option>
                  <option value="visa">Visa Machine</option>
                  <option value="online">Online</option>
                  <option value="other">Other</option>
                </select>
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
                      ? "Update Expense"
                      : "Save Expense"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={loading}
                    className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Expenses</h2>

              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>

                <p className="text-xl font-bold text-[#253d2f]">
                  AED {totalExpenses.toFixed(2)}
                </p>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
                No expenses found.
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense._id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold capitalize">
                          {expense.category}
                        </h3>

                        <p className="text-sm text-gray-500">
                          {expense.branchId.name}
                        </p>

                        <p className="text-sm text-gray-400">
                          {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-red-600">
                          AED {expense.amount.toFixed(2)}
                        </p>

                        <p className="text-xs capitalize text-gray-500">
                          {expense.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {expense.description && (
                      <p className="mt-3 text-sm text-gray-600">
                        {expense.description}
                      </p>
                    )}

                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="rounded-lg border border-[#253d2f] px-4 py-2 text-sm font-medium text-[#253d2f] hover:bg-[#eef4f0]"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
