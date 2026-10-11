"use client";

import { useState } from "react";

export default function SetupPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function createOwner() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Mohamed Farhan",
          email: "owner@modernrose.ae",
          password: "TempPassword123!",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to create owner");
        return;
      }

      setMessage("Owner created successfully!");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-[#253d2f]">Development Setup</h1>

        <p className="mt-2 text-sm text-gray-500">
          Create the initial Modern Rose owner account.
        </p>

        <button
          onClick={createOwner}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#253d2f] px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Owner"}
        </button>

        {message && (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
