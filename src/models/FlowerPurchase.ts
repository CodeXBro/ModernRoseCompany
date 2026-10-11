
import mongoose, {
  Schema,
  Document,
} from "mongoose";

export type PaymentStatus =
  | "paid"
  | "pending"
  | "partial";

export type PaymentMethod =
  | "cash"
  | "visa"
  | "online"
  | "bank"
  | "other";

export interface IFlowerPurchase
  extends Document {
  branchId: mongoose.Types.ObjectId;

  date: Date;

  companyId: mongoose.Types.ObjectId;

  supplierName: string;

  invoiceNumber?: string;

  totalAmount: number;

  paidAmount: number;

  balanceAmount: number;

  paymentStatus: PaymentStatus;

  paymentMethod: PaymentMethod;

  notes?: string;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

const FlowerPurchaseSchema =
  new Schema<IFlowerPurchase>(
    {
      branchId: {
        type: Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
      },

      date: {
        type: Date,
        required: true,
      },

      companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
        required: true,
      },

      supplierName: {
        type: String,
        required: true,
        trim: true,
      },

      invoiceNumber: {
        type: String,
        trim: true,
      },

      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      paidAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      balanceAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      paymentStatus: {
        type: String,
        enum: [
          "paid",
          "pending",
          "partial",
        ],
        default: "pending",
      },

      paymentMethod: {
        type: String,
        enum: [
          "cash",
          "visa",
          "online",
          "bank",
          "other",
        ],
        required: true,
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
    },

    {
      timestamps: true,
    },
  );

const FlowerPurchase =
  mongoose.models.FlowerPurchase ||
  mongoose.model<IFlowerPurchase>(
    "FlowerPurchase",
    FlowerPurchaseSchema,
  );

export default FlowerPurchase;

