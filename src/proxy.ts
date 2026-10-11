import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.AUTH_SECRET,
  });

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Public pages
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Require login for protected pages
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = token.role as string | undefined;

  // Employee: only permitted pages
  const employeeAllowedRoutes = [
    "/dashboard",
    "/daily-entry",
    "/flower-purchases",
    "/companies",
    "/purchase-payments",
  ];

  if (
    role === "employee" &&
    !employeeAllowedRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Owner-only pages
  if (
    (pathname.startsWith("/users") || pathname.startsWith("/settings")) &&
    role !== "owner"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Branch management: owner and admin only
  if (
    pathname.startsWith("/branches") &&
    role !== "owner" &&
    role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/branches/:path*",
    "/daily-entry/:path*",
    "/expenses/:path*",
    "/flower-purchases/:path*",
    "/purchase-payments/:path*",
    "/companies/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/settings/:path*",
  ],
};
