import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireAuth, requireBranchManagement } from "@/lib/permissions";
export async function GET() {
  try {
    await requireAuth();
    await connectDB();

    const branches = await Branch.find().sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error("Error fetching branches:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch branches",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireBranchManagement();
    await connectDB();

    const body = await request.json();

    const { name, location, phone } = body;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch name is required",
        },
        {
          status: 400,
        },
      );
    }

    const branch = await Branch.create({
      name,
      location,
      phone,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Branch created successfully",
        branch,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Error creating branch:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create branch",
      },
      {
        status: 500,
      },
    );
  }
}
