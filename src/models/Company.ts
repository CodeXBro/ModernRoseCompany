
import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  companyName: string;
  supplierName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    supplierName: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Company =
  mongoose.models.Company ||
  mongoose.model<ICompany>(
    "Company",
    CompanySchema,
  );

export default Company;

