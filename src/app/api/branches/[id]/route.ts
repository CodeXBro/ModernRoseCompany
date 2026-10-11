import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireBranchManagement } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await requireBranchManagement();
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const { name, location, phone, isActive } = body;

    const branch = await Branch.findByIdAndUpdate(
      id,
      {
        name,
        location,
        phone,
        isActive,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!branch) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Branch updated successfully",
      branch,
    });
  } catch (error) {
    console.error("Error updating branch:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update branch",
      },
      {
        status: 500,
      },
    );
  }
}
