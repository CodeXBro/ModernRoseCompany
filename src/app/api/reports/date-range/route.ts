import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import Expense from "@/models/Expense";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    await connectDB();

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const requestedBranchId = searchParams.get("branchId");

    // Validate required dates.
    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Start date and end date are required.",
        },
        { status: 400 },
      );
    }

    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid date. Use YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Start date cannot be after end date.",
        },
        { status: 400 },
      );
    }

    // Validate a supplied branch ID.
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

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);

    // Apply server-side branch permissions.
    const branchFilter: Record<string, unknown> = requestedBranchId
      ? { branchId: requestedBranchId }
      : {};

    applyBranchAccess(user, branchFilter);

    const effectiveBranchId =
      user.role === "employee" ? user.branchId : requestedBranchId || "all";

    const dateFilter = {
      $gte: start,
      $lte: end,
    };

    const [dailyEntries, expenses, flowerPurchases] = await Promise.all([
      DailyEntry.find({
        date: dateFilter,
        ...branchFilter,
      }).lean(),

      Expense.find({
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

    const totalIncome = cashIncome + visaIncome + onlineIncome + otherIncome;

    const generalExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount ?? 0),
      0,
    );

    const flowerPurchaseTotal = flowerPurchases.reduce(
      (total, purchase) => total + Number(purchase.totalAmount ?? 0),
      0,
    );

    const totalExpenses = generalExpenses + flowerPurchaseTotal;

    const netProfit = totalIncome - totalExpenses;

    return NextResponse.json({
      success: true,
      report: {
        startDate,
        endDate,
        branchId: effectiveBranchId,

        income: {
          cash: cashIncome,
          visa: visaIncome,
          online: onlineIncome,
          other: otherIncome,
          total: totalIncome,
        },

        expenses: {
          general: generalExpenses,
          flowerPurchases: flowerPurchaseTotal,
          total: totalExpenses,
        },

        netProfit,
      },
    });
  } catch (error) {
    console.error("Error generating date range report:", error);

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
        message: "Failed to generate date range report.",
      },
      { status: 500 },
    );
  }
}
