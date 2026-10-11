import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import "@/models/User";
import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

export async function GET() {
  try {
    const user = await requireAuth();

    await connectDB();

    const filter: Record<string, unknown> = {};

    applyBranchAccess(user, filter);

    const expenses = await Expense.find(filter)
      .populate("branchId", "name")
      .populate("createdBy", "name")
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch expenses",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWriteAccess();

    await connectDB();

    const body = await request.json();

    const { branchId, date, category, description, amount, paymentMethod } =
      body;

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message: "Date is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense category is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense amount must be greater than 0",
        },
        {
          status: 400,
        },
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment method is required",
        },
        {
          status: 400,
        },
      );
    }

    let selectedBranchId = branchId;

    // Employees can only create expenses
    // for their assigned branch.
    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          {
            success: false,
            message: "Employee is not assigned to a branch.",
          },
          {
            status: 403,
          },
        );
      }

      selectedBranchId = user.branchId;
    }

    const expense = await Expense.create({
      branchId: selectedBranchId,
      date: new Date(date),
      category,
      description,
      amount: Number(amount),
      paymentMethod,

      // Always use the logged-in user.
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Expense created successfully",
        expense,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Error creating expense:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create expense",
      },
      {
        status: 500,
      },
    );
  }
}
