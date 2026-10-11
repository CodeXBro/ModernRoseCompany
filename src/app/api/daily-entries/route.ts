import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import DailyEntry from "@/models/DailyEntry";
import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const filter: Record<string, unknown> = {};

    applyBranchAccess(user, filter);

    const entries = await DailyEntry.find(filter)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .sort({ date: -1 });

    return NextResponse.json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error("Error fetching daily entries:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch daily entries",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const body = await request.json();

    const { branchId, date, cash, visa, online, other, notes } = body;

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required",
        },
        {
          status: 400,
        },
      );
    }

    let selectedBranchId = branchId;

    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          {
            success: false,
            message: "Employee is not assigned to a branch.",
          },
          {
            status: 403,
          },
        );
      }

      selectedBranchId = user.branchId;
    }

    const existingEntry = await DailyEntry.findOne({
      branchId: selectedBranchId,
      date: new Date(date),
    });

    if (existingEntry) {
      return NextResponse.json(
        {
          success: false,
          message: "A daily entry already exists for this branch and date",
        },
        {
          status: 409,
        },
      );
    }

    const dailyEntry = await DailyEntry.create({
      branchId: selectedBranchId,
      date: new Date(date),

      income: {
        cash: Number(cash) || 0,
        visa: Number(visa) || 0,
        online: Number(online) || 0,
        other: Number(other) || 0,
      },

      notes,

      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Daily entry created successfully",
        dailyEntry,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Error creating daily entry:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create daily entry",
      },
      {
        status: 500,
      },
    );
  }
}
