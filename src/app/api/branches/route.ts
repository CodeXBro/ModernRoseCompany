import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireAuth, requireBranchManagement } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    // Employees can only access their assigned branch.
    const filter =
      user.role === "employee"
        ? user.branchId
          ? { _id: user.branchId }
          : { _id: null }
        : {};

    const branches = await Branch.find(filter).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error("Error fetching branches:", error);

    const message = error instanceof Error ? error.message : "";

    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        message: status === 500 ? "Failed to fetch branches" : message,
      },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireBranchManagement();
    await connectDB();

    const body = await request.json();
    const { name, location, phone } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch name is required",
        },
        { status: 400 },
      );
    }

    const branch = await Branch.create({
      name: name.trim(),
      location,
      phone,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Branch created successfully",
        branch,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating branch:", error);

    const message = error instanceof Error ? error.message : "";

    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        message: status === 500 ? "Failed to create branch" : message,
      },
      { status },
    );
  }
}
