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

function getId(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object" && "_id" in value) {
    return String(value._id ?? "");
  }

  return "";
}

function formatPurchaseDate(value: string): string {
  if (!value) return "—";

  const datePart = value.includes("T") ? value.slice(0, 10) : value;

  const parts = datePart.split("-");

  if (
    parts.length === 3 &&
    parts[0].length === 4 &&
    parts[1].length === 2 &&
    parts[2].length === 2
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

export default function FlowerPurchasesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  // Filters for the Purchase Bills table (separate from the entry form).
  const [filterMonth, setFilterMonth] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<
    "all" | PaymentStatus
  >("all");

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
  const [successMessage, setSuccessMessage] = useState("");

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch("/api/companies", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load companies.");
      }

      setCompanies(result.companies || []);
    } catch (error) {
      console.error("Error loading companies:", error);
      setError("Failed to load companies.");
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    try {
      const response = await fetch("/api/flower-purchases", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load purchases.");
      }

      setPurchases(result.purchases || []);
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
        const assignedId = getId(session?.user?.branchId);

        setUserRole(role);
        setAssignedBranchId(assignedId);

        if (!role) {
          setError("Your session could not be loaded. Please log in again.");
          return;
        }

        if (role === "employee" && !assignedId) {
          setError(
            "Your account has no assigned branch. Contact an administrator.",
          );
          return;
        }

        const branchResponse = await fetch("/api/branches", {
          cache: "no-store",
        });

        const branchResult = await branchResponse.json();

        if (!active) return;

        if (!branchResponse.ok || !branchResult.success) {
          throw new Error(branchResult.message || "Failed to load branches.");
        }

        const activeBranches: Branch[] = (branchResult.branches || []).filter(
          (branch: Branch) => branch.isActive,
        );

        setBranches(activeBranches);

        if (role === "employee") {
          setBranchId(assignedId);
        } else {
          setBranchId((current) => {
            if (
              current &&
              activeBranches.some(
                (branch) => String(branch._id) === String(current),
              )
            ) {
              return current;
            }

            return activeBranches[0]?._id ?? "";
          });
        }

        await Promise.all([loadCompanies(), loadPurchases()]);
      } catch (error) {
        console.error("Error initializing Flower Purchases:", error);

        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to initialize the page.",
          );
        }
      } finally {
        if (active) setSessionLoaded(true);
      }
    }

    void initializePage();

    return () => {
      active = false;
    };
  }, [loadCompanies, loadPurchases]);

  function formatMoney(amount: number | undefined | null) {
    return `AED ${Number(amount ?? 0).toFixed(2)}`;
  }

  function handleCompanyChange(selectedCompanyId: string) {
    setCompanyId(selectedCompanyId);

    const company = companies.find(
      (item) => String(item._id) === String(selectedCompanyId),
    );

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
    setSuccessMessage("");
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
    setSuccessMessage("");

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
          "Enter a partial payment greater than zero and less than the bill amount.",
        );
        return;
      }
    }

    const finalBalance = Number((billAmount - finalPaidAmount).toFixed(2));

    try {
      setLoading(true);

      const url = editingId
        ? `/api/flower-purchases/${editingId}`
        : "/api/flower-purchases";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok || !result.success) {
        setError(result.message || "Something went wrong.");
        return;
      }

      setSuccessMessage(
        result.message ||
          (editingId
            ? "Purchase updated successfully."
            : "Purchase added successfully."),
      );

      resetForm();

      await Promise.all([loadPurchases(), loadCompanies()]);
    } catch (error) {
      console.error("Error saving purchase:", error);
      setError("Failed to save purchase.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(purchase: Purchase) {
    const purchaseBranchId = getId(purchase.branchId);
    const purchaseCompanyId = getId(purchase.companyId);

    if (userRole === "employee" && purchaseBranchId !== assignedBranchId) {
      setError("You can only edit purchases for your assigned branch.");
      return;
    }

    if (!purchaseBranchId || !purchaseCompanyId) {
      setError("This purchase is missing its branch or company.");
      return;
    }

    setBranchId(userRole === "employee" ? assignedBranchId : purchaseBranchId);

    const purchaseDate =
      typeof purchase.date === "string"
        ? purchase.date.slice(0, 10)
        : getUaeDate();

    setDate(purchaseDate);
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
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(purchase: Purchase) {
    const confirmed = window.confirm(
      `Are you sure you want to delete this purchase bill for ${getCompanyName(purchase)} (${formatMoney(purchase.totalAmount)})?`,
    );

    if (!confirmed) return;

    setError("");
    setSuccessMessage("");

    try {
      setLoading(true);
      const response = await fetch(`/api/flower-purchases/${purchase._id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to delete purchase.");
        return;
      }

      if (editingId === purchase._id) resetForm();
      setSuccessMessage(result.message || "Purchase deleted successfully.");
      await Promise.all([loadPurchases(), loadCompanies()]);
    } catch (error) {
      console.error("Error deleting purchase:", error);
      setError("Failed to delete purchase.");
    } finally {
      setLoading(false);
    }
  }

  function getCompanyName(purchase: Purchase): string {
    const companyValue = purchase.companyId;

    if (
      companyValue &&
      typeof companyValue === "object" &&
      companyValue.companyName
    ) {
      return companyValue.companyName;
    }

    const id = getId(companyValue);

    if (!id) return "Unknown Company";

    return (
      companies.find((company) => String(company._id) === String(id))
        ?.companyName || "Unknown Company"
    );
  }

  // FIX: Supports populated branch objects and branch ID strings.
  function getBranchName(purchase: Purchase): string {
    const branchValue = purchase.branchId;

    // The API may already provide { _id, name }.
    if (
      branchValue &&
      typeof branchValue === "object" &&
      typeof branchValue.name === "string" &&
      branchValue.name.trim() !== ""
    ) {
      return branchValue.name;
    }

    // Otherwise, extract the branch ID.
    const purchaseBranchId = getId(branchValue);

    if (!purchaseBranchId) {
      return "Branch Not Assigned";
    }

    // Match against the branches loaded from the branches API.
    const matchingBranch = branches.find(
      (branch) => String(branch._id).trim() === String(purchaseBranchId).trim(),
    );

    return matchingBranch?.name || "Branch Not Found";
  }

  function statusLabel(status: PaymentStatus) {
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";
    return "Pending";
  }

  const filteredPurchases = purchases.filter((purchase) => {
    // The date is stored as YYYY-MM-DD; compare only YYYY-MM for month-wise filtering.
    const purchaseMonth =
      typeof purchase.date === "string" ? purchase.date.slice(0, 7) : "";
    const purchaseBranchId = getId(purchase.branchId);

    const matchesMonth = !filterMonth || purchaseMonth === filterMonth;
    const matchesBranch =
      !filterBranchId || purchaseBranchId === filterBranchId;
    const matchesStatus =
      filterPaymentStatus === "all" ||
      purchase.paymentStatus === filterPaymentStatus;

    return matchesMonth && matchesBranch && matchesStatus;
  });

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
        {error || "Your session could not be loaded. Please log in again."}
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
    <div className="min-h-screen bg-[#f7f7f8] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Flower Purchases</h1>
          <p className="mt-1 text-gray-500">
            Record flower bills and payment details.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            {editingId ? "Edit Purchase" : "Add Flower Purchase"}
          </h2>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
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
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Assigned Branch
                </label>
                <div className="rounded-lg bg-[#eef4f0] px-4 py-3 text-sm text-[#253d2f]">
                  {branches.find(
                    (branch) => String(branch._id) === String(assignedBranchId),
                  )?.name || "Your assigned branch"}
                </div>
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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Purchase Bills
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Showing {filteredPurchases.length} of {purchases.length}{" "}
                purchase bills
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                void Promise.all([loadPurchases(), loadCompanies()]);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {/* Three filters for purchase bills */}
          <div className="mb-6 grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filter by Month
              </label>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#253d2f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filter by Branch
              </label>
              <select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#253d2f]"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filter by Payment Status
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) =>
                  setFilterPaymentStatus(
                    e.target.value as "all" | PaymentStatus,
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#253d2f]"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <button
                type="button"
                onClick={() => {
                  setFilterMonth("");
                  setFilterBranchId("");
                  setFilterPaymentStatus("all");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
              {purchases.length === 0
                ? "No flower purchases added yet."
                : "No purchase bills match the selected filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {[
                      "Date",
                      "Branch",
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
                        className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchases.map((purchase) => (
                    <tr
                      key={purchase._id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {formatPurchaseDate(purchase.date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-700">
                        {getBranchName(purchase)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                        {getCompanyName(purchase)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {purchase.invoiceNumber || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                        {formatMoney(purchase.totalAmount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-green-700">
                        {formatMoney(purchase.paidAmount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-red-700">
                        {formatMoney(purchase.balanceAmount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
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

                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(purchase)}
                            disabled={loading}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(purchase)}
                            disabled={loading}
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
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
