import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Leaf, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const { loginEmail, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginEmail(email, password);
      toast.success("Welcome back to EcoMind");
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col relative overflow-hidden noise">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <nav className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2.5" data-testid="login-logo-link">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">EcoMind</span>
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="glass-strong rounded-3xl p-8 border border-white/5">
            <h1 className="font-display font-bold text-3xl tracking-tight mb-2">Welcome back</h1>
            <p className="text-zinc-500 text-sm mb-8">Sign in to continue optimizing your prompts.</p>

            <button
              onClick={loginWithGoogle}
              data-testid="google-login-btn"
              className="w-full flex items-center justify-center gap-3 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-zinc-600 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-full bg-white/5 border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white"
                    placeholder="you@example.com"
                    data-testid="login-email-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-full bg-white/5 border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white"
                    placeholder="••••••••"
                    data-testid="login-password-input"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full h-11 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold border-0 hover:opacity-95 glow-emerald"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Sign in <ArrowRight className="w-4 h-4 ml-1" /></>)}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              New here?{" "}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300" data-testid="login-goto-register">
                Create an account
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
