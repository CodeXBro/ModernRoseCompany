
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import PartnerFundedPayment from "@/models/PartnerFundedPayment";
import Branch from "@/models/Branch";
import Company from "@/models/Company";
import FlowerPurchase from "@/models/FlowerPurchase";
import { requireAuth } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

const methods = ["cash", "bank", "visa", "online", "other"];

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "You do not have permission." },
      { status: 403 },
    );
  }

  console.error("Partner-funded payment error:", error);

  return NextResponse.json(
    { success: false, message: "Something went wrong." },
    { status: 500 },
  );
}

function hasBranchAccess(
  user: { role: string; branchId?: string },
  branchId: string,
) {
  if (user.role === "employee" || user.role === "viewer") {
    if (!user.branchId || user.branchId !== branchId) {
      return false;
    }
  }

  return true;
}

async function getId(context: Context) {
  const { id } = await context.params;
  return id;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuth();

    if (user.role === "viewer") {
      throw new Error("FORBIDDEN");
    }

    await connectDB();

    const id = await getId(context);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID." },
        { status: 400 },
      );
    }

    const payment = await PartnerFundedPayment.findById(id);

    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment not found." },
        { status: 404 },
      );
    }

    if (!hasBranchAccess(user, payment.branchId.toString())) {
      return NextResponse.json(
        { success: false, message: "You cannot edit this branch's payment." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const branchId =
      body.branchId === undefined
        ? payment.branchId.toString()
        : body.branchId;

    if (
      typeof branchId !== "string" ||
      !mongoose.Types.ObjectId.isValid(branchId)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid branch." },
        { status: 400 },
      );
    }

    if (!hasBranchAccess(user, branchId)) {
      return NextResponse.json(
        { success: false, message: "You cannot move this payment to that branch." },
        { status: 403 },
      );
    }

    const branch = await Branch.findById(branchId).lean();

    if (!branch || branch.isActive !== true) {
      return NextResponse.json(
        { success: false, message: "Branch not found or inactive." },
        { status: 400 },
      );
    }

    const amount =
      body.amount === undefined
        ? payment.amount
        : Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    const date =
      body.date === undefined ? payment.date : new Date(body.date);

    if (Number.isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { success: false, message: "Enter a valid date." },
        { status: 400 },
      );
    }

    const paidTo =
      body.paidTo === undefined ? payment.paidTo : body.paidTo;

    if (typeof paidTo !== "string" || !paidTo.trim()) {
      return NextResponse.json(
        { success: false, message: "Enter the payment recipient." },
        { status: 400 },
      );
    }

    const paymentMethod =
      body.paymentMethod === undefined
        ? payment.paymentMethod
        : body.paymentMethod;

    if (!methods.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment method." },
        { status: 400 },
      );
    }

    const companyId =
      body.companyId === undefined
        ? payment.companyId?.toString()
        : body.companyId || undefined;

    let validCompanyId:
      | mongoose.Types.ObjectId
      | undefined;

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

    const purchaseId =
      body.flowerPurchaseId === undefined
        ? payment.flowerPurchaseId?.toString()
        : body.flowerPurchaseId || undefined;

    let validPurchaseId:
      | mongoose.Types.ObjectId
      | undefined;

    if (purchaseId) {
      if (
        typeof purchaseId !== "string" ||
        !mongoose.Types.ObjectId.isValid(purchaseId)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid supplier bill ID." },
          { status: 400 },
        );
      }

      const purchase = await FlowerPurchase.findById(purchaseId).lean();

      if (
        !purchase ||
        purchase.branchId.toString() !== branchId
      ) {
        return NextResponse.json(
          { success: false, message: "Supplier bill does not match this branch." },
          { status: 400 },
        );
      }

      if (
        validCompanyId &&
        purchase.companyId.toString() !== validCompanyId.toString()
      ) {
        return NextResponse.json(
          { success: false, message: "Company does not match the supplier bill." },
          { status: 400 },
        );
      }

      validPurchaseId = new mongoose.Types.ObjectId(purchaseId);

      if (!validCompanyId) {
        validCompanyId = purchase.companyId;
      }
    }

    if (body.date !== undefined) {
      if (
        typeof body.date !== "string" ||
        !body.date.trim() ||
        Number.isNaN(new Date(body.date).getTime())
      ) {
        return NextResponse.json(
          { success: false, message: "Enter a valid date." },
          { status: 400 },
        );
      }
    }

    payment.branchId = new mongoose.Types.ObjectId(branchId);
    payment.date = new Date(date);
    payment.amount = Number(amount.toFixed(2));
    payment.paidTo = paidTo.trim();
    payment.companyId = validCompanyId;
    payment.flowerPurchaseId = validPurchaseId;
    payment.paymentMethod = paymentMethod;

    if (body.invoiceNumber !== undefined) {
      payment.invoiceNumber =
        typeof body.invoiceNumber === "string"
          ? body.invoiceNumber.trim()
          : "";
    }

    if (body.reference !== undefined) {
      payment.reference =
        typeof body.reference === "string"
          ? body.reference.trim()
          : "";
    }

    if (body.description !== undefined) {
      payment.description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";
    }

    if (body.notes !== undefined) {
      payment.notes =
        typeof body.notes === "string" ? body.notes.trim() : "";
    }

    payment.updatedBy = new mongoose.Types.ObjectId(user.id);

    await payment.save();

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully.",
      payment,
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: Context,
) {
  try {
    const user = await requireAuth();

    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("FORBIDDEN");
    }

    await connectDB();

    const id = await getId(context);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID." },
        { status: 400 },
      );
    }

    const payment = await PartnerFundedPayment.findById(id);

    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment not found." },
        { status: 404 },
      );
    }

    await PartnerFundedPayment.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "Payment deleted successfully.",
    });
  } catch (error) {
    return responseError(error);
  }
}
