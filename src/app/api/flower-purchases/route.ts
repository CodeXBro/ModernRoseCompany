import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import Company from "@/models/Company";
import "@/models/User";
import {
  requireAuth,
  requireWriteAccess,
  applyBranchAccess,
} from "@/lib/permissions";

function calculatePayment(totalAmount: number, paidAmount: number) {
  const total = Number(totalAmount);
  const paid = Number(paidAmount);

  if (paid < 0) {
    throw new Error("Paid amount cannot be negative");
  }

  if (paid > total) {
    throw new Error("Paid amount cannot be greater than bill amount");
  }

  const balance = total - paid;

  let paymentStatus: "paid" | "pending" | "partial";

  if (balance === 0) {
    paymentStatus = "paid";
  } else if (paid === 0) {
    paymentStatus = "pending";
  } else {
    paymentStatus = "partial";
  }

  return {
    paidAmount: paid,
    balanceAmount: balance,
    paymentStatus,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();

    await connectDB();

    const filter: Record<string, unknown> = {};

    applyBranchAccess(user, filter);

    const purchases = await FlowerPurchase.find(filter)
      .populate("companyId", "companyName supplierName")
      .populate("branchId", "name")
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    return NextResponse.json({
      success: true,
      purchases,
    });
  } catch (error) {
    console.error("Error loading flower purchases:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load flower purchases",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWriteAccess();

    await connectDB();

    const body = await request.json();

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

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Company is required",
        },
        { status: 400 },
      );
    }

    if (
      totalAmount === undefined ||
      totalAmount === null ||
      Number(totalAmount) < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid bill amount is required",
        },
        { status: 400 },
      );
    }

    if (paidAmount === undefined || paidAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Paid amount is required",
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

    const company = await Company.findById(companyId).lean();

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message: "Company not found",
        },
        { status: 404 },
      );
    }

    if (!company.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "This company is inactive and cannot be selected",
        },
        { status: 400 },
      );
    }

    let payment;

    try {
      payment = calculatePayment(Number(totalAmount), Number(paidAmount));
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Invalid payment amount",
        },
        { status: 400 },
      );
    }

    let selectedBranchId = branchId;

    // Employees can only create purchases
    // for their assigned branch.
    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          {
            success: false,
            message: "Employee is not assigned to a branch.",
          },
          { status: 403 },
        );
      }

      selectedBranchId = user.branchId;
    }

    const purchase = await FlowerPurchase.create({
      branchId: selectedBranchId,
      date,
      companyId,
      supplierName: company.supplierName,
      invoiceNumber,
      totalAmount: Number(totalAmount),
      paidAmount: payment.paidAmount,
      balanceAmount: payment.balanceAmount,
      paymentStatus: payment.paymentStatus,
      paymentMethod,
      notes,

      // Use the logged-in user.
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Flower purchase added successfully",
        purchase,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating flower purchase:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create flower purchase",
      },
      { status: 500 },
    );
  }
}
