import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import Branch from "@/models/Branch";
import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  console.error("Daily Entries API error:", error);

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN" || message.includes("not assigned to a branch")) {
    return NextResponse.json(
      {
        success: false,
        message: "You do not have permission to access this branch.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { success: false, message: "Failed to process daily entries." },
    { status: 500 },
  );
}

// GET: Employees can only view entries for their assigned branch.
export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const filter: Record<string, unknown> = {};

    applyBranchAccess(user, filter);

    const entries = await DailyEntry.find(filter)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      entries,
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a daily entry.
export async function POST(request: Request) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    let body: {
      branchId?: unknown;
      date?: unknown;
      cash?: unknown;
      visa?: unknown;
      online?: unknown;
      other?: unknown;
      notes?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const { branchId, date, cash, visa, online, other, notes } = body;

    if (typeof branchId !== "string" || !branchId.trim()) {
      return NextResponse.json(
        { success: false, message: "Branch is required." },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return NextResponse.json(
        { success: false, message: "Invalid branch ID." },
        { status: 400 },
      );
    }

    if (typeof date !== "string" || !date.trim()) {
      return NextResponse.json(
        { success: false, message: "Date is required." },
        { status: 400 },
      );
    }

    // Require a valid date in YYYY-MM-DD format.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Date must use YYYY-MM-DD format." },
        { status: 400 },
      );
    }

    const entryDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(entryDate.getTime()) ||
      entryDate.toISOString().slice(0, 10) !== date
    ) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid date." },
        { status: 400 },
      );
    }

    // Employees must use their assigned branch, regardless of the request.
    let selectedBranchId = branchId;

    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          { success: false, message: "Employee is not assigned to a branch." },
          { status: 403 },
        );
      }

      selectedBranchId = user.branchId;
    }

    const branch = await Branch.findById(selectedBranchId).select("_id");

    if (!branch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 },
      );
    }

    // Missing amounts default to zero. Supplied amounts must be valid,
    // finite, non-negative numbers.
    function parseAmount(value: unknown, field: string): number {
      if (value === undefined || value === null || value === "") {
        return 0;
      }

      const amount = Number(value);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Invalid amount for ${field}.`);
      }

      return amount;
    }

    let income: {
      cash: number;
      visa: number;
      online: number;
      other: number;
    };

    try {
      income = {
        cash: parseAmount(cash, "cash"),
        visa: parseAmount(visa, "visa"),
        online: parseAmount(online, "online"),
        other: parseAmount(other, "other"),
      };
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Invalid income amounts.",
        },
        { status: 400 },
      );
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { success: false, message: "Notes must be text." },
        { status: 400 },
      );
    }

    // Check the full UTC day to avoid duplicate entries caused by timestamps.
    const nextDay = new Date(entryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const existingEntry = await DailyEntry.findOne({
      branchId: selectedBranchId,
      date: {
        $gte: entryDate,
        $lt: nextDay,
      },
    }).select("_id");

    if (existingEntry) {
      return NextResponse.json(
        {
          success: false,
          message: "A daily entry already exists for this branch and date.",
        },
        { status: 409 },
      );
    }

    const dailyEntry = await DailyEntry.create({
      branchId: selectedBranchId,
      date: entryDate,
      income,
      notes: typeof notes === "string" ? notes.trim() : "",
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Daily entry created successfully.",
        dailyEntry,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid amount for ")
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    return handleError(error);
  }
}
