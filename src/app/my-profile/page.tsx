
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Mail, ShieldCheck, Store, LoaderCircle } from "lucide-react";

type ProfileUser = {
  name?: string;
  email?: string;
  role?: string;
  branchId?: string;
};

export default function MyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load your profile.");
        }

        const session = await response.json();

        if (!session?.user) {
          router.replace("/login");
          return;
        }

        setUser(session.user);
      } catch {
        setError("Could not load your profile. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const fields = [
    {
      label: "Full name",
      value: user?.name || "Not provided",
      icon: UserRound,
    },
    {
      label: "Email address",
      value: user?.email || "Not provided",
      icon: Mail,
    },
    {
      label: "Account role",
      value: user?.role || "Not assigned",
      icon: ShieldCheck,
    },
    {
      label: "Assigned branch",
      value:
        user?.role === "employee"
          ? user.branchId || "No branch assigned"
          : user?.role
            ? "Managed by account permissions"
            : "Loading",
      icon: Store,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-6 text-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#253d2f]">
            My Profile
          </h1>
          <p className="mt-2 text-gray-500">
            View your account information.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-xl bg-white p-8 shadow-sm">
            <LoaderCircle className="animate-spin" />
            Loading your profile...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8 flex items-center gap-4 border-b border-gray-100 pb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef4f0] text-[#253d2f]">
                <UserRound size={32} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">
                  {user?.name || "User"}
                </h2>
                <p className="mt-1 text-sm capitalize text-gray-500">
                  {user?.role || "Account"}
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {fields.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-gray-200 p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[#253d2f]">
                    <Icon size={19} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <p className="break-words text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm text-gray-500">
              Contact your administrator if your account information needs
              to be changed.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
