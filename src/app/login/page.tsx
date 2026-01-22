/**
 * Custom Login Page with Glassmorphism UI
 * Location: src/app/login/page.tsx
 *
 * Features:
 * - Glassmorphism card design matching home page aesthetic
 * - Framer Motion animations
 * - Dark/Light mode support
 * - Error handling with visual feedback
 */

"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock,
  User,
  AlertCircle,
  Loader2,
  Settings,
  ArrowLeft,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const authError = searchParams.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    authError ? "Invalid username or password" : null,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        callbackUrl,
        redirect: true,
      });

      // If redirect is false and there's an error
      if (result?.error) {
        setError("Invalid username or password");
        setIsLoading(false);
      }
    } catch {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Background Pattern - matching home page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Back to Home Button */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute top-6 left-6 z-20"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
      </motion.div>

      {/* Content Container */}
      <div className="relative z-10 text-center max-w-md mx-auto w-full">
        {/* Logo/Icon - matching home page */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <Settings className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Admin
            <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Dashboard
            </span>
          </h1>
          <p className="text-lg text-slate-400 mb-10">
            Sign in to manage maps, nodes, and navigation routes
          </p>
        </motion.div>

        {/* Login Card - matching home page card style */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative group"
        >
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 transition-all duration-300 hover:bg-white/10 hover:border-white/20">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl opacity-0" />

            {/* Content */}
            <div className="relative z-10">
              {/* Error Alert */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username Field */}
                <div className="text-left">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl text-white placeholder-slate-500 outline-none transition-all duration-300 focus:bg-white/10"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="text-left">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-slate-500" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl text-white placeholder-slate-500 outline-none transition-all duration-300 focus:bg-white/10"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Sign In to Dashboard
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <p className="mt-6 text-center text-xs text-slate-500">
                Protected area • Authorized personnel only
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
