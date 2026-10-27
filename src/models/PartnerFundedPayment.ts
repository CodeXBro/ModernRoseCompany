
import mongoose, { Document, Schema } from "mongoose";

export type PartnerFundedPaymentMethod =
  | "cash"
  | "bank"
  | "visa"
  | "online"
  | "other";

export interface IPartnerFundedPayment extends Document {
  branchId: mongoose.Types.ObjectId;
  date: Date;
  amount: number;

  paidTo: string;
  companyId?: mongoose.Types.ObjectId;
  flowerPurchaseId?: mongoose.Types.ObjectId;

  invoiceNumber?: string;
  paymentMethod: PartnerFundedPaymentMethod;
  reference?: string;
  description?: string;
  notes?: string;

  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const PartnerFundedPaymentSchema =
  new Schema<IPartnerFundedPayment>(
    {
      branchId: {
        type: Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
        index: true,
      },

      date: {
        type: Date,
        required: true,
        index: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0.01,
      },

      paidTo: {
        type: String,
        required: true,
        trim: true,
      },

      companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
      },

      flowerPurchaseId: {
        type: Schema.Types.ObjectId,
        ref: "FlowerPurchase",
      },

      invoiceNumber: {
        type: String,
        trim: true,
      },

      paymentMethod: {
        type: String,
        enum: ["cash", "bank", "visa", "online", "other"],
        default: "bank",
        required: true,
      },

      reference: {
        type: String,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
      },

      notes: {
        type: String,
        trim: true,
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
    },
  );

PartnerFundedPaymentSchema.index({
  branchId: 1,
  date: -1,
});

const PartnerFundedPayment =
  mongoose.models.PartnerFundedPayment ||
  mongoose.model<IPartnerFundedPayment>(
    "PartnerFundedPayment",
    PartnerFundedPaymentSchema,
  );

export default PartnerFundedPayment;
