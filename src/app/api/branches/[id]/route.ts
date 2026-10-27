import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireBranchManagement } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      {
        success: false,
        message: "You do not have permission to edit branches.",
      },
      { status: 403 },
    );
  }

  console.error("Error updating branch:", error);

  return NextResponse.json(
    { success: false, message: "Failed to update branch." },
    { status: 500 },
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await requireBranchManagement();
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid branch ID." },
        { status: 400 },
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const { name, location, phone, isActive } = body;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Branch name is required." },
        { status: 400 },
      );
    }

    if (
      (location !== undefined && typeof location !== "string") ||
      (phone !== undefined && typeof phone !== "string")
    ) {
      return NextResponse.json(
        { success: false, message: "Location and phone must be text values." },
        { status: 400 },
      );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json(
        { success: false, message: "isActive must be true or false." },
        { status: 400 },
      );
    }

    const cleanName = name.trim();

    const duplicate = await Branch.findOne({
      _id: { $ne: id },
      name: {
        $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    }).lean();

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "A branch with this name already exists." },
        { status: 409 },
      );
    }

    const updates: Record<string, unknown> = {
      name: cleanName,
      location: typeof location === "string" ? location.trim() : "",
      phone: typeof phone === "string" ? phone.trim() : "",
    };

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    const branch = await Branch.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Branch updated successfully.",
      branch,
    });
  } catch (error) {
    return handleError(error);
  }
}
