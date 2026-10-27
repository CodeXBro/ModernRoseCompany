import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
import { requireAuth, requireBranchManagement } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  console.error("Companies API error:", error);

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

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
        message: "You do not have permission to perform this action.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "An error occurred while processing companies.",
    },
    { status: 500 },
  );
}

// GET: All authenticated users can view companies.
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
    return handleError(error);
  }
}

// POST: Only owner and admin can create companies.
export async function POST(request: Request) {
  try {
    await requireBranchManagement();
    await connectDB();

    let body: {
      companyName?: unknown;
      supplierName?: unknown;
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

    // Avoid accidentally creating an exact duplicate company/supplier pair.
    const existingCompany = await Company.findOne({
      companyName: {
        $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
      supplierName: {
        $regex: `^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (existingCompany) {
      return NextResponse.json(
        {
          success: false,
          message: "This company and supplier already exist.",
        },
        { status: 409 },
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
        message: "Company added successfully.",
        company,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
