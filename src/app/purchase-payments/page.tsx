"use client";

import { useEffect, useState } from "react";

type Branch = {
  _id: string;
  name: string;
};

type Company = {
  _id: string;
  companyName: string;
  supplierName: string;
};

type Purchase = {
  _id: string;
  date: string;
  invoiceNumber?: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: "paid" | "pending" | "partial";
  paymentMethod?: string;

  companyId?: {
    _id: string;
    companyName: string;
    supplierName: string;
  };

  branchId?: {
    _id: string;
    name: string;
  };
};

type CompanySummary = {
  companyId: string;
  companyName: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  totalBills: number;
};

type Summary = {
  totalBills: number;
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
};

export default function PurchasePaymentsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [companySummaries, setCompanySummaries] = useState<CompanySummary[]>(
    [],
  );

  const [summary, setSummary] = useState<Summary>({
    totalBills: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalBalance: 0,
  });

  const [branchId, setBranchId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function formatMoney(amount: number | undefined | null) {
    return `AED ${(amount ?? 0).toFixed(2)}`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-GB");
  }

  async function loadBranches() {
    try {
      const response = await fetch("/api/branches");
      const data = await response.json();

      if (data.success) {
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error("Error loading branches:", error);
    }
  }

  async function loadCompanies() {
    try {
      const response = await fetch("/api/companies");
      const data = await response.json();

      if (data.success) {
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  }

  async function loadPayments() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (branchId) {
        params.append("branchId", branchId);
      }

      if (companyId) {
        params.append("companyId", companyId);
      }

      if (status) {
        params.append("status", status);
      }

      const response = await fetch(
        `/api/purchase-payments?${params.toString()}`,
      );

      const data = await response.json();

      if (data.success) {
        setPurchases(data.payments?.purchases || []);

        setSummary(
          data.payments?.summary || {
            totalBills: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalBalance: 0,
          },
        );

        setCompanySummaries(data.payments?.companies || []);
      }
    } catch (error) {
      console.error("Error loading purchase payments:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranches();
    loadCompanies();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [branchId, companyId, status]);

  async function changePaymentStatus(
    purchase: Purchase,
    newStatus: "paid" | "pending" | "partial",
  ) {
    let paidAmount = purchase.paidAmount;

    /*
     * PAID
     * Paid amount becomes the full bill amount.
     */
    if (newStatus === "paid") {
      paidAmount = purchase.totalAmount;
    }

    /*
     * PENDING
     * Paid amount becomes zero.
     */
    if (newStatus === "pending") {
      paidAmount = 0;
    }

    /*
     * PARTIAL
     * Ask user how much has been paid.
     */
    if (newStatus === "partial") {
      const enteredAmount = window.prompt(
        `Enter the paid amount for this bill.\n\nBill Amount: AED ${purchase.totalAmount.toFixed(
          2,
        )}`,
        purchase.paidAmount.toString(),
      );

      if (enteredAmount === null) {
        return;
      }

      paidAmount = Number(enteredAmount);

      if (!Number.isFinite(paidAmount)) {
        alert("Please enter a valid amount.");
        return;
      }

      if (paidAmount <= 0) {
        alert("Partial payment must be greater than AED 0.");
        return;
      }

      if (paidAmount >= purchase.totalAmount) {
        alert("For a fully paid bill, please select Paid.");
        return;
      }
    }

    try {
      setUpdatingId(purchase._id);

      const response = await fetch(`/api/purchase-payments/${purchase._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paidAmount,
          paymentMethod: purchase.paymentMethod || "other",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update payment status.");
      }

      /*
       * Reload everything so:
       * - bill table
       * - company balances
       * - summary cards
       * are all updated.
       */
      await loadPayments();
    } catch (error) {
      console.error("Error updating payment status:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update payment status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function clearFilters() {
    setBranchId("");
    setCompanyId("");
    setStatus("");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Purchase Payments
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            View flower purchase bills, payments and outstanding balances.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Branch */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Branch
              </label>

              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              >
                <option value="">All Branches</option>

                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Company
              </label>

              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              >
                <option value="">All Companies</option>

                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Status
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              >
                <option value="">All Status</option>

                <option value="paid">Paid</option>

                <option value="pending">Pending</option>

                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Bills</p>

            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {summary.totalBills}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Purchased</p>

            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatMoney(summary.totalAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Paid</p>

            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatMoney(summary.totalPaid)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Outstanding Balance</p>

            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatMoney(summary.totalBalance)}
            </p>
          </div>
        </div>

        {/* Company Summary */}
        {!companyId && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Company Balances
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Click a company to view its purchase bills.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Company</th>

                    <th className="px-5 py-3 font-medium">Supplier</th>

                    <th className="px-5 py-3 font-medium">Bills</th>

                    <th className="px-5 py-3 font-medium">Purchased</th>

                    <th className="px-5 py-3 font-medium">Paid</th>

                    <th className="px-5 py-3 font-medium">Balance</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {companySummaries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-gray-500"
                      >
                        No purchase records found.
                      </td>
                    </tr>
                  ) : (
                    companySummaries.map((company) => (
                      <tr
                        key={company.companyId}
                        onClick={() => setCompanyId(company.companyId)}
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-5 py-4 font-medium text-gray-900">
                          {company.companyName}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {company.supplierName}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {company.totalBills}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {formatMoney(company.totalAmount)}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {formatMoney(company.paidAmount)}
                        </td>

                        <td className="px-5 py-4 font-medium text-gray-900">
                          {formatMoney(company.balanceAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Company */}
        {companyId && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-sm text-gray-500">Selected Company</p>

              <p className="font-semibold text-gray-900">
                {companies.find((company) => company._id === companyId)
                  ?.companyName || "Selected Company"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCompanyId("")}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View All Companies
            </button>
          </div>
        )}

        {/* Purchase Bills */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Purchase Bills
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>

                  <th className="px-5 py-3 font-medium">Branch</th>

                  <th className="px-5 py-3 font-medium">Company</th>

                  <th className="px-5 py-3 font-medium">Invoice</th>

                  <th className="px-5 py-3 font-medium">Bill Amount</th>

                  <th className="px-5 py-3 font-medium">Paid</th>

                  <th className="px-5 py-3 font-medium">Balance</th>

                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-gray-500"
                    >
                      No purchase bills found.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 text-gray-700">
                        {formatDate(purchase.date)}
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {purchase.branchId?.name || "-"}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {purchase.companyId?.companyName || "-"}
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {purchase.invoiceNumber || "-"}
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {formatMoney(purchase.totalAmount)}
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {formatMoney(purchase.paidAmount)}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {formatMoney(purchase.balanceAmount)}
                      </td>

                      {/* Editable Status */}
                      <td className="px-5 py-4">
                        <select
                          value={purchase.paymentStatus}
                          disabled={updatingId === purchase._id}
                          onChange={(e) =>
                            changePaymentStatus(
                              purchase,
                              e.target.value as "paid" | "pending" | "partial",
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-medium outline-none ${
                            purchase.paymentStatus === "paid"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : purchase.paymentStatus === "partial"
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          <option value="paid">Paid</option>

                          <option value="pending">Pending</option>

                          <option value="partial">Partial</option>
                        </select>

                        {updatingId === purchase._id && (
                          <span className="ml-2 text-xs text-gray-500">
                            Updating...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
