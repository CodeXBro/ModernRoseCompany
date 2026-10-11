
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Daily Entry",
    href: "/daily-entry",
    icon: ClipboardList,
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
  },
  {
    label: "Flower Purchases",
    href: "/flower-purchases",
    icon: Flower2,
  },
  {
    label: "Companies",
    href: "/companies",
    icon: Building2,
  },
  {
    label: "Purchase Payments",
    href: "/purchase-payments",
    icon: Receipt,
  },
  {
    label: "Branches",
    href: "/branches",
    icon: Building2,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">

        {/* Logo */}
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-xl font-bold text-[#253d2f]">
            Modern Rose
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Management System
          </p>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href ||
              (item.href !== "/" &&
                pathname.startsWith(item.href));

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

        {/* Logout */}
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
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

