import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import PartnerFundedPayment from "@/models/PartnerFundedPayment";
import Branch from "@/models/Branch";
import Company from "@/models/Company";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const paymentMethods = ["cash", "bank", "visa", "online", "other"];

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "You do not have permission." },
      { status: 403 },
    );
  }

  console.error("Partner-funded payment API error:", error);

  return NextResponse.json(
    { success: false, message: "Something went wrong." },
    { status: 500 },
  );
}

function canAccessBranch(
  user: { role: string; branchId?: string },
  branchId: string,
) {
  if (user.role === "employee" || user.role === "viewer") {
    if (user.branchId && user.branchId !== branchId) {
      return false;
    }

    if (user.role === "employee" && !user.branchId) {
      return false;
    }
  }

  return true;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId");

    const filter: Record<string, unknown> = {};

    if (requestedBranchId && requestedBranchId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(requestedBranchId)) {
        return NextResponse.json(
          { success: false, message: "Invalid branch ID." },
          { status: 400 },
        );
      }

      if (!canAccessBranch(user, requestedBranchId)) {
        return NextResponse.json(
          { success: false, message: "You cannot access this branch." },
          { status: 403 },
        );
      }

      filter.branchId = new mongoose.Types.ObjectId(requestedBranchId);
    }

    if ((user.role === "employee" || user.role === "viewer") && user.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(user.branchId);
    }

    if (user.role === "employee" && !user.branchId) {
      return NextResponse.json(
        { success: false, message: "Your account has no assigned branch." },
        { status: 403 },
      );
    }

    const payments = await PartnerFundedPayment.find(filter)
      .populate("branchId", "name")
      .populate("companyId", "companyName supplierName")
      .populate("flowerPurchaseId", "invoiceNumber totalAmount")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const totalAmount = payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        count: payments.length,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    if (user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    await connectDB();

    const body = await request.json();

    const {
      branchId,
      date,
      amount,
      paidTo,
      companyId,
      flowerPurchaseId,
      invoiceNumber,
      paymentMethod,
      reference,
      description,
      notes,
    } = body;

    if (
      typeof branchId !== "string" ||
      !mongoose.Types.ObjectId.isValid(branchId)
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid branch." },
        { status: 400 },
      );
    }

    if (!canAccessBranch(user, branchId)) {
      return NextResponse.json(
        { success: false, message: "You cannot add payments to this branch." },
        { status: 403 },
      );
    }

    if (
      !date ||
      typeof date !== "string" ||
      Number.isNaN(new Date(date).getTime())
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid date." },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (
      amount === "" ||
      amount === null ||
      amount === undefined ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (typeof paidTo !== "string" || !paidTo.trim()) {
      return NextResponse.json(
        { success: false, message: "Enter who received the payment." },
        { status: 400 },
      );
    }

    if (!paymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, message: "Select a valid payment method." },
        { status: 400 },
      );
    }

    const branch = await Branch.findById(branchId).lean();

    if (!branch || branch.isActive !== true) {
      return NextResponse.json(
        { success: false, message: "Branch not found or inactive." },
        { status: 400 },
      );
    }

    let validCompanyId: mongoose.Types.ObjectId | undefined;

    if (companyId) {
      if (
        typeof companyId !== "string" ||
        !mongoose.Types.ObjectId.isValid(companyId)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid company ID." },
          { status: 400 },
        );
      }

      const company = await Company.findById(companyId).lean();

      if (!company || company.isActive !== true) {
        return NextResponse.json(
          { success: false, message: "Company not found or inactive." },
          { status: 400 },
        );
      }

      validCompanyId = new mongoose.Types.ObjectId(companyId);
    }

    let validPurchaseId: mongoose.Types.ObjectId | undefined;

    if (flowerPurchaseId) {
      if (
        typeof flowerPurchaseId !== "string" ||
        !mongoose.Types.ObjectId.isValid(flowerPurchaseId)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid supplier bill ID." },
          { status: 400 },
        );
      }

      const purchase = await FlowerPurchase.findById(flowerPurchaseId).lean();

      if (!purchase || purchase.branchId.toString() !== branchId) {
        return NextResponse.json(
          {
            success: false,
            message: "Supplier bill not found in the selected branch.",
          },
          { status: 400 },
        );
      }

      if (
        validCompanyId &&
        purchase.companyId.toString() !== validCompanyId.toString()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "The selected company does not match the supplier bill.",
          },
          { status: 400 },
        );
      }

      validPurchaseId = new mongoose.Types.ObjectId(flowerPurchaseId);

      if (!validCompanyId) {
        validCompanyId = purchase.companyId;
      }
    }

    const payment = await PartnerFundedPayment.create({
      branchId: new mongoose.Types.ObjectId(branchId),
      date: new Date(date),
      amount: Number(numericAmount.toFixed(2)),
      paidTo: paidTo.trim(),
      companyId: validCompanyId,
      flowerPurchaseId: validPurchaseId,
      invoiceNumber:
        typeof invoiceNumber === "string" ? invoiceNumber.trim() : "",
      paymentMethod,
      reference: typeof reference === "string" ? reference.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      notes: typeof notes === "string" ? notes.trim() : "",
      createdBy: new mongoose.Types.ObjectId(user.id),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Partner-funded payment recorded successfully.",
        payment,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
