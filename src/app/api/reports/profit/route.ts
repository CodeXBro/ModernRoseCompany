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

    const date = searchParams.get("date");
    const branchId = searchParams.get("branchId");

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required",
        },
        { status: 400 }
      );
    }

    const startDate = new Date(`${date}T00:00:00`);
    const endDate = new Date(`${date}T23:59:59.999`);

    const branchFilter = branchId ? { branchId } : {};

    const dailyEntries = await DailyEntry.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      ...branchFilter,
    }).lean();

    const expenses = await Expense.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      ...branchFilter,
    }).lean();

    const flowerPurchases = await FlowerPurchase.find({
      date: {
        $gte: startDate,
        $lte: endDate,
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
        date,
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
    console.error("Error generating profit report:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate profit report",
      },
      { status: 500 }
    );
  }
}