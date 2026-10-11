import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireWriteAccess, applyBranchAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireWriteAccess();

    await connectDB();

    const { id } = await params;

    // First find the existing expense.
    const existingExpense = await Expense.findById(id);

    if (!existingExpense) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense not found",
        },
        { status: 404 },
      );
    }

    // Employees can only edit expenses
    // from their assigned branch.
    if (user.role === "employee") {
      const filter: Record<string, unknown> = {};

      applyBranchAccess(user, filter);

      if (existingExpense.branchId.toString() !== String(filter.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only edit expenses from your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

    const body = await request.json();

    const { branchId, date, category, description, amount, paymentMethod } =
      body;

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch is required",
        },
        { status: 400 },
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required",
        },
        { status: 400 },
      );
    }

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense category is required",
        },
        { status: 400 },
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense amount must be greater than 0",
        },
        { status: 400 },
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment method is required",
        },
        { status: 400 },
      );
    }

    let selectedBranchId = branchId;

    // Employees cannot move the expense
    // to another branch.
    if (user.role === "employee") {
      selectedBranchId = user.branchId;
    }

    const expense = await Expense.findByIdAndUpdate(
      id,
      {
        branchId: selectedBranchId,
        date: new Date(date),
        category,
        description: description?.trim(),
        amount: Number(amount),
        paymentMethod,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Expense updated successfully",
      expense,
    });
  } catch (error) {
    console.error("Error updating expense:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update expense",
      },
      { status: 500 },
    );
  }
}
