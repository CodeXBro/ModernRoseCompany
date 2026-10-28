import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRateLimit extends Document {
  key: string;
  requestTimes: Date[];
  lastRequestAt?: Date;
  lastAllowedRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    requestTimes: {
      type: [Date],
      default: [],
    },
    lastRequestAt: {
      type: Date,
      default: undefined,
    },
    lastAllowedRequestId: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true },
);

RateLimitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 172800 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;
