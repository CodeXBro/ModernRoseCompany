"use client";

import { useCallback, useEffect, useState } from "react";

interface Branch {
  _id: string;
  name: string;
  isActive: boolean;
}

interface Company {
  _id: string;
  companyName: string;
  supplierName: string;
  isActive: boolean;
}

interface Purchase {
  _id: string;
  branchId?: string | { _id: string; name: string };
  date: string;
  companyId?:
    | string
    | { _id: string; companyName: string; supplierName: string };
  supplierName?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentStatus: "paid" | "pending" | "partial";
  paymentMethod: "cash" | "visa" | "online" | "bank" | "other";
  notes?: string;
}

type PaymentStatus = "paid" | "pending" | "partial";
type PaymentMethod = "cash" | "visa" | "online" | "bank" | "other";

function getUaeDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function FlowerPurchasesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [branchId, setBranchId] = useState("");
  const [assignedBranchId, setAssignedBranchId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [date, setDate] = useState(getUaeDate);
  const [companyId, setCompanyId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch("/api/companies", {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setCompanies(result.companies || []);
      }
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    try {
      const response = await fetch("/api/flower-purchases", {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setPurchases(result.purchases || []);
      } else {
        setError(result.message || "Failed to load purchases.");
      }
    } catch (error) {
      console.error("Error loading purchases:", error);
      setError("Failed to load purchases.");
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
            setError(
              "Your account has no assigned branch. Contact an administrator.",
            );
            return;
          }

          setBranchId(assignedId);
        }

        const branchResponse = await fetch("/api/branches", {
          cache: "no-store",
        });
        const branchResult = await branchResponse.json();

        if (!active) return;

        if (branchResponse.ok && branchResult.success) {
          const activeBranches: Branch[] = (branchResult.branches || []).filter(
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

        await Promise.all([loadCompanies(), loadPurchases()]);
      } catch (error) {
        console.error("Error initializing Flower Purchases:", error);
        if (active) setError("Failed to initialize the page.");
      } finally {
        if (active) setSessionLoaded(true);
      }
    }

    initializePage();

    return () => {
      active = false;
    };
  }, [loadCompanies, loadPurchases]);

  function formatMoney(amount: number | undefined | null) {
    return `AED ${(amount ?? 0).toFixed(2)}`;
  }

  function handleCompanyChange(selectedCompanyId: string) {
    setCompanyId(selectedCompanyId);

    const company = companies.find((item) => item._id === selectedCompanyId);

    setSupplierName(company?.supplierName || "");
  }

  function handlePaymentStatusChange(status: PaymentStatus) {
    setPaymentStatus(status);

    if (status === "pending") setPaidAmount("0");
    if (status === "paid") setPaidAmount(totalAmount || "0");
    if (status === "partial") setPaidAmount("");
  }

  function resetForm() {
    setBranchId(
      userRole === "employee"
        ? assignedBranchId
        : branches.find((branch) => branch.isActive)?._id || "",
    );

    setDate(getUaeDate());
    setCompanyId("");
    setSupplierName("");
    setInvoiceNumber("");
    setTotalAmount("");
    setPaymentStatus("pending");
    setPaidAmount("0");
    setPaymentMethod("bank");
    setNotes("");
    setEditingId(null);
    setError("");
  }

  function handleBillAmountChange(value: string) {
    setTotalAmount(value);

    if (paymentStatus === "paid") {
      setPaidAmount(value);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const effectiveBranchId =
      userRole === "employee" ? assignedBranchId : branchId;

    if (!effectiveBranchId) {
      setError("No branch is selected or assigned.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (!companyId) {
      setError("Please select a company.");
      return;
    }

    const billAmount = Number(totalAmount);

    if (!totalAmount || !Number.isFinite(billAmount) || billAmount <= 0) {
      setError("Please enter a valid bill amount.");
      return;
    }

    let finalPaidAmount = 0;

    if (paymentStatus === "paid") {
      finalPaidAmount = billAmount;
    } else if (paymentStatus === "partial") {
      finalPaidAmount = Number(paidAmount);

      if (
        !Number.isFinite(finalPaidAmount) ||
        finalPaidAmount <= 0 ||
        finalPaidAmount >= billAmount
      ) {
        setError(
          "Enter a valid partial payment that is greater than zero and less than the bill amount.",
        );
        return;
      }
    }

    const finalBalance = billAmount - finalPaidAmount;

    try {
      setLoading(true);

      const url = editingId
        ? `/api/flower-purchases/${editingId}`
        : "/api/flower-purchases";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          companyId,
          invoiceNumber,
          totalAmount: billAmount,
          paidAmount: finalPaidAmount,
          balanceAmount: finalBalance,
          paymentStatus,
          paymentMethod,
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Something went wrong.");
        return;
      }

      resetForm();
      await loadPurchases();
    } catch (error) {
      console.error("Error saving purchase:", error);
      setError("Failed to save purchase.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(purchase: Purchase) {
    let purchaseBranchId = "";

    if (typeof purchase.branchId === "string") {
      purchaseBranchId = purchase.branchId;
    } else if (purchase.branchId?._id) {
      purchaseBranchId = purchase.branchId._id;
    }

    let purchaseCompanyId = "";

    if (typeof purchase.companyId === "string") {
      purchaseCompanyId = purchase.companyId;
    } else if (purchase.companyId?._id) {
      purchaseCompanyId = purchase.companyId._id;
    }

    if (userRole === "employee" && purchaseBranchId !== assignedBranchId) {
      setError("You can only edit purchases for your assigned branch.");
      return;
    }

    if (!purchaseBranchId || !purchaseCompanyId) {
      setError("This purchase is missing its branch or company.");
      return;
    }

    setBranchId(userRole === "employee" ? assignedBranchId : purchaseBranchId);
    setDate(new Date(purchase.date).toISOString().split("T")[0]);
    setCompanyId(purchaseCompanyId);
    setSupplierName(purchase.supplierName || "");
    setInvoiceNumber(purchase.invoiceNumber || "");
    setTotalAmount(String(purchase.totalAmount ?? 0));

    const currentStatus = purchase.paymentStatus || "pending";
    setPaymentStatus(currentStatus);
    setPaidAmount(String(purchase.paidAmount ?? 0));
    setPaymentMethod(purchase.paymentMethod || "bank");
    setNotes(purchase.notes || "");
    setEditingId(purchase._id);
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getCompanyName(purchase: Purchase) {
    if (typeof purchase.companyId === "string") {
      return (
        companies.find((item) => item._id === purchase.companyId)
          ?.companyName || "Unknown Company"
      );
    }

    return purchase.companyId?.companyName || "Unknown Company";
  }

  function statusLabel(status: PaymentStatus) {
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";
    return "Pending";
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
        Your account has no assigned branch. Contact an administrator.
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Flower Purchases</h1>
          <p className="mt-1 text-gray-500">
            Record flower bills and payment details
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            {editingId ? "Edit Purchase" : "Add Flower Purchase"}
          </h2>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            {userRole !== "employee" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Branch
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f]"
                >
                  <option value="">Select branch</option>
                  {branches
                    .filter((branch) => branch.isActive)
                    .map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="rounded-lg bg-[#eef4f0] p-4 text-sm text-[#253d2f]">
                Your assigned branch is selected automatically.
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Company
              </label>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f]"
              >
                <option value="">Select company</option>
                {companies
                  .filter((company) => company.isActive)
                  .map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.companyName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Supplier Name
              </label>
              <input
                type="text"
                value={supplierName}
                readOnly
                placeholder="Supplier will appear automatically"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-600 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Bill / Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Bill Amount
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={totalAmount}
                onChange={(e) => handleBillAmountChange(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) =>
                  handlePaymentStatusChange(e.target.value as PaymentStatus)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f]"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {paymentStatus === "partial" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Paid Amount
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={totalAmount || undefined}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="Enter paid amount"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
                />
                {totalAmount && paidAmount && (
                  <p className="mt-2 text-sm text-gray-500">
                    Remaining balance:{" "}
                    <span className="font-medium text-red-600">
                      {formatMoney(
                        Math.max(Number(totalAmount) - Number(paidAmount), 0),
                      )}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f]"
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="visa">Visa</option>
                <option value="online">Online</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={loading || !branchId}
                className="rounded-lg bg-[#253d2f] px-6 py-3 text-sm font-medium text-white hover:bg-[#1d3025] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Purchase"
                    : "Add Purchase"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Purchase Bills
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {purchases.length} purchase bills
            </p>
          </div>

          {purchases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
              No flower purchases added yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    {[
                      "Date",
                      "Company",
                      "Bill",
                      "Bill Amount",
                      "Paid",
                      "Balance",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-sm font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr
                      key={purchase._id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(purchase.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {getCompanyName(purchase)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {purchase.invoiceNumber || "-"}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {formatMoney(purchase.totalAmount)}
                      </td>
                      <td className="px-4 py-4 text-green-700">
                        {formatMoney(purchase.paidAmount)}
                      </td>
                      <td className="px-4 py-4 font-medium text-red-700">
                        {formatMoney(purchase.balanceAmount)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            purchase.paymentStatus === "paid"
                              ? "bg-green-50 text-green-700"
                              : purchase.paymentStatus === "partial"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {statusLabel(purchase.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleEdit(purchase)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
