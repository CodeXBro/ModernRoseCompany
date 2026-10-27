import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import "@/models/Company";
import "@/models/Branch";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  console.error("Error loading purchase payments:", error);

  const message =
    error instanceof Error
      ? error.message
      : "Failed to load purchase payments.";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN" || message.includes("not assigned to a branch")) {
    return NextResponse.json(
      { success: false, message: "You do not have access to this branch." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { success: false, message: "Failed to load purchase payments." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    await connectDB();

    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const requestedBranchId = searchParams.get("branchId");
    const companyId = searchParams.get("companyId");

    const filter: Record<string, unknown> = {};

    // Filter by payment status.
    if (status && status !== "all") {
      if (!["paid", "pending", "partial"].includes(status)) {
        return NextResponse.json(
          { success: false, message: "Invalid payment status." },
          { status: 400 },
        );
      }

      filter.paymentStatus = status;
    }

    // Apply a branch filter for owner/admin users.
    // Ignore "all" so the user can see every permitted branch.
    if (requestedBranchId && requestedBranchId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(requestedBranchId)) {
        return NextResponse.json(
          { success: false, message: "Invalid branch ID." },
          { status: 400 },
        );
      }

      filter.branchId = requestedBranchId;
    }

    // Optional company filter.
    if (companyId && companyId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return NextResponse.json(
          { success: false, message: "Invalid company ID." },
          { status: 400 },
        );
      }

      filter.companyId = companyId;
    }

    // IMPORTANT:
    // For employees, this overrides any branchId supplied by
    // the frontend and restricts results to their assigned branch.
    applyBranchAccess(user, filter);

    const purchases = await FlowerPurchase.find(filter)
      .populate("companyId", "companyName supplierName")
      .populate("branchId", "name")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    let totalAmount = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    const companyMap = new Map<
      string,
      {
        companyId: string;
        companyName: string;
        supplierName: string;
        totalAmount: number;
        paidAmount: number;
        balanceAmount: number;
        totalBills: number;
      }
    >();

    for (const purchase of purchases) {
      totalAmount += Number(purchase.totalAmount) || 0;
      totalPaid += Number(purchase.paidAmount) || 0;
      totalBalance += Number(purchase.balanceAmount) || 0;

      const company = purchase.companyId as {
        _id: unknown;
        companyName?: string;
        supplierName?: string;
      } | null;

      if (!company?._id) {
        continue;
      }

      const id = String(company._id);

      if (!companyMap.has(id)) {
        companyMap.set(id, {
          companyId: id,
          companyName: company.companyName || "",
          supplierName: company.supplierName || "",
          totalAmount: 0,
          paidAmount: 0,
          balanceAmount: 0,
          totalBills: 0,
        });
      }

      const companyData = companyMap.get(id)!;

      companyData.totalAmount += Number(purchase.totalAmount) || 0;
      companyData.paidAmount += Number(purchase.paidAmount) || 0;
      companyData.balanceAmount += Number(purchase.balanceAmount) || 0;
      companyData.totalBills += 1;
    }

    const companies = Array.from(companyMap.values()).sort(
      (a, b) => b.balanceAmount - a.balanceAmount,
    );

    return NextResponse.json({
      success: true,
      payments: {
        purchases,
        summary: {
          totalBills: purchases.length,
          totalAmount: Number(totalAmount.toFixed(2)),
          totalPaid: Number(totalPaid.toFixed(2)),
          totalBalance: Number(totalBalance.toFixed(2)),
        },
        companies,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
