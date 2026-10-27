import mongoose, { Document, Schema } from "mongoose";

export interface IPartnershipSettlement extends Document {
  date: Date;
  branchId: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartnershipSettlementSchema = new Schema<IPartnershipSettlement>(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    description: {
      type: String,
      required: true,
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
  { timestamps: true },
);

PartnershipSettlementSchema.index({ branchId: 1, date: -1 });

const PartnershipSettlement =
  mongoose.models.PartnershipSettlement ||
  mongoose.model<IPartnershipSettlement>(
    "PartnershipSettlement",
    PartnershipSettlementSchema,
  );

export default PartnershipSettlement;
