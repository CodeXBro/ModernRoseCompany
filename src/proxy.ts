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

  // Protected pages
  const protectedRoutes = [
    "/dashboard",
    "/branches",
    "/daily-entry",
    "/expenses",
    "/flower-purchases",
    "/purchase-payments",
    "/companies",
    "/reports",
    "/users",
    "/settings",
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Owner-only routes
  if (pathname.startsWith("/users") || pathname.startsWith("/settings")) {
    if (token?.role !== "owner") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
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
