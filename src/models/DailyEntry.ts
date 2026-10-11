import mongoose, { Schema, Document } from "mongoose";

export interface IDailyEntry extends Document {
  branchId: mongoose.Types.ObjectId;
  date: Date;

  income: {
    cash: number;
    visa: number;
    online: number;
    other: number;
  };

  notes?: string;
  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const DailyEntrySchema = new Schema<IDailyEntry>(
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

    income: {
      cash: {
        type: Number,
        default: 0,
        min: 0,
      },

      visa: {
        type: Number,
        default: 0,
        min: 0,
      },

      online: {
        type: Number,
        default: 0,
        min: 0,
      },

      other: {
        type: Number,
        default: 0,
        min: 0,
      },
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

DailyEntrySchema.index({ branchId: 1, date: 1 }, { unique: true });

const DailyEntry =
  mongoose.models.DailyEntry ||
  mongoose.model<IDailyEntry>("DailyEntry", DailyEntrySchema);

export default DailyEntry;
