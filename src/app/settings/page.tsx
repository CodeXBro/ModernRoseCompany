"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ShieldCheck, Store } from "lucide-react";

interface SessionUser {
  name?: string;
  email?: string;
  role?: "owner" | "admin" | "employee" | "viewer";
  branchId?: string;
}

interface SessionResponse {
  user?: SessionUser;
}

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load your account.");
        }

        const session = (await response.json()) as SessionResponse;

        if (cancelled) return;

        if (!session.user) {
          router.replace("/login");
          return;
        }

        setUser(session.user);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load account settings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const isOwner = user?.role === "owner";

  const cardClass = "rounded-xl border border-gray-200 bg-white p-6 shadow-sm";

  const labelClass = "mb-2 block text-sm font-medium text-gray-700";

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">Loading settings...</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-6 text-gray-900 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">Settings</h1>
          <p className="mt-2 text-gray-500">
            Manage your account and application preferences.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile */}
          <section className={cardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-[#eef4f0] p-3 text-[#253d2f]">
                <UserRound size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Profile</h2>
                <p className="text-sm text-gray-500">
                  Your account information
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  className={inputClass}
                  value={user?.name ?? ""}
                  readOnly
                />
              </div>

              <div>
                <label className={labelClass}>Email address</label>
                <input
                  className={inputClass}
                  value={user?.email ?? ""}
                  readOnly
                />
              </div>

              <div>
                <label className={labelClass}>Account role</label>
                <input
                  className={`${inputClass} capitalize`}
                  value={user?.role ?? ""}
                  readOnly
                />
              </div>

              <div>
                <label className={labelClass}>Assigned branch</label>
                <input
                  className={inputClass}
                  value={
                    user?.role === "employee"
                      ? user.branchId || "No branch assigned"
                      : "Managed by account permissions"
                  }
                  readOnly
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              Profile changes will be enabled after the secure profile update
              API is connected.
            </p>
          </section>

          {/* Owner settings */}
          {isOwner && (
            <section className={cardClass}>
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-[#eef4f0] p-3 text-[#253d2f]">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">Owner settings</h2>
                  <p className="text-sm text-gray-500">
                    Owner-only management options
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => router.push("/users")}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:bg-gray-50"
                >
                  <UserRound size={20} />

                  <span>
                    <span className="block font-medium">Manage users</span>
                    <span className="text-sm text-gray-500">
                      Review user accounts
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/branches")}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:bg-gray-50"
                >
                  <Store size={20} />

                  <span>
                    <span className="block font-medium">Manage branches</span>
                    <span className="text-sm text-gray-500">
                      Review branch records
                    </span>
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
