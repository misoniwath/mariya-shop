import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // 🔒 SECURITY: Only these emails are allowed to access the admin panel
  const ALLOWED_EMAILS = [
    "mariyalim2511@gmail.com", // Replace with Shop Owner's Email
    "soniwathmi@gmail.com", // Replace with Your Email
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check Whitelist BEFORE calling Supabase
    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      setError("Access Denied: This email is not authorized.");
      setIsSubmitting(false);
      return;
    }

    try {
      // LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        onAuthSuccess();
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
      <div className="text-center mb-10 pt-4">
        <div className="inline-flex bg-indigo-50 p-4 rounded-full text-indigo-600 mb-6">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800">Admin Access</h1>
        <p className="text-slate-500">Sign in with your email address.</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Mail size={16} /> Email Address
          </label>
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Lock size={16} /> Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 group">
          {isSubmitting ? "Processing..." : "Login"}
          {!isSubmitting && (
            <ArrowRight
              size={20}
              className="group-hover:translate-x-1 transition"
            />
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400">
          Secure authentication powered by Supabase.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
