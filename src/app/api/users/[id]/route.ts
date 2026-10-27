import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";
import Branch from "@/models/Branch";
import { hashPassword } from "@/lib/password";
import { requireOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedRoles: UserRole[] = ["admin", "employee", "viewer"];

function handleError(error: unknown) {
  console.error("Error updating user:", error);

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
        message: "Only the owner can update user accounts.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "Failed to update user.",
    },
    { status: 500 },
  );
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireOwner();
    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user ID.",
        },
        { status: 400 },
      );
    }

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

    const { name, email, password, role, branchId, isActive } = body;

    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found.",
        },
        { status: 404 },
      );
    }

    // The owner account cannot be modified here.
    if (user.role === "owner") {
      return NextResponse.json(
        {
          success: false,
          message: "The owner account cannot be modified here.",
        },
        { status: 403 },
      );
    }

    // Name validation
    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Name must be between 1 and 100 characters.",
          },
          { status: 400 },
        );
      }

      user.name = name.trim();
    }

    // Email validation
    if (email !== undefined) {
      if (typeof email !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid email address.",
          },
          { status: 400 },
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (
        normalizedEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Please provide a valid email address.",
          },
          { status: 400 },
        );
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      }).select("_id");

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Another user already uses this email.",
          },
          { status: 409 },
        );
      }

      user.email = normalizedEmail;
    }

    // Role validation
    if (role !== undefined) {
      if (
        typeof role !== "string" ||
        !allowedRoles.includes(role as UserRole)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid user role.",
          },
          { status: 400 },
        );
      }

      user.role = role as UserRole;
    }

    // Branch validation
    if (branchId !== undefined) {
      if (branchId === null || branchId === "") {
        if (user.role === "employee") {
          return NextResponse.json(
            {
              success: false,
              message: "An employee must be assigned to a branch.",
            },
            { status: 400 },
          );
        }

        user.branchId = undefined;
      } else {
        if (
          typeof branchId !== "string" ||
          !mongoose.Types.ObjectId.isValid(branchId)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid branch ID.",
            },
            { status: 400 },
          );
        }

        const branch = await Branch.findById(branchId).select("_id");

        if (!branch) {
          return NextResponse.json(
            {
              success: false,
              message: "The selected branch does not exist.",
            },
            { status: 400 },
          );
        }

        user.branchId = new mongoose.Types.ObjectId(branchId);
      }
    }

    // Ensure employees always have a branch.
    if (user.role === "employee" && !user.branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "An employee must be assigned to a branch.",
        },
        { status: 400 },
      );
    }

    // Active / inactive validation
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            message: "isActive must be true or false.",
          },
          { status: 400 },
        );
      }

      user.isActive = isActive;
    }

    // Password validation and hashing
    if (password !== undefined) {
      if (typeof password !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be text.",
          },
          { status: 400 },
        );
      }

      if (password.length > 128) {
        return NextResponse.json(
          {
            success: false,
            message: "Password cannot exceed 128 characters.",
          },
          { status: 400 },
        );
      }

      if (password.length > 0 && password.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters.",
          },
          { status: 400 },
        );
      }

      if (password.length > 0) {
        user.password = await hashPassword(password);
      }
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: "User updated successfully.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
