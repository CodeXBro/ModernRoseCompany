import { NextResponse } from "next/server";

import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();
    await connectDB();

    const owner = await User.findOne({
      role: "owner",
      isActive: true,
    })
      .select("_id name email role")
      .lean();

    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          message: "Active owner account not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      owner,
    });
  } catch (error) {
    console.error("Error fetching owner:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in to continue.",
        },
        { status: 401 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Only the owner can access this endpoint.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch owner.",
      },
      { status: 500 },
    );
  }
}
