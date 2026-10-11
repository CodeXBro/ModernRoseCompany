import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { hashPassword } from "@/lib/password";
import { requireOwner } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireOwner();
    await connectDB();

    const { id } = await context.params;

    const body = await request.json();

    const { name, email, password, role, branchId, isActive } = body;

    // Find the user
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

    // Owner cannot be modified from user management
    if (user.role === "owner") {
      return NextResponse.json(
        {
          success: false,
          message: "The owner account cannot be modified here.",
        },
        { status: 403 },
      );
    }

    // Name
    if (name !== undefined) {
      const cleanName = String(name).trim();

      if (!cleanName) {
        return NextResponse.json(
          {
            success: false,
            message: "Name cannot be empty.",
          },
          { status: 400 },
        );
      }

      user.name = cleanName;
    }

    // Email
    if (email !== undefined) {
      const normalizedEmail = String(email).toLowerCase().trim();

      if (!normalizedEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "Email cannot be empty.",
          },
          { status: 400 },
        );
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
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

    // Role
    if (role !== undefined) {
      const allowedRoles = ["admin", "employee", "viewer"];

      if (!allowedRoles.includes(role)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid user role.",
          },
          { status: 400 },
        );
      }

      user.role = role;
    }

    // Branch
    if (branchId !== undefined) {
      if (branchId) {
        user.branchId = branchId;
      } else {
        user.branchId = undefined;
      }
    }

    // Active / inactive
    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    // Password
    if (password !== undefined) {
      const newPassword = String(password);

      if (newPassword && newPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters.",
          },
          { status: 400 },
        );
      }

      if (newPassword) {
        user.password = await hashPassword(newPassword);
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
    console.error("Error updating user:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update user.",
      },
      { status: 500 },
    );
  }
}
