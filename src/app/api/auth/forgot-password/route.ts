import { randomBytes, createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import RateLimit from "@/models/RateLimit";

export const runtime = "nodejs";

const GENERIC_MESSAGE = "If the account exists, a reset link will be sent.";

const HOUR = 60 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function checkLimit({
  key,
  maxRequests,
  cooldownMs,
}: {
  key: string;
  maxRequests: number;
  cooldownMs?: number;
}): Promise<boolean> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - HOUR);
  const cooldownCutoff = new Date(now.getTime() - (cooldownMs ?? 0));

  // Create the record if it doesn't exist.
  try {
    await RateLimit.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          requestTimes: [],
        },
      },
      { upsert: true },
    );
  } catch (error: any) {
    // A concurrent request may have created the same unique key.
    if (error?.code !== 11000) {
      throw error;
    }
  }

  const requestId = randomUUID();

  // Check the limits and update atomically.
  // This avoids the updatePipeline error from the previous version.
  const result = await RateLimit.updateOne(
    {
      key,
      $expr: {
        $and: [
          {
            $lt: [
              {
                $size: {
                  $filter: {
                    input: {
                      $ifNull: ["$requestTimes", []],
                    },
                    as: "time",
                    cond: {
                      $gt: ["$$time", hourAgo],
                    },
                  },
                },
              },
              maxRequests,
            ],
          },
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$lastRequestAt", null] }, null],
              },
              {
                $lte: ["$lastRequestAt", cooldownCutoff],
              },
            ],
          },
        ],
      },
    },
    {
      $push: {
        requestTimes: now,
      },
      $set: {
        lastRequestAt: now,
        lastAllowedRequestId: requestId,
      },
    },
  );

  return result.modifiedCount === 1;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    await connectDB();

    // Identify the client IP. Configure your hosting proxy to
    // provide a trustworthy client IP header in production.
    const forwardedFor = request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // IP limit: 20 requests per hour.
    const ipAllowed = await checkLimit({
      key: `ip:${hashKey(ip)}`,
      maxRequests: IP_LIMIT,
    });

    if (!ipAllowed) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    // Email limit: 5 requests per hour and a 60-second cooldown.
    const emailAllowed = await checkLimit({
      key: `email:${hashKey(email)}`,
      maxRequests: EMAIL_LIMIT,
      cooldownMs: COOLDOWN,
    });

    if (!emailAllowed) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    const user = await User.findOne({
      email,
      isActive: true,
    });

    if (user) {
      const token = randomBytes(32).toString("hex");

      const hashedToken = createHash("sha256").update(token).digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + HOUR);

      await user.save();

      const baseUrl = process.env.NEXTAUTH_URL;
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_APP_PASSWORD;

      if (!baseUrl || !emailUser || !emailPassword) {
        throw new Error("Password reset email configuration is missing.");
      }

      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      await transporter.sendMail({
        from: `"Modern Rose" <${emailUser}>`,
        to: user.email,
        subject: "Reset your Modern Rose password",
        text:
          `You requested a password reset. ` +
          `Open this link within one hour: ${resetUrl}\n\n` +
          "If you did not request this, ignore this email.",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#253d2f">
            <h2>Modern Rose</h2>
            <h3>Reset your password</h3>
            <p>We received a request to reset your password.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;background:#253d2f;color:white;padding:12px 20px;text-decoration:none;border-radius:6px">
                Reset Password
              </a>
            </p>
            <p>This link expires in one hour.</p>
            <p>If you did not request a reset, you can ignore this email.</p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      {
        message: "Unable to process your request. Please try again later.",
      },
      { status: 500 },
    );
  }
}
