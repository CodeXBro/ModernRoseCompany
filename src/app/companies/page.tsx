
"use client";

import { useEffect, useState } from "react";

interface Company {
  _id: string;
  companyName: string;
  supplierName: string;
  isActive: boolean;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<
    Company[]
  >([]);

  const [companyName, setCompanyName] =
    useState("");

  const [supplierName, setSupplierName] =
    useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const response = await fetch(
        "/api/companies",
      );

      const result = await response.json();

      if (result.success) {
        setCompanies(result.companies || []);
      }
    } catch (error) {
      console.error(
        "Error loading companies:",
        error,
      );
    }
  }

  function resetForm() {
    setCompanyName("");
    setSupplierName("");
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setError("");

    if (!companyName.trim()) {
      setError(
        "Company name is required.",
      );
      return;
    }

    if (!supplierName.trim()) {
      setError(
        "Supplier name is required.",
      );
      return;
    }

    try {
      setLoading(true);

      const url = editingId
        ? `/api/companies/${editingId}`
        : "/api/companies";

      const method = editingId
        ? "PUT"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          companyName,
          supplierName,
          isActive: editingId
            ? companies.find(
                (company) =>
                  company._id ===
                  editingId,
              )?.isActive ?? true
            : true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.message ||
            "Something went wrong.",
        );
        return;
      }

      resetForm();

      await loadCompanies();
    } catch (error) {
      console.error(
        "Error saving company:",
        error,
      );

      setError(
        "Failed to save company.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(company: Company) {
    setEditingId(company._id);
    setCompanyName(company.companyName);
    setSupplierName(company.supplierName);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function toggleStatus(
    company: Company,
  ) {
    try {
      const response = await fetch(
        `/api/companies/${company._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            companyName:
              company.companyName,
            supplierName:
              company.supplierName,
            isActive:
              !company.isActive,
          }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        await loadCompanies();
      }
    } catch (error) {
      console.error(
        "Error changing company status:",
        error,
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Companies
          </h1>

          <p className="mt-1 text-gray-500">
            Manage flower companies and
            supplier names
          </p>
        </div>

        {/* Add / Edit Form */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            {editingId
              ? "Edit Company"
              : "Add Company"}
          </h2>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            {/* Company Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Company Name
              </label>

              <input
                type="text"
                value={companyName}
                onChange={(e) =>
                  setCompanyName(
                    e.target.value,
                  )
                }
                placeholder="Company name"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            {/* Supplier Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Supplier Name
              </label>

              <input
                type="text"
                value={supplierName}
                onChange={(e) =>
                  setSupplierName(
                    e.target.value,
                  )
                }
                placeholder="Supplier name"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 md:col-span-2">

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[#253d2f] px-6 py-3 text-sm font-medium text-white hover:bg-[#1d3025] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Company"
                    : "Add Company"}
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

        {/* Companies List */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Company List
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {companies.length}{" "}
                companies
              </p>
            </div>
          </div>

          {companies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
              No companies added yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">

                <thead>
                  <tr className="border-b border-gray-200">

                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                      Company
                    </th>

                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                      Supplier
                    </th>

                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {companies.map(
                    (company) => (
                      <tr
                        key={company._id}
                        className="border-b border-gray-100 last:border-0"
                      >

                        <td className="px-4 py-4 font-medium text-gray-900">
                          {company.companyName}
                        </td>

                        <td className="px-4 py-4 text-gray-600">
                          {company.supplierName}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              company.isActive
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {company.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                handleEdit(
                                  company,
                                )
                              }
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleStatus(
                                  company,
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-sm ${
                                company.isActive
                                  ? "border border-red-200 text-red-600 hover:bg-red-50"
                                  : "border border-green-200 text-green-600 hover:bg-green-50"
                              }`}
                            >
                              {company.isActive
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                          </div>
                        </td>

                      </tr>
                    ),
                  )}
                </tbody>

              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

