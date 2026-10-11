import mongoose, { Schema, Document } from "mongoose";

export interface IFlower extends Document {
  name: string;
  category?: string;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FlowerSchema = new Schema<IFlower>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    unit: {
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

const Flower =
  mongoose.models.Flower || mongoose.model<IFlower>("Flower", FlowerSchema);

export default Flower;
