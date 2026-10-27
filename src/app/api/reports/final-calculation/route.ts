
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import PartnershipSettlement from "@/models/PartnershipSettlement";
import PartnerFundedPayment from "@/models/PartnerFundedPayment";
import { requireAuth, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function isValidMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;

  const [year, month] = value.split("-").map(Number);

  return year >= 2000 && month >= 1 && month <= 12;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const requestedBranchId = searchParams.get("branchId");

    if (!month || !isValidMonth(month)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid month is required in YYYY-MM format.",
        },
        { status: 400 }
      );
    }

    if (
      requestedBranchId &&
      !mongoose.Types.ObjectId.isValid(requestedBranchId)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid branch ID." },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);

    // Use a half-open date range to include every day in the month.
    const startDate = new Date(year, monthNumber - 1, 1);
    const endDate = new Date(year, monthNumber, 1);

    const branchFilter: Record<string, unknown> = requestedBranchId
      ? {
          branchId: new mongoose.Types.ObjectId(requestedBranchId),
        }
      : {};

    applyBranchAccess(user, branchFilter);

    const effectiveBranchId =
      user.role === "employee" ? user.branchId : requestedBranchId || "all";

    const dateFilter = {
      $gte: startDate,
      $lt: endDate,
    };

    const [dailyEntries, settlements, partnerPayments] = await Promise.all([
      DailyEntry.find({
        date: dateFilter,
        ...branchFilter,
      }).lean(),

      PartnershipSettlement.find({
        date: dateFilter,
        ...branchFilter,
      }).lean(),

      PartnerFundedPayment.find({
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

    const settlementTotal = settlements.reduce(
      (total, item) => total + Number(item.amount ?? 0),
      0
    );

    const partnerFundedPaymentTotal = partnerPayments.reduce(
      (total, item) => total + Number(item.amount ?? 0),
      0
    );

    // Following your specified business formula:
    // Total income - settlements - partner-funded payments - cash income.
    const finalBalance =
      totalIncome -
      settlementTotal -
      partnerFundedPaymentTotal -
      cashIncome;

    return NextResponse.json({
      success: true,
      report: {
        month,
        branchId: effectiveBranchId,
        income: {
          cash: cashIncome,
          visa: visaIncome,
          online: onlineIncome,
          other: otherIncome,
          total: totalIncome,
        },
        settlements: settlementTotal,
        partnerFundedPayments: partnerFundedPaymentTotal,
        finalBalance,
        recordCounts: {
          dailyEntries: dailyEntries.length,
          settlements: settlements.length,
          partnerFundedPayments: partnerPayments.length,
        },
      },
    });
  } catch (error) {
    console.error("Error generating final calculation:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Please log in to access this report." },
        { status: 401 }
      );
    }

    if (
      message === "FORBIDDEN" ||
      message.includes("assigned to a valid branch") ||
      message.includes("assigned to a branch")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to access this report.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to generate final calculation." },
      { status: 500 }
    );
  }
}
