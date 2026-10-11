import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireOwner } from "@/lib/permissions";

export async function GET() {
  try {
    await requireOwner();
    await connectDB();

    const owner = await User.findOne({
      role: "owner",
    }).select("_id name email role");

    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          message: "Owner not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      owner,
    });
  } catch (error) {
    console.error("Error fetching owner:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch owner",
      },
      {
        status: 500,
      },
    );
  }
}
