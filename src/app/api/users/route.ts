import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";
import Branch from "@/models/Branch";
import { hashPassword } from "@/lib/password";
import { requireOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const allowedRoles: UserRole[] = ["owner", "admin", "employee", "viewer"];

function handleError(error: unknown, action: string) {
  console.error(`${action}:`, error);

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
        message: "Only the owner can manage user accounts.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "An unexpected server error occurred.",
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requireOwner();
    await connectDB();

    const users = await User.find()
      .select("_id name email role branchId isActive createdAt")
      .populate("branchId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    return handleError(error, "Error fetching users");
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    await connectDB();

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const { name, email, password, role, branchId } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email and password are required.",
        },
        { status: 400 },
      );
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedName.length > 100 ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid name and email address.",
        },
        { status: 400 },
      );
    }

    if (password.length < 6 || password.length > 128) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be between 6 and 128 characters.",
        },
        { status: 400 },
      );
    }

    const selectedRole =
      role === undefined || role === null || role === "" ? "employee" : role;

    if (
      typeof selectedRole !== "string" ||
      !allowedRoles.includes(selectedRole as UserRole)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user role.",
        },
        { status: 400 },
      );
    }

    const selectedBranchId =
      typeof branchId === "string" ? branchId.trim() : "";

    // Employees must have an assigned branch.
    if (selectedRole === "employee" && !selectedBranchId) {
      return NextResponse.json(
        {
          success: false,
          message: "An employee must be assigned to a branch.",
        },
        { status: 400 },
      );
    }

    if (selectedBranchId) {
      if (!mongoose.Types.ObjectId.isValid(selectedBranchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid branch ID.",
          },
          { status: 400 },
        );
      }

      const branch = await Branch.findById(selectedBranchId).select("_id");

      if (!branch) {
        return NextResponse.json(
          {
            success: false,
            message: "The selected branch does not exist.",
          },
          { status: 400 },
        );
      }
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    }).select("_id");

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "A user with this email already exists.",
        },
        { status: 409 },
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole as UserRole,
      branchId: selectedBranchId || undefined,
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully.",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          isActive: user.isActive,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error, "Error creating user");
  }
}
