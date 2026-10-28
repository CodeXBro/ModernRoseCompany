import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import { requireWriteAccess, applyBranchAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  console.error("Error updating daily entry:", error);

  const message =
    error instanceof Error ? error.message : "Failed to update daily entry.";

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
    { success: false, message: "Failed to update daily entry." },
    { status: 500 },
  );
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid daily entry ID." },
        { status: 400 },
      );
    }

    const entry = await DailyEntry.findById(id);

    if (!entry) {
      return NextResponse.json(
        { success: false, message: "Daily entry not found." },
        { status: 404 },
      );
    }

    // Employees can delete entries only from their assigned branch.
    if (user.role === "employee") {
      const filter: Record<string, unknown> = {};
      applyBranchAccess(user, filter);

      if (String(entry.branchId) !== String(filter.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only delete entries from your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

    await DailyEntry.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "Daily entry deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting daily entry:", error);

    const message =
      error instanceof Error ? error.message : "Failed to delete daily entry.";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Please log in to continue." },
        { status: 401 },
      );
    }

    if (
      message === "FORBIDDEN" ||
      message.includes("not assigned to a branch")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to access this branch.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to delete daily entry." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid daily entry ID." },
        { status: 400 },
      );
    }

    const existingEntry = await DailyEntry.findById(id);

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, message: "Daily entry not found." },
        { status: 404 },
      );
    }

    // Restrict employees to entries from their assigned branch.
    if (user.role === "employee") {
      const filter: Record<string, unknown> = {};
      applyBranchAccess(user, filter);

      if (String(existingEntry.branchId) !== String(filter.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only edit entries from your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

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

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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

    // Employees cannot move entries to another branch.
    const selectedBranchId =
      user.role === "employee" ? user.branchId : branchId;

    if (!selectedBranchId) {
      return NextResponse.json(
        { success: false, message: "Employee is not assigned to a branch." },
        { status: 403 },
      );
    }

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

    // Prevent two entries for the same branch and day.
    const nextDay = new Date(entryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const duplicateEntry = await DailyEntry.findOne({
      _id: { $ne: id },
      branchId: selectedBranchId,
      date: { $gte: entryDate, $lt: nextDay },
    }).select("_id");

    if (duplicateEntry) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Another daily entry already exists for this branch and date.",
        },
        { status: 409 },
      );
    }

    existingEntry.branchId = new mongoose.Types.ObjectId(selectedBranchId);
    existingEntry.date = entryDate;
    existingEntry.income = income;
    existingEntry.notes = typeof notes === "string" ? notes.trim() : "";

    await existingEntry.save();

    return NextResponse.json({
      success: true,
      message: "Daily entry updated successfully.",
      dailyEntry: existingEntry,
    });
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
