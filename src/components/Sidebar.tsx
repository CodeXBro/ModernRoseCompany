
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  Flower2,
  Building2,
  BarChart3,
  Users,
  Settings,
  LogOut,
  HandCoins,
  Handshake,
  Calculator,
  UserRound,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Entry", href: "/daily-entry", icon: ClipboardList },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Flower Purchases", href: "/flower-purchases", icon: Flower2 },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Purchase Payments", href: "/purchase-payments", icon: Receipt },
  {
    label: "Partner-Funded Payments",
    href: "/partner-funded-payments",
    icon: HandCoins,
  },
  {
    label: "Settlements",
    href: "/Settlement",
    icon: Handshake,
  },
  {
    label: "Final Calculation",
    href: "/final-calculation",
    icon: Calculator,
  },
  { label: "Branches", href: "/branches", icon: Building2 },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Users", href: "/users", icon: Users },
];

const employeeAllowedRoutes = [
  "/dashboard",
  "/daily-entry",
  "/flower-purchases",
  "/companies",
  "/purchase-payments",
  "/partner-funded-payments",
  "/Settlement",
];

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function Sidebar() {
  const pathname = usePathname();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const session = await response.json();

        if (active) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("Error loading session:", error);

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setSessionLoaded(true);
        }
      }
    }

    setSessionLoaded(false);
    loadSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  const role = (user?.role ?? "").toLowerCase();

  const visibleMenuItems = !sessionLoaded
    ? []
    : role === "employee"
      ? menuItems.filter((item) =>
          employeeAllowedRoutes.includes(item.href),
        )
      : role === "owner"
        ? menuItems
        : role === "admin"
          ? menuItems.filter((item) => item.href !== "/users")
          : role === "viewer"
            ? menuItems.filter((item) =>
                ["/dashboard", "/reports"].includes(item.href),
              )
            : [];

  const displayName =
    user?.name?.trim() || user?.email?.trim() || "Logged-in User";

  const displayRole = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : "User";

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-xl font-bold text-[#253d2f]">
            Modern Rose
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Management System
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#eef4f0] text-[#253d2f]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-[#253d2f]"
                }`}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          {/* My Profile is available to every logged-in role */}
          {sessionLoaded && user && (
            <Link
              href="/my-profile"
              className={`mb-3 flex min-w-0 items-center gap-3 rounded-lg p-2 transition hover:bg-gray-50 ${
                pathname === "/my-profile"
                  ? "bg-[#eef4f0]"
                  : ""
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4f0] text-[#253d2f]">
                <UserRound size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  My Profile
                </p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {displayName}
                </p>
                <p className="mt-1 text-xs capitalize text-gray-500">
                  {displayRole}
                </p>
              </div>
            </Link>
          )}

          {/* Settings is visible only to owners */}
          {sessionLoaded && role === "owner" && (
            <Link
              href="/settings"
              className={`mb-3 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                pathname === "/settings"
                  ? "bg-[#eef4f0] text-[#253d2f]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-[#253d2f]"
              }`}
            >
              <Settings size={19} />
              <span>Settings</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#253d2f]"
          >
            <LogOut size={19} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
