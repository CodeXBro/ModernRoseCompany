import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FlowerPurchase from "@/models/FlowerPurchase";
import "@/models/Company";
import "@/models/Branch";
import { requireAuth, requireWriteAccess } from "@/lib/permissions";
function calculatePayment(totalAmount: number, paidAmount: number) {
  if (paidAmount < 0) {
    throw new Error("Paid amount cannot be negative.");
  }

  if (paidAmount > totalAmount) {
    throw new Error("Paid amount cannot be greater than bill amount.");
  }

  const balanceAmount = totalAmount - paidAmount;

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
    await requireWriteAccess();
    await connectDB();

    const { id } = await context.params;

    const body = await request.json();

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

    const payment = calculatePayment(purchase.totalAmount, paidAmount);

    purchase.paidAmount = payment.paidAmount;

    purchase.balanceAmount = payment.balanceAmount;

    purchase.paymentStatus = payment.paymentStatus;

    if (body.paymentMethod) {
      purchase.paymentMethod = body.paymentMethod;
    }

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
    console.error("Error updating purchase payment:", error);

    const message =
      error instanceof Error ? error.message : "Failed to update payment.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 },
    );
  }
}
