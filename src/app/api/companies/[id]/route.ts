import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
import { requireAuth } from "@/lib/permissions";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await requireAuth();
    await connectDB();

    const { id } = await context.params;

    const body = await request.json();

    const companyName = body.companyName?.trim();

    const supplierName = body.supplierName?.trim();

    if (!companyName) {
      return NextResponse.json(
        {
          success: false,
          message: "Company name is required",
        },
        { status: 400 },
      );
    }

    if (!supplierName) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier name is required",
        },
        { status: 400 },
      );
    }

    const company = await Company.findByIdAndUpdate(
      id,
      {
        companyName,
        supplierName,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message: "Company not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Company updated successfully",
      company,
    });
  } catch (error) {
    console.error("Error updating company:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update company",
      },
      { status: 500 },
    );
  }
}
