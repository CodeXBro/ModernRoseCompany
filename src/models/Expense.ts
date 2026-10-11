import mongoose, { Schema, Document } from "mongoose";

export type ExpenseCategory =
  | "delivery"
  | "salary"
  | "rent"
  | "electricity"
  | "water"
  | "packaging"
  | "fuel"
  | "maintenance"
  | "marketing"
  | "other";

export type PaymentMethod = "cash" | "visa" | "online" | "other";

export interface IExpense extends Document {
  branchId: mongoose.Types.ObjectId;
  date: Date;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
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

    category: {
      type: String,
      enum: [
        "delivery",
        "salary",
        "rent",
        "electricity",
        "water",
        "packaging",
        "fuel",
        "maintenance",
        "marketing",
        "other",
      ],
      required: true,
    },

    description: {
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "visa", "online", "other"],
      required: true,
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

const Expense =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
