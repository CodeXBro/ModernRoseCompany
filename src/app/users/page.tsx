"use client";

import { useEffect, useState } from "react";

type Branch = {
  _id: string;
  name: string;
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "employee" | "viewer";
  branchId?: {
    _id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
};

type EditForm = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "employee" | "viewer";
  branchId: string;
};

export default function UsersPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [role, setRole] = useState<"admin" | "employee" | "viewer">("employee");

  const [branchId, setBranchId] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    email: "",
    password: "",
    role: "employee",
    branchId: "",
  });

  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, []);

  async function loadBranches() {
    try {
      const response = await fetch("/api/branches");

      const data = await response.json();

      if (response.ok) {
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
    }
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);

      const response = await fetch("/api/users");

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to load users.");
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);

      setError("Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          branchId: role === "employee" ? branchId || undefined : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create user.");
        return;
      }

      setMessage("User created successfully.");

      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setBranchId("");

      await loadUsers();
    } catch (error) {
      console.error("Create user error:", error);

      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function getRoleLabel(userRole: User["role"]) {
    if (userRole === "owner") {
      return "Owner";
    }

    if (userRole === "admin") {
      return "Admin";
    }

    if (userRole === "employee") {
      return "Employee";
    }

    return "View Only";
  }

  function openEditUser(user: User) {
    setEditingUser(user);

    setEditForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role === "owner" ? "admin" : user.role,
      branchId: user.branchId?._id || "",
    });

    setMessage("");
    setError("");
  }

  function closeEditUser() {
    setEditingUser(null);

    setEditForm({
      name: "",
      email: "",
      password: "",
      role: "employee",
      branchId: "",
    });
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    setEditLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/users/${editingUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          password: editForm.password || undefined,
          role: editForm.role,
          branchId:
            editForm.role === "employee"
              ? editForm.branchId || undefined
              : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to update user.");
        return;
      }

      setMessage("User updated successfully.");

      closeEditUser();

      await loadUsers();
    } catch (error) {
      console.error("Update user error:", error);

      setError("Something went wrong while updating the user.");
    } finally {
      setEditLoading(false);
    }
  }

  async function toggleUserStatus(user: User) {
    setMessage("");
    setError("");

    const newStatus = !user.isActive;

    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to update user status.");
        return;
      }

      setMessage(
        newStatus
          ? "User activated successfully."
          : "User deactivated successfully.",
      );

      await loadUsers();
    } catch (error) {
      console.error("Status update error:", error);

      setError("Something went wrong while updating user status.");
    }
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#253d2f]">Users</h1>

        <p className="mt-2 text-gray-500">
          Manage system users and their access levels.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create User */}
      <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-gray-800">
          Create New User
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter user name"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Role
            </label>

            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "admin" | "employee" | "viewer")
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
            >
              <option value="admin">Admin</option>

              <option value="employee">Employee</option>

              <option value="viewer">View Only</option>
            </select>
          </div>

          {role === "employee" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Branch
              </label>

              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
              >
                <option value="">Select branch</option>

                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#253d2f] px-6 py-3 font-medium text-white transition hover:bg-[#1d3025] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      {/* Existing Users */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-gray-800">
            Existing Users
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Users currently registered in the system.
          </p>
        </div>

        {loadingUsers ? (
          <div className="p-6 text-sm text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>

                  <th className="px-6 py-4 font-medium">Email</th>

                  <th className="px-6 py-4 font-medium">Role</th>

                  <th className="px-6 py-4 font-medium">Branch</th>

                  <th className="px-6 py-4 font-medium">Status</th>

                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {user.name}
                    </td>

                    <td className="px-6 py-4 text-gray-600">{user.email}</td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {getRoleLabel(user.role)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-gray-600">
                      {user.branchId?.name || "All Branches"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={
                          user.isActive
                            ? "rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                            : "rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {user.role === "owner" ? (
                        <span className="text-xs text-gray-400">Protected</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditUser(user)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user)}
                            className={
                              user.isActive
                                ? "rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                : "rounded-lg border border-green-200 px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50"
                            }
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Edit User
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Update user information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditUser}
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Name
                </label>

                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      name: event.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      email: event.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  New Password
                </label>

                <input
                  type="password"
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      password: event.target.value,
                    })
                  }
                  placeholder="Leave empty to keep current password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      role: event.target.value as
                        | "admin"
                        | "employee"
                        | "viewer",
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
                >
                  <option value="admin">Admin</option>

                  <option value="employee">Employee</option>

                  <option value="viewer">View Only</option>
                </select>
              </div>

              {editForm.role === "employee" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Branch
                  </label>

                  <select
                    value={editForm.branchId}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        branchId: event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-1 focus:ring-[#253d2f]"
                  >
                    <option value="">Select branch</option>

                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeEditUser}
                  className="flex-1 rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-lg bg-[#253d2f] px-5 py-3 font-medium text-white hover:bg-[#1d3025] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
