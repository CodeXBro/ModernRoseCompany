import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
import { requireAuth, requireWriteAccess } from "@/lib/permissions";
export async function GET() {
  try {
    await requireAuth();
    await connectDB();

    const companies = await Company.find().sort({ companyName: 1 }).lean();

    return NextResponse.json({
      success: true,
      companies,
    });
  } catch (error) {
    console.error("Error loading companies:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load companies",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireWriteAccess();
    await connectDB();

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

    const company = await Company.create({
      companyName,
      supplierName,
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Company added successfully",
        company,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating company:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create company",
      },
      { status: 500 },
    );
  }
}
