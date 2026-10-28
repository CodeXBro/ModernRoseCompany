
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import Expense from "@/models/Expense";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    await connectDB();

    const { searchParams } = new URL(request.url);

    const date = searchParams.get("date")?.trim();
    const requestedBranchId = searchParams.get("branchId")?.trim();

    if (!date || !isValidDateString(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid date is required in YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    if (
      requestedBranchId &&
      !mongoose.Types.ObjectId.isValid(requestedBranchId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid branch ID.",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);

    const branchFilter: Record<string, unknown> = requestedBranchId
      ? { branchId: requestedBranchId }
      : {};

    // Preserve existing branch access restrictions.
    applyBranchAccess(user, branchFilter);

    const effectiveBranchId =
      user.role === "employee" ? user.branchId : requestedBranchId || "all";

    const dateFilter = {
      $gte: startDate,
      $lte: endDate,
    };

    const [dailyEntries, flowerPurchases] = await Promise.all([
      DailyEntry.find({
        date: dateFilter,
        ...branchFilter,
      }).lean(),

      FlowerPurchase.find({
        date: dateFilter,
        ...branchFilter,
      }).lean(),
    ]);

    let cashIncome = 0;
    let visaIncome = 0;
    let onlineIncome = 0;
    let otherIncome = 0;

    for (const entry of dailyEntries) {
      cashIncome += Number(entry.income?.cash ?? 0);
      visaIncome += Number(entry.income?.visa ?? 0);
      onlineIncome += Number(entry.income?.online ?? 0);
      otherIncome += Number(entry.income?.other ?? 0);
    }

    const totalIncome =
      cashIncome + visaIncome + onlineIncome + otherIncome;

    // Only flower purchases are deducted from income.
    // General expenses are intentionally excluded.
    const flowerPurchaseTotal = flowerPurchases.reduce(
      (total, purchase) =>
        total + Number(purchase.totalAmount ?? 0),
      0,
    );

    const netProfit = totalIncome - flowerPurchaseTotal;

    return NextResponse.json({
      success: true,
      report: {
        date,
        branchId: effectiveBranchId,
        income: {
          cash: cashIncome,
          visa: visaIncome,
          online: onlineIncome,
          other: otherIncome,
          total: totalIncome,
        },
        expenses: {
          general: 0,
          flowerPurchases: flowerPurchaseTotal,
          total: flowerPurchaseTotal,
        },
        netProfit,
      },
    });
  } catch (error) {
    console.error("Error generating profit report:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in to access this report.",
        },
        { status: 401 },
      );
    }

    if (
      message === "FORBIDDEN" ||
      message === "Employee is not assigned to a branch."
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to access this report.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate profit report.",
      },
      { status: 500 },
    );
  }
}
