import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import Branch from "@/models/Branch";
import FlowerPurchase from "@/models/FlowerPurchase";
import Company from "@/models/Company";
import { requireWriteAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["cash", "visa", "online", "bank", "other"];


interface RouteParams {
  params: Promise<{ id: string }>;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in." },
      { status: 401 },
    );
  }

  if (
    message === "FORBIDDEN" ||
    message === "Employee is not assigned to a branch."
  ) {
    return NextResponse.json({ success: false, message }, { status: 403 });
  }

  console.error("Flower purchase update error:", error);

  return NextResponse.json(
    { success: false, message: "Failed to update flower purchase." },
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid flower purchase ID.",
        },
        { status: 400 },
      );
    }

    if (user.role === "employee" && !user.branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not assigned to a branch.",
        },
        { status: 403 },
      );
    }

    // Restrict employees to their assigned branch.
    const purchaseFilter: Record<string, unknown> = { _id: id };

    if (user.role === "employee") {
      purchaseFilter.branchId = user.branchId;
    }

    const purchase = await FlowerPurchase.findOne(purchaseFilter);

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Flower purchase not found or you do not have access.",
        },
        { status: 404 },
      );
    }

    await FlowerPurchase.deleteOne({ _id: purchase._id });

    return NextResponse.json({
      success: true,
      message: "Flower purchase deleted successfully.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid flower purchase ID." },
        { status: 400 },
      );
    }

    if (user.role === "employee" && !user.branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not assigned to a branch.",
        },
        { status: 403 },
      );
    }

    // Restrict the lookup itself to the employee's assigned branch.
    const purchaseFilter: Record<string, unknown> = { _id: id };

    if (user.role === "employee") {
      purchaseFilter.branchId = user.branchId;
    }

    const existingPurchase = await FlowerPurchase.findOne(purchaseFilter);

    if (!existingPurchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Flower purchase not found or you do not have access.",
        },
        { status: 404 },
      );
    }

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

    let selectedBranchId: string;

    if (user.role === "employee") {
      selectedBranchId = user.branchId!;
    } else {
      if (typeof branchId !== "string" || !mongoose.isValidObjectId(branchId)) {
        return NextResponse.json(
          { success: false, message: "A valid branch is required." },
          { status: 400 },
        );
      }

      selectedBranchId = branchId;
    }

    const parsedDate = parseDate(date);

    if (!parsedDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid purchase date (YYYY-MM-DD).",
        },
        { status: 400 },
      );
    }

    if (typeof companyId !== "string" || !mongoose.isValidObjectId(companyId)) {
      return NextResponse.json(
        { success: false, message: "A valid company is required." },
        { status: 400 },
      );
    }

    if (
      totalAmount === undefined ||
      totalAmount === null ||
      totalAmount === "" ||
      !Number.isFinite(Number(totalAmount)) ||
      Number(totalAmount) < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid bill amount." },
        { status: 400 },
      );
    }

    if (
      paidAmount === undefined ||
      paidAmount === null ||
      paidAmount === "" ||
      !Number.isFinite(Number(paidAmount)) ||
      Number(paidAmount) < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid paid amount." },
        { status: 400 },
      );
    }

    const total = Number(totalAmount);
    const paid = Number(paidAmount);

    if (paid > total) {
      return NextResponse.json(
        {
          success: false,
          message: "Paid amount cannot exceed the bill amount.",
        },
        { status: 400 },
      );
    }

    if (
      typeof paymentMethod !== "string" ||
      !PAYMENT_METHODS.includes(paymentMethod)
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid payment method." },
        { status: 400 },
      );
    }

    const [branch, company] = await Promise.all([
      Branch.findById(selectedBranchId).lean(),
      Company.findById(companyId).lean(),
    ]);

    if (!branch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 },
      );
    }

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found." },
        { status: 404 },
      );
    }

    if (!company.isActive) {
      return NextResponse.json(
        { success: false, message: "This company is inactive." },
        { status: 400 },
      );
    }

    const balanceAmount = Number((total - paid).toFixed(2));

    const paymentStatus =
      balanceAmount === 0 ? "paid" : paid === 0 ? "pending" : "partial";

    existingPurchase.branchId = new mongoose.Types.ObjectId(selectedBranchId);
    existingPurchase.date = parsedDate;
    existingPurchase.companyId = new mongoose.Types.ObjectId(companyId);
    existingPurchase.supplierName = company.supplierName;
    existingPurchase.invoiceNumber =
      typeof invoiceNumber === "string" ? invoiceNumber.trim() : "";
    existingPurchase.totalAmount = Number(total.toFixed(2));
    existingPurchase.paidAmount = Number(paid.toFixed(2));
    existingPurchase.balanceAmount = balanceAmount;
    existingPurchase.paymentStatus = paymentStatus;
    existingPurchase.paymentMethod = paymentMethod;
    existingPurchase.notes = typeof notes === "string" ? notes.trim() : "";

    await existingPurchase.save();

    return NextResponse.json({
      success: true,
      message: "Flower purchase updated successfully.",
      purchase: existingPurchase,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
