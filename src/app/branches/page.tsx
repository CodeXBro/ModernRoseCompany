"use client";

import { useEffect, useState } from "react";

interface Branch {
  _id: string;
  name: string;
  location?: string;
  phone?: string;
  isActive: boolean;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchBranches() {
    try {
      const response = await fetch("/api/branches");
      const data = await response.json();

      if (data.success) {
        setBranches(data.branches);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Branch name is required");
      return;
    }

    try {
      setLoading(true);

      const url = editingId ? `/api/branches/${editingId}` : "/api/branches";

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          location,
          phone,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.message);
        return;
      }

      resetForm();
      await fetchBranches();
    } catch (error) {
      console.error("Error saving branch:", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(branch: Branch) {
    setEditingId(branch._id);
    setName(branch.name);
    setLocation(branch.location || "");
    setPhone(branch.phone || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setLocation("");
    setPhone("");
  }

  async function toggleBranch(branch: Branch) {
    try {
      const response = await fetch(`/api/branches/${branch._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: branch.name,
          location: branch.location,
          phone: branch.phone,
          isActive: !branch.isActive,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.message);
        return;
      }

      await fetchBranches();
    } catch (error) {
      console.error("Error changing branch status:", error);
      alert("Something went wrong");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">Branches</h1>

          <p className="mt-1 text-gray-500">Manage your business branches</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* Form */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit Branch" : "Add New Branch"}
              </h2>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Branch Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Baniyas Branch"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Location
                </label>

                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Abu Dhabi, Baniyas"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>

                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0500000000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#253d2f] px-4 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Branch"
                    : "Add Branch"}
              </button>
            </form>
          </div>

          {/* Branch List */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Branch List
            </h2>

            {branches.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
                No branches found.
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((branch) => (
                  <div
                    key={branch._id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">
                          {branch.name}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            branch.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {branch.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {branch.location && (
                        <p className="mt-1 text-sm text-gray-500">
                          {branch.location}
                        </p>
                      )}

                      {branch.phone && (
                        <p className="mt-1 text-sm text-gray-500">
                          {branch.phone}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(branch)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleBranch(branch)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${
                          branch.isActive
                            ? "border border-red-200 text-red-600 hover:bg-red-50"
                            : "border border-green-200 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {branch.isActive ? "Deactivate" : "Activate"}
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
