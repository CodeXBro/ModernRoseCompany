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
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Entry", href: "/daily-entry", icon: ClipboardList },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Flower Purchases", href: "/flower-purchases", icon: Flower2 },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Purchase Payments", href: "/purchase-payments", icon: Receipt },
  { label: "Branches", href: "/branches", icon: Building2 },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Users", href: "/users", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

const employeeAllowedRoutes = [
  "/dashboard",
  "/daily-entry",
  "/flower-purchases",
  "/companies",
  "/purchase-payments",
];

export default function Sidebar() {
  const pathname = usePathname();

  const [role, setRole] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      setSessionLoaded(false);

      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const session = await response.json();

        if (!active) return;

        setRole(session?.user?.role ?? "");
      } catch (error) {
        console.error("Error loading session:", error);

        if (active) {
          setRole("");
        }
      } finally {
        if (active) {
          setSessionLoaded(true);
        }
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  const visibleMenuItems =
    !sessionLoaded || role === "employee"
      ? menuItems.filter((item) => employeeAllowedRoutes.includes(item.href))
      : role === "owner" || role === "admin" || role === "viewer"
        ? menuItems.filter((item) =>
            role === "owner"
              ? true
              : role === "admin"
                ? item.href !== "/users" && item.href !== "/settings"
                : ["/dashboard", "/reports"].includes(item.href),
          )
        : [];

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-xl font-bold text-[#253d2f]">Modern Rose</h1>
          <p className="mt-1 text-sm text-gray-500">Management System</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

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
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-[#253d2f]"
          >
            <LogOut size={19} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
