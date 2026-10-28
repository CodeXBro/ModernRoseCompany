"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = "modern-rose-forgot-password-cooldown";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Restore the countdown if the user refreshes the page.
  useEffect(() => {
    const savedUntil = localStorage.getItem(STORAGE_KEY);

    if (savedUntil) {
      const remaining = Math.max(
        0,
        Math.ceil((Number(savedUntil) - Date.now()) / 1000),
      );

      setSecondsLeft(remaining);

      if (remaining === 0) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Update the countdown every second.
  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => {
        const next = Math.max(0, current - 1);

        if (next === 0) {
          localStorage.removeItem(STORAGE_KEY);
        }

        return next;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading || secondsLeft > 0) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      setMessage(
        data.message || "If the account exists, a reset link will be sent.",
      );

      const until = Date.now() + COOLDOWN_SECONDS * 1000;

      localStorage.setItem(STORAGE_KEY, String(until));
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch {
      setMessage("Unable to send the request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-semibold tracking-widest text-[#c76953]">
          MODERN ROSE
        </p>

        <h1 className="text-2xl font-bold text-[#253d2f]">Forgot password?</h1>

        <p className="mt-2 text-sm text-gray-500">
          Enter your account email and we&apos;ll send you a password reset
          link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Email address
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={secondsLeft > 0 || loading}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#253d2f] focus:ring-2 focus:ring-[#253d2f]/10 disabled:bg-gray-100"
            />
          </label>

          <button
            type="submit"
            disabled={loading || secondsLeft > 0}
            className="w-full rounded-lg bg-[#253d2f] px-4 py-3 font-medium text-white transition hover:bg-[#1c3024] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Sending..."
              : secondsLeft > 0
                ? `Resend available in ${secondsLeft}s`
                : "Send Reset Link"}
          </button>

          {secondsLeft > 0 && (
            <p className="text-center text-sm text-gray-500" role="timer">
              Please wait {secondsLeft} seconds before requesting another link.
            </p>
          )}

          {message && (
            <p role="status" className="text-sm text-gray-600">
              {message}
            </p>
          )}
        </form>

        <Link
          href="/login"
          className="mt-6 block text-center text-sm font-medium text-[#253d2f] hover:underline"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}
