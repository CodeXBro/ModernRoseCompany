import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import { requireAuth, requireBranchManagement } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function handleError(error: unknown, action: string) {
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
        message: "You do not have permission to perform this action.",
      },
      { status: 403 },
    );
  }

  console.error(`Error ${action} branch:`, error);

  return NextResponse.json(
    { success: false, message: `Failed to ${action} branch.` },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const filter =
      user.role === "employee"
        ? user.branchId
          ? { _id: user.branchId }
          : { _id: null }
        : {};

    const branches = await Branch.find(filter).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, branches });
  } catch (error) {
    return handleError(error, "fetch");
  }
}

export async function POST(request: Request) {
  try {
    await requireBranchManagement();
    await connectDB();

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const { name, location, phone } = body;

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

    const cleanName = name.trim();

    const existingBranch = await Branch.findOne({
      name: {
        $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    }).lean();

    if (existingBranch) {
      return NextResponse.json(
        { success: false, message: "A branch with this name already exists." },
        { status: 409 },
      );
    }

    const branch = await Branch.create({
      name: cleanName,
      location: typeof location === "string" ? location.trim() : "",
      phone: typeof phone === "string" ? phone.trim() : "",
    });

    return NextResponse.json(
      { success: true, message: "Branch created successfully.", branch },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error, "create");
  }
}
