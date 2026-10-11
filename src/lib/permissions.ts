import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    branchId: session.user.branchId,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireOwner() {
  const user = await requireAuth();

  if (user.role !== "owner") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireWriteAccess() {
  const user = await requireAuth();

  if (user.role === "viewer") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireBranchManagement() {
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
    if (!user.branchId) {
      throw new Error("Employee is not assigned to a branch.");
    }

    filter.branchId = user.branchId;
  }

  return filter;
}
