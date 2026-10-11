import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import "@/models/Company";
import "@/models/Branch";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    await connectDB();

    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");

    const branchId = searchParams.get("branchId");

    const companyId = searchParams.get("companyId");

    const filter: Record<string, unknown> = {};

    // Payment status filter
    if (status && ["paid", "pending", "partial"].includes(status)) {
      filter.paymentStatus = status;
    }

    // Branch filter
    if (branchId) {
      filter.branchId = branchId;
    }

    // Company filter
    if (companyId) {
      filter.companyId = companyId;
    }

    // Employee branch restriction.
    // This overrides any branchId supplied
    // by the frontend.
    applyBranchAccess(user, filter);

    const purchases = await FlowerPurchase.find(filter)
      .populate("companyId", "companyName supplierName")
      .populate("branchId", "name")
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    let totalAmount = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    for (const purchase of purchases) {
      totalAmount += purchase.totalAmount || 0;

      totalPaid += purchase.paidAmount || 0;

      totalBalance += purchase.balanceAmount || 0;
    }

    // Company-wise summary
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

      companyData.totalAmount += purchase.totalAmount || 0;

      companyData.paidAmount += purchase.paidAmount || 0;

      companyData.balanceAmount += purchase.balanceAmount || 0;

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
          totalAmount,
          totalPaid,
          totalBalance,
        },

        companies,
      },
    });
  } catch (error) {
    console.error("Error loading purchase payments:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load purchase payments",
      },
      { status: 500 },
    );
  }
}
