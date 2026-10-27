import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import "@/models/Company";
import "@/models/Branch";
import { requireWriteAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["cash", "visa", "online", "bank", "other"] as const;

function calculatePayment(totalAmount: number, paidAmount: number) {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error("The bill amount is invalid.");
  }

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("Paid amount must be a valid non-negative number.");
  }

  if (paidAmount > totalAmount) {
    throw new Error("Paid amount cannot exceed the bill amount.");
  }

  const balanceAmount = Number((totalAmount - paidAmount).toFixed(2));

  let paymentStatus: "paid" | "pending" | "partial";

  if (balanceAmount === 0) {
    paymentStatus = "paid";
  } else if (paidAmount === 0) {
    paymentStatus = "pending";
  } else {
    paymentStatus = "partial";
  }

  return {
    paidAmount,
    balanceAmount,
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

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid purchase ID.",
        },
        { status: 400 },
      );
    }

    const purchase = await FlowerPurchase.findById(id);

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase bill not found.",
        },
        { status: 404 },
      );
    }

    // Employees can only update payments in their assigned branch.
    if (user.role === "employee") {
      if (!user.branchId) {
        return NextResponse.json(
          {
            success: false,
            message: "Your account is not assigned to a branch.",
          },
          { status: 403 },
        );
      }

      if (String(purchase.branchId) !== String(user.branchId)) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only update payments for your assigned branch.",
          },
          { status: 403 },
        );
      }
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    if (
      body.paidAmount === undefined ||
      body.paidAmount === null ||
      body.paidAmount === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Paid amount is required.",
        },
        { status: 400 },
      );
    }

    const paidAmount = Number(body.paidAmount);

    if (!Number.isFinite(paidAmount)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid paid amount.",
        },
        { status: 400 },
      );
    }

    let paymentMethod = purchase.paymentMethod;

    if (body.paymentMethod !== undefined) {
      if (
        typeof body.paymentMethod !== "string" ||
        !PAYMENT_METHODS.includes(
          body.paymentMethod as (typeof PAYMENT_METHODS)[number],
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Select a valid payment method.",
          },
          { status: 400 },
        );
      }

      paymentMethod = body.paymentMethod;
    }

    let payment;

    try {
      payment = calculatePayment(Number(purchase.totalAmount), paidAmount);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Invalid payment details.",
        },
        { status: 400 },
      );
    }

    purchase.paidAmount = payment.paidAmount;
    purchase.balanceAmount = payment.balanceAmount;
    purchase.paymentStatus = payment.paymentStatus;
    purchase.paymentMethod = paymentMethod;

    await purchase.save();

    const updatedPurchase = await FlowerPurchase.findById(id)
      .populate("companyId", "companyName supplierName")
      .populate("branchId", "name")
      .lean();

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully.",
      purchase: updatedPurchase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in.",
        },
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
          message: "You do not have permission to update this payment.",
        },
        { status: 403 },
      );
    }

    console.error("Error updating purchase payment:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update purchase payment.",
      },
      { status: 500 },
    );
  }
}
