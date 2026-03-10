import { useState } from "react";
import { useAuth } from "./useAuth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, AlertCircle, Terminal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import logoIcon from "@assets/icon_1772859732991.png";

// Dev-only autofill credentials are read from environment variables so that
// no plaintext passwords live in source code. Set VITE_DEV_ADMIN_EMAIL and
// VITE_DEV_ADMIN_PASSWORD in your local .env / Replit Secrets. The autofill
// card is stripped from production builds entirely by Vite (import.meta.env.DEV).
const DEV_CREDENTIALS = {
  email: import.meta.env.VITE_DEV_ADMIN_EMAIL || "",
  password: import.meta.env.VITE_DEV_ADMIN_PASSWORD || "",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (isAuthenticated) {
    setLocation("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!result.ok) {
        const data = await result.json();
        throw new Error(data.message || "Invalid email or password");
      }

      setLocation("/admin");
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <img src={logoIcon} alt="Viva Web Designs" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-login-title">
              Viva Web Designs
            </h1>
            <p className="text-gray-500 mt-1">Internal Platform</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6"
              data-testid="text-login-error"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@vivawebdesigns.com"
                  className="pl-10"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white h-11"
              disabled={isSubmitting}
              data-testid="button-login"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Internal access only. Contact admin for credentials.
          </p>
        </div>

        {import.meta.env.DEV && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
            data-testid="card-dev-credentials"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Terminal className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Dev / Testing Credentials
              </span>
            </div>

            <div className="space-y-1.5 mb-3 font-mono text-xs bg-white border border-amber-100 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400 select-none">email</span>
                <span className="text-gray-800 select-all" data-testid="text-dev-email">
                  {DEV_CREDENTIALS.email}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400 select-none">password</span>
                <span className="text-gray-800 select-all" data-testid="text-dev-password">
                  {DEV_CREDENTIALS.password}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmail(DEV_CREDENTIALS.email);
                setPassword(DEV_CREDENTIALS.password);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-lg py-2 transition-colors"
              data-testid="button-use-dev-credentials"
            >
              <Zap className="w-3.5 h-3.5" />
              Auto-fill credentials
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
