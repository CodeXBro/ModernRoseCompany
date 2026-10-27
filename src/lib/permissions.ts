import mongoose from "mongoose";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

type UserRole = "owner" | "admin" | "employee" | "viewer";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(session.user.id)) {
    return null;
  }

  await connectDB();

  const user = await User.findById(session.user.id)
    .select("_id name email role branchId isActive")
    .lean();

  if (!user || user.isActive !== true) {
    return null;
  }

  const allowedRoles: UserRole[] = ["owner", "admin", "employee", "viewer"];

  if (!allowedRoles.includes(user.role as UserRole)) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    branchId: user.branchId?.toString(),
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireAuth();

  if (user.role !== "owner") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireWriteAccess(): Promise<CurrentUser> {
  const user = await requireAuth();

  if (user.role === "viewer") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireBranchManagement(): Promise<CurrentUser> {
  const user = await requireAuth();

  if (user.role !== "owner" && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export function applyBranchAccess(
  user: {
    role: string;
    branchId?: string;
  },
  filter: Record<string, unknown>,
) {
  if (user.role === "employee") {
    if (!user.branchId || !mongoose.Types.ObjectId.isValid(user.branchId)) {
      throw new Error("Employee is not assigned to a valid branch.");
    }

    // Always enforce the employee's database-backed branch assignment.
    filter.branchId = new mongoose.Types.ObjectId(user.branchId);
  }

  return filter;
}
