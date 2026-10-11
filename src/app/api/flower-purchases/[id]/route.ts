import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import Company from "@/models/Company";
import { requireWriteAccess, applyBranchAccess } from "@/lib/permissions";

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

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const user = await requireWriteAccess();

    await connectDB();

    const { id } = await context.params;

    // Find the existing purchase first.
    const existingPurchase = await FlowerPurchase.findById(id);

    if (!existingPurchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Flower purchase not found",
        },
        { status: 404 },
      );
    }

    // Employees can only edit purchases
    // from their assigned branch.
    if (user.role === "employee") {
      const filter: Record<string, unknown> = {};

      applyBranchAccess(user, filter);

      if (existingPurchase.branchId.toString() !== String(filter.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only edit purchases from your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

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

    // Employees cannot move a purchase
    // to another branch.
    if (user.role === "employee") {
      selectedBranchId = user.branchId;
    }

    const purchase = await FlowerPurchase.findByIdAndUpdate(
      id,
      {
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
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Flower purchase updated successfully",
      purchase,
    });
  } catch (error) {
    console.error("Error updating flower purchase:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update flower purchase",
      },
      { status: 500 },
    );
  }
}
