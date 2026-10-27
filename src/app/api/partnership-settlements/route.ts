import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

import Branch from "@/models/Branch";
import PartnershipSettlement from "@/models/PartnershipSettlement";

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Something went wrong";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ message: "Please log in." }, { status: 401 });
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { message: "You do not have permission to perform this action." },
      { status: 403 },
    );
  }

  return NextResponse.json({ message }, { status: 400 });
}

// GET: List partnership settlements
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId");

    const filter: Record<string, unknown> = {};

    if (requestedBranchId) {
      if (!mongoose.Types.ObjectId.isValid(requestedBranchId)) {
        return NextResponse.json(
          { message: "Invalid branch ID." },
          { status: 400 },
        );
      }

      filter.branchId = new mongoose.Types.ObjectId(requestedBranchId);
    }

    applyBranchAccess(user, filter);

    const settlements = await PartnershipSettlement.find(filter)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json(settlements);
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a partnership settlement
export async function POST(request: NextRequest) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const body = await request.json();

    const { date, branchId, amount, description, notes } = body;

    if (
      !date ||
      !branchId ||
      amount === undefined ||
      amount === null ||
      !description?.trim()
    ) {
      return NextResponse.json(
        {
          message: "Date, branch, amount, and description are required.",
        },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return NextResponse.json(
        { message: "Invalid branch ID." },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { message: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    const settlementDate = new Date(date);

    if (Number.isNaN(settlementDate.getTime())) {
      return NextResponse.json(
        { message: "Invalid settlement date." },
        { status: 400 },
      );
    }

    // Employees can only create settlements for their assigned branch.
    if (user.role === "employee" && user.branchId !== branchId.toString()) {
      return NextResponse.json(
        { message: "You can only use your assigned branch." },
        { status: 403 },
      );
    }

    const branch = await Branch.findById(branchId);

    if (!branch) {
      return NextResponse.json(
        { message: "Branch not found." },
        { status: 404 },
      );
    }

    const settlement = await PartnershipSettlement.create({
      date: settlementDate,
      branchId,
      amount: numericAmount,
      description: description.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      createdBy: user.id,
    });

    const result = await PartnershipSettlement.findById(settlement._id)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .lean();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
