import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";
import { hashPassword } from "@/lib/password";
import { requireOwner } from "@/lib/permissions";

const allowedRoles: UserRole[] = ["owner", "admin", "employee", "viewer"];

export async function GET() {
  try {
    await requireOwner();
    await connectDB();

    const users = await User.find()
      .select("_id name email role branchId isActive createdAt")
      .populate("branchId", "name")
      .sort({
        createdAt: -1,
      });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch users.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    await connectDB();

    const body = await request.json();

    const { name, email, password, role, branchId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email and password are required.",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const selectedRole = role || "employee";

    if (!allowedRoles.includes(selectedRole)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user role.",
        },
        { status: 400 },
      );
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

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
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole,
      branchId: branchId || undefined,
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
    console.error("Error creating user:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user.",
      },
      { status: 500 },
    );
  }
}
