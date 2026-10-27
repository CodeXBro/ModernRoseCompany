import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import { requireAuth, requireWriteAccess } from "@/lib/permissions";

import Branch from "@/models/Branch";
import PartnershipSettlement from "@/models/PartnershipSettlement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

async function getAccessibleSettlement(
  id: string,
  user: Awaited<ReturnType<typeof requireAuth>>,
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const filter: Record<string, unknown> = {
    _id: new mongoose.Types.ObjectId(id),
  };

  if (user.role === "employee") {
    if (!user.branchId || !mongoose.Types.ObjectId.isValid(user.branchId)) {
      throw new Error("Employee is not assigned to a valid branch.");
    }

    filter.branchId = new mongoose.Types.ObjectId(user.branchId);
  }

  return PartnershipSettlement.findOne(filter);
}

// PATCH: Update a settlement
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await context.params;
    const settlement = await getAccessibleSettlement(id, user);

    if (!settlement) {
      return NextResponse.json(
        { message: "Settlement not found." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.date !== undefined) {
      const date = new Date(body.date);

      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          { message: "Invalid settlement date." },
          { status: 400 },
        );
      }

      updates.date = date;
    }

    if (body.branchId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(body.branchId)) {
        return NextResponse.json(
          { message: "Invalid branch ID." },
          { status: 400 },
        );
      }

      if (
        user.role === "employee" &&
        user.branchId !== body.branchId.toString()
      ) {
        return NextResponse.json(
          { message: "You can only use your assigned branch." },
          { status: 403 },
        );
      }

      const branch = await Branch.findById(body.branchId);

      if (!branch) {
        return NextResponse.json(
          { message: "Branch not found." },
          { status: 404 },
        );
      }

      updates.branchId = body.branchId;
    }

    if (body.amount !== undefined) {
      const amount = Number(body.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { message: "Amount must be greater than zero." },
          { status: 400 },
        );
      }

      updates.amount = amount;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string" || !body.description.trim()) {
        return NextResponse.json(
          { message: "Description is required." },
          { status: 400 },
        );
      }

      updates.description = body.description.trim();
    }

    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim() : "";
    }

    updates.updatedBy = user.id;

    Object.assign(settlement, updates);
    await settlement.save();

    const result = await PartnershipSettlement.findById(settlement._id)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .lean();

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete a settlement
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();

    // Only owners and admins can delete records.
    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("FORBIDDEN");
    }

    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Invalid settlement ID." },
        { status: 400 },
      );
    }

    const deleted = await PartnershipSettlement.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { message: "Settlement not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Settlement deleted successfully.",
    });
  } catch (error) {
    return handleError(error);
  }
}
