import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import { requireWriteAccess, applyBranchAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    const existingEntry = await DailyEntry.findById(id);

    if (!existingEntry) {
      return NextResponse.json(
        {
          success: false,
          message: "Daily entry not found",
        },
        { status: 404 },
      );
    }

    // Employees can only edit their assigned branch.
    if (user.role === "employee") {
      const filter: Record<string, unknown> = {};

      applyBranchAccess(user, filter);

      if (existingEntry.branchId.toString() !== String(filter.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only edit entries from your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

    const body = await request.json();

    const { branchId, date, cash, visa, online, other, notes } = body;

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch is required",
        },
        { status: 400 },
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required",
        },
        { status: 400 },
      );
    }

    let selectedBranchId = branchId;

    // Employees cannot move an entry to another branch.
    if (user.role === "employee") {
      selectedBranchId = user.branchId;
    }

    const dailyEntry = await DailyEntry.findByIdAndUpdate(
      id,
      {
        branchId: selectedBranchId,
        date: new Date(date),
        income: {
          cash: Number(cash) || 0,
          visa: Number(visa) || 0,
          online: Number(online) || 0,
          other: Number(other) || 0,
        },
        notes: notes?.trim(),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Daily entry updated successfully",
      dailyEntry,
    });
  } catch (error) {
    console.error("Error updating daily entry:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update daily entry",
      },
      { status: 500 },
    );
  }
}
