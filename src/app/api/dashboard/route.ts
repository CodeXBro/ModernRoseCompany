import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import DailyEntry from "@/models/DailyEntry";
import Expense from "@/models/Expense";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function getUaeDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function money(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function idOf(value: unknown): string {
  if (!value) return "";

  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }

  return String(value);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await connectDB();

    const params = request.nextUrl.searchParams;
    const mode = params.get("mode") === "day" ? "day" : "month";
    const selectedDate = params.get("date") || getUaeDate();
    const requestedBranchId = params.get("branchId") || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return NextResponse.json(
        { success: false, message: "Invalid date." },
        { status: 400 },
      );
    }

    const [year, month, day] = selectedDate.split("-").map(Number);
    const validationDate = new Date(Date.UTC(year, month - 1, day));

    if (
      validationDate.getUTCFullYear() !== year ||
      validationDate.getUTCMonth() !== month - 1 ||
      validationDate.getUTCDate() !== day
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid date." },
        { status: 400 },
      );
    }

    if (requestedBranchId && !mongoose.isValidObjectId(requestedBranchId)) {
      return NextResponse.json(
        { success: false, message: "Invalid branch ID." },
        { status: 400 },
      );
    }

    const startDate =
      mode === "day"
        ? new Date(Date.UTC(year, month - 1, day))
        : new Date(Date.UTC(year, month - 1, 1));

    const endDate =
      mode === "day"
        ? new Date(Date.UTC(year, month - 1, day + 1))
        : new Date(Date.UTC(year, month, 1));

    // Employees are always restricted to their assigned branch.
    const branchFilter: Record<string, unknown> = {};

    if (requestedBranchId) {
      branchFilter.branchId = requestedBranchId;
    }

    applyBranchAccess(user, branchFilter);

    if (requestedBranchId && user.role !== "employee") {
      const branchExists = await Branch.exists({
        _id: requestedBranchId,
      });

      if (!branchExists) {
        return NextResponse.json(
          { success: false, message: "Branch not found." },
          { status: 404 },
        );
      }
    }

    const dateFilter = {
      date: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    const branchQuery =
      user.role === "employee"
        ? { _id: user.branchId }
        : requestedBranchId
          ? { _id: requestedBranchId }
          : {};

    const [dailyEntries, expenseRecords, purchases, branchDocuments] =
      await Promise.all([
        DailyEntry.find({ ...dateFilter, ...branchFilter }).lean(),
        Expense.find({ ...dateFilter, ...branchFilter }).lean(),
        FlowerPurchase.find({ ...dateFilter, ...branchFilter }).lean(),
        Branch.find(branchQuery).lean(),
      ]);

    type BranchTotals = {
      branchId: string;
      branchName: string;
      cash: number;
      visa: number;
      online: number;
      other: number;
      generalExpenses: number;
      flowerPurchases: number;
    };

    const totals = {
      cash: 0,
      visa: 0,
      online: 0,
      other: 0,
      general: 0,
      flowerPurchases: 0,
    };

    const branchTotals = new Map<string, BranchTotals>();

    for (const branch of branchDocuments) {
      const branchId = String(branch._id);

      branchTotals.set(branchId, {
        branchId,
        branchName: branch.name,
        cash: 0,
        visa: 0,
        online: 0,
        other: 0,
        generalExpenses: 0,
        flowerPurchases: 0,
      });
    }

    function getBranch(value: unknown) {
      return branchTotals.get(idOf(value));
    }

    for (const entry of dailyEntries) {
      const branch = getBranch(entry.branchId);
      if (!branch) continue;

      const income = entry.income as
        | {
            cash?: number;
            visa?: number;
            online?: number;
            other?: number;
          }
        | undefined;

      const cash = money(income?.cash);
      const visa = money(income?.visa);
      const online = money(income?.online);
      const other = money(income?.other);

      branch.cash += cash;
      branch.visa += visa;
      branch.online += online;
      branch.other += other;

      totals.cash += cash;
      totals.visa += visa;
      totals.online += online;
      totals.other += other;
    }

    for (const expense of expenseRecords) {
      const branch = getBranch(expense.branchId);
      if (!branch) continue;

      const amount = money(expense.amount);

      branch.generalExpenses += amount;
      totals.general += amount;
    }

    for (const purchase of purchases) {
      const branch = getBranch(purchase.branchId);
      if (!branch) continue;

      const amount = money(purchase.totalAmount);

      branch.flowerPurchases += amount;
      totals.flowerPurchases += amount;
    }

    const branchPerformance = Array.from(branchTotals.values()).map(
      (branch) => {
        const income = branch.cash + branch.visa + branch.online + branch.other;

        const expenses = branch.generalExpenses + branch.flowerPurchases;

        return {
          branchId: branch.branchId,
          branchName: branch.branchName,
          cash: branch.cash,
          visa: branch.visa,
          online: branch.online,
          other: branch.other,
          income,
          generalExpenses: branch.generalExpenses,
          flowerPurchases: branch.flowerPurchases,
          expenses,
          profit: income - expenses,
        };
      },
    );

    const totalIncome =
      totals.cash + totals.visa + totals.online + totals.other;

    const totalExpenses = totals.general + totals.flowerPurchases;

    return NextResponse.json({
      success: true,
      dashboard: {
        date: selectedDate,
        mode,
        period: {
          startDate: startDate.toISOString(),
          endDate: new Date(endDate.getTime() - 1).toISOString(),
        },
        income: {
          cash: totals.cash,
          visa: totals.visa,
          online: totals.online,
          other: totals.other,
          total: totalIncome,
        },
        expenses: {
          general: totals.general,
          flowerPurchases: totals.flowerPurchases,
          total: totalExpenses,
        },
        netProfit: totalIncome - totalExpenses,
        branchPerformance,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Please log in." },
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
          message: "You do not have permission to access this data.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to load dashboard data." },
      { status: 500 },
    );
  }
}
