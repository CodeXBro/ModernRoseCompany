import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import Branch from "@/models/Branch";
import { requireWriteAccess, applyBranchAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid expense ID." },
        { status: 400 },
      );
    }

    // Only allow deleting expenses the user has access to.
    const filter: Record<string, unknown> = { _id: id };
    applyBranchAccess(user, filter);

    const expense = await Expense.findOne(filter);

    if (!expense) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense not found or you do not have access.",
        },
        { status: 404 },
      );
    }

    await Expense.deleteOne({ _id: expense._id });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    return handleError(error);
  }
}

const PAYMENT_METHODS = ["cash", "visa", "online", "bank", "other"];

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (
    message === "FORBIDDEN" ||
    message === "Employee is not assigned to a branch."
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          message === "FORBIDDEN"
            ? "You do not have permission to perform this action."
            : message,
      },
      { status: 403 },
    );
  }

  console.error("Error updating expense:", error);

  return NextResponse.json(
    { success: false, message: "Failed to update expense." },
    { status: 500 },
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid expense ID." },
        { status: 400 },
      );
    }

    const filter: Record<string, unknown> = { _id: id };
    applyBranchAccess(user, filter);

    const existingExpense = await Expense.findOne(filter);

    if (!existingExpense) {
      return NextResponse.json(
        { success: false, message: "Expense not found." },
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

    const { branchId, date, category, description, amount, paymentMethod } =
      body;

    let selectedBranchId: string;

    if (user.role === "employee") {
      if (!user.branchId) {
        throw new Error("Employee is not assigned to a branch.");
      }

      selectedBranchId = user.branchId;
    } else {
      if (typeof branchId !== "string" || !mongoose.isValidObjectId(branchId)) {
        return NextResponse.json(
          { success: false, message: "A valid branch is required." },
          { status: 400 },
        );
      }

      selectedBranchId = branchId;
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid expense date." },
        { status: 400 },
      );
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid expense date." },
        { status: 400 },
      );
    }

    if (typeof category !== "string" || !category.trim()) {
      return NextResponse.json(
        { success: false, message: "Expense category is required." },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Expense amount must be greater than 0." },
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

    const branchExists = await Branch.exists({ _id: selectedBranchId });

    if (!branchExists) {
      return NextResponse.json(
        { success: false, message: "Selected branch was not found." },
        { status: 400 },
      );
    }

    existingExpense.branchId = new mongoose.Types.ObjectId(selectedBranchId);
    existingExpense.date = parsedDate;
    existingExpense.category = category.trim();
    existingExpense.description =
      typeof description === "string" ? description.trim() : "";
    existingExpense.amount = Number(numericAmount.toFixed(2));
    existingExpense.paymentMethod = paymentMethod;

    await existingExpense.save();

    return NextResponse.json({
      success: true,
      message: "Expense updated successfully.",
      expense: existingExpense,
    });
  } catch (error) {
    return handleError(error);
  }
}
