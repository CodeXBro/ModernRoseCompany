"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Flower2 } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This password reset link is missing its token.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password.length > 72) {
      setError("Your password cannot exceed 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to reset your password.");
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#253d2f]">
          Invalid reset link
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          The link is missing a valid reset token. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block font-medium text-[#253d2f] hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef4f0] text-[#253d2f]">
          <LockKeyhole size={26} />
        </div>

        <h1 className="text-2xl font-bold text-[#253d2f]">Password updated!</h1>

        <p className="mt-3 text-sm text-gray-500">
          Your password has been changed successfully. You can now sign in with
          your new password.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-lg bg-[#253d2f] px-5 py-3 font-medium text-white hover:bg-[#1d3025]"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#253d2f]">
        Create a new password
      </h1>

      <p className="mt-2 text-sm text-gray-500">
        Choose a strong password for your Modern Rose account.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            New password
          </label>

          <div className="relative">
            <LockKeyhole
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-12 outline-none focus:border-[#253d2f] focus:ring-2 focus:ring-[#253d2f]/10"
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Confirm new password
          </label>

          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter your password again"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-2 focus:ring-[#253d2f]/10"
          />
        </div>

        <p className="text-xs text-gray-500">
          Use at least 8 characters. Your reset link expires after one hour.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#253d2f] px-5 py-3 font-medium text-white transition hover:bg-[#1d3025] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Updating password..." : "Reset Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg shadow-[#253d2f]/5">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef4f0] text-[#253d2f]">
            <Flower2 size={30} />
          </div>
          <h2 className="text-sm font-semibold tracking-widest text-[#253d2f]">
            MODERN ROSE
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Business Management System
          </p>
        </div>

        <Suspense
          fallback={
            <p className="text-center text-sm text-gray-500">
              Loading password reset...
            </p>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
