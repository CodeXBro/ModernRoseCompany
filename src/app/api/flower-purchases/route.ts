
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import Company from "@/models/Company";
import Branch from "@/models/Branch";
import "@/models/User";

import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = [
  "cash",
  "visa",
  "online",
  "bank",
  "other",
] as const;

function calculatePayment(totalAmount: number, paidAmount: number) {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error("Enter a valid bill amount.");
  }

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("Enter a valid paid amount.");
  }

  if (paidAmount > totalAmount) {
    throw new Error("Paid amount cannot exceed the bill amount.");
  }

  const balanceAmount = Number((totalAmount - paidAmount).toFixed(2));

  const paymentStatus: "paid" | "pending" | "partial" =
    balanceAmount === 0
      ? "paid"
      : paidAmount === 0
        ? "pending"
        : "partial";

  return { paidAmount, balanceAmount, paymentStatus };
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in." },
      { status: 401 },
    );
  }

  if (
    message === "FORBIDDEN" ||
    message.includes("not assigned to a branch")
  ) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to perform this action." },
      { status: 403 },
    );
  }

  console.error("Flower purchases API error:", error);

  return NextResponse.json(
    { success: false, message: "Unable to process flower purchases." },
    { status: 500 },
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

// GET: List purchases. Employees see only their assigned branch.
export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const filter: Record<string, unknown> = {};
    applyBranchAccess(user, filter);

    const purchases = await FlowerPurchase.find(filter)
      .populate("companyId", "companyName supplierName")
      .populate("branchId", "name")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, purchases });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a purchase with validated payment details.
export async function POST(request: Request) {
  try {
    const user = await requireWriteAccess();
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

    const {
      branchId,
      date,
      companyId,
      invoiceNumber,
      totalAmount,
      paidAmount,
      paymentMethod,
      notes,
    } = body;

    // Employees must use their assigned branch. Do not trust their
    // submitted branch ID.
    let selectedBranchId: string;

    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          { success: false, message: "Your account is not assigned to a branch." },
          { status: 403 },
        );
      }

      selectedBranchId = user.branchId;
    } else {
      if (
        typeof branchId !== "string" ||
        !mongoose.isValidObjectId(branchId)
      ) {
        return NextResponse.json(
          { success: false, message: "A valid branch is required." },
          { status: 400 },
        );
      }

      selectedBranchId = branchId;
    }

    const purchaseDate = parseDate(date);

    if (!purchaseDate) {
      return NextResponse.json(
        { success: false, message: "Enter a valid purchase date in YYYY-MM-DD format." },
        { status: 400 },
      );
    }

    if (
      typeof companyId !== "string" ||
      !mongoose.isValidObjectId(companyId)
    ) {
      return NextResponse.json(
        { success: false, message: "A valid company is required." },
        { status: 400 },
      );
    }

    if (
      totalAmount === undefined ||
      totalAmount === null ||
      totalAmount === ""
    ) {
      return NextResponse.json(
        { success: false, message: "Bill amount is required." },
        { status: 400 },
      );
    }

    if (
      paidAmount === undefined ||
      paidAmount === null ||
      paidAmount === ""
    ) {
      return NextResponse.json(
        { success: false, message: "Paid amount is required." },
        { status: 400 },
      );
    }

    const total = Number(totalAmount);
    const paid = Number(paidAmount);

    let payment;

    try {
      payment = calculatePayment(total, paid);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error
            ? error.message
            : "Invalid payment amounts.",
        },
        { status: 400 },
      );
    }

    if (
      typeof paymentMethod !== "string" ||
      !PAYMENT_METHODS.includes(
        paymentMethod as (typeof PAYMENT_METHODS)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid payment method." },
        { status: 400 },
      );
    }

    const branch = await Branch.findById(selectedBranchId).lean();

    if (!branch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 },
      );
    }

    const company = await Company.findById(companyId).lean();

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found." },
        { status: 404 },
      );
    }

    if (!company.isActive) {
      return NextResponse.json(
        { success: false, message: "This company is inactive and cannot be selected." },
        { status: 400 },
      );
    }

    const purchase = await FlowerPurchase.create({
      branchId: selectedBranchId,
      date: purchaseDate,
      companyId,
      supplierName: company.supplierName,
      invoiceNumber:
        typeof invoiceNumber === "string" ? invoiceNumber.trim() : "",
      totalAmount: total,
      paidAmount: payment.paidAmount,
      balanceAmount: payment.balanceAmount,
      paymentStatus: payment.paymentStatus,
      paymentMethod,
      notes: typeof notes === "string" ? notes.trim() : "",
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Flower purchase added successfully.",
        purchase,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
