
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import DailyEntry from "@/models/DailyEntry";
import Expense from "@/models/Expense";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);

    const date =
      searchParams.get("date") ||
      new Date().toISOString().split("T")[0];

    const branchId = searchParams.get("branchId");

    const startDate = new Date(
      `${date}T00:00:00`,
    );

    const endDate = new Date(
      `${date}T23:59:59.999`,
    );

    const branchFilter = branchId
      ? { branchId }
      : {};

    /*
     * Get today's data
     */
    const dailyEntries =
      await DailyEntry.find({
        date: {
          $gte: startDate,
          $lte: endDate,
        },
        ...branchFilter,
      }).lean();

    const expenses =
      await Expense.find({
        date: {
          $gte: startDate,
          $lte: endDate,
        },
        ...branchFilter,
      }).lean();

    const flowerPurchases =
      await FlowerPurchase.find({
        date: {
          $gte: startDate,
          $lte: endDate,
        },
        ...branchFilter,
      }).lean();

    /*
     * Calculate total income
     */
    let cash = 0;
    let visa = 0;
    let online = 0;
    let other = 0;

    for (const entry of dailyEntries) {
      cash += entry.income.cash;
      visa += entry.income.visa;
      online += entry.income.online;
      other += entry.income.other;
    }

    const totalIncome =
      cash +
      visa +
      online +
      other;

    /*
     * Calculate general expenses
     */
    let generalExpenses = 0;

    for (const expense of expenses) {
      generalExpenses += expense.amount;
    }

    /*
     * Calculate flower purchases
     */
    let flowerPurchaseTotal = 0;

    for (const purchase of flowerPurchases) {
      flowerPurchaseTotal +=
        purchase.totalAmount;
    }

    const totalExpenses =
      generalExpenses +
      flowerPurchaseTotal;

    const netProfit =
      totalIncome - totalExpenses;

    /*
     * Get active branches
     */
    const branches = await Branch.find({
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    /*
     * Calculate performance for each branch
     */
    const branchPerformance = branches.map(
      (branch) => {
        const branchEntries =
          dailyEntries.filter(
            (entry) =>
              entry.branchId.toString() ===
              branch._id.toString(),
          );

        const branchExpenses =
          expenses.filter(
            (expense) =>
              expense.branchId.toString() ===
              branch._id.toString(),
          );

        const branchFlowerPurchases =
          flowerPurchases.filter(
            (purchase) =>
              purchase.branchId.toString() ===
              branch._id.toString(),
          );

        let branchCash = 0;
        let branchVisa = 0;
        let branchOnline = 0;
        let branchOther = 0;

        for (const entry of branchEntries) {
          branchCash += entry.income.cash;
          branchVisa += entry.income.visa;
          branchOnline += entry.income.online;
          branchOther += entry.income.other;
        }

        const branchIncome =
          branchCash +
          branchVisa +
          branchOnline +
          branchOther;

        let branchGeneralExpenses = 0;

        for (const expense of branchExpenses) {
          branchGeneralExpenses +=
            expense.amount;
        }

        let branchFlowerPurchaseTotal = 0;

        for (
          const purchase of branchFlowerPurchases
        ) {
          branchFlowerPurchaseTotal +=
            purchase.totalAmount;
        }

        const branchTotalExpenses =
          branchGeneralExpenses +
          branchFlowerPurchaseTotal;

        const branchProfit =
          branchIncome -
          branchTotalExpenses;

        return {
          branchId: branch._id.toString(),
          branchName: branch.name,

          income: branchIncome,

          expenses: branchTotalExpenses,

          profit: branchProfit,
        };
      },
    );

    return NextResponse.json({
      success: true,

      dashboard: {
        date,

        income: {
          cash,
          visa,
          online,
          other,
          total: totalIncome,
        },

        expenses: {
          general: generalExpenses,
          flowerPurchases:
            flowerPurchaseTotal,
          total: totalExpenses,
        },

        netProfit,

        branchPerformance,
      },
    });
  } catch (error) {
    console.error(
      "Error loading dashboard:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load dashboard data",
      },
      { status: 500 },
    );
  }
}

