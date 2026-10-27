import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
import { requireBranchManagement } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  console.error("Company update API error:", error);

  const message =
    error instanceof Error ? error.message : "Failed to update company.";

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
        message: "Only the owner or admin can edit companies.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { success: false, message: "Failed to update company." },
    { status: 500 },
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Only owner and admin can edit companies.
    await requireBranchManagement();

    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid company ID." },
        { status: 400 },
      );
    }

    let body: {
      companyName?: unknown;
      supplierName?: unknown;
      isActive?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const companyName =
      typeof body.companyName === "string" ? body.companyName.trim() : "";

    const supplierName =
      typeof body.supplierName === "string" ? body.supplierName.trim() : "";

    if (!companyName) {
      return NextResponse.json(
        { success: false, message: "Company name is required." },
        { status: 400 },
      );
    }

    if (!supplierName) {
      return NextResponse.json(
        { success: false, message: "Supplier name is required." },
        { status: 400 },
      );
    }

    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { success: false, message: "isActive must be true or false." },
        { status: 400 },
      );
    }

    const existingCompany = await Company.findById(id);

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, message: "Company not found." },
        { status: 404 },
      );
    }

    // Preserve the current active status unless a new one is provided.
    existingCompany.companyName = companyName;
    existingCompany.supplierName = supplierName;

    if (typeof body.isActive === "boolean") {
      existingCompany.isActive = body.isActive;
    }

    await existingCompany.save();

    return NextResponse.json({
      success: true,
      message: "Company updated successfully.",
      company: existingCompany,
    });
  } catch (error) {
    return handleError(error);
  }
}
