
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import Expense from "@/models/Expense";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    if (!startDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Start date is required",
        },
        { status: 400 },
      );
    }

    if (!endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "End date is required",
        },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Start date cannot be after end date",
        },
        { status: 400 },
      );
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const branchFilter = branchId
      ? { branchId }
      : {};

    const dailyEntries = await DailyEntry.find({
      date: {
        $gte: start,
        $lte: end,
      },
      ...branchFilter,
    }).lean();

    const expenses = await Expense.find({
      date: {
        $gte: start,
        $lte: end,
      },
      ...branchFilter,
    }).lean();

    const flowerPurchases = await FlowerPurchase.find({
      date: {
        $gte: start,
        $lte: end,
      },
      ...branchFilter,
    }).lean();

    let cashIncome = 0;
    let visaIncome = 0;
    let onlineIncome = 0;
    let otherIncome = 0;

    for (const entry of dailyEntries) {
      cashIncome += entry.income.cash;
      visaIncome += entry.income.visa;
      onlineIncome += entry.income.online;
      otherIncome += entry.income.other;
    }

    const totalIncome =
      cashIncome +
      visaIncome +
      onlineIncome +
      otherIncome;

    let generalExpenses = 0;

    for (const expense of expenses) {
      generalExpenses += expense.amount;
    }

    let flowerPurchaseTotal = 0;

    for (const purchase of flowerPurchases) {
      flowerPurchaseTotal += purchase.totalAmount;
    }

    const totalExpenses =
      generalExpenses + flowerPurchaseTotal;

    const netProfit = totalIncome - totalExpenses;

    return NextResponse.json({
      success: true,

      report: {
        startDate,
        endDate,
        branchId: branchId || "all",

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
    console.error(
      "Error generating date range report:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate date range report",
      },
      { status: 500 },
    );
  }
}

