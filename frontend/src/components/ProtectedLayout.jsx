import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex items-center gap-3 text-emerald-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-mono text-sm">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return (
    <div className="flex bg-[#050505] min-h-screen noise" data-testid="app-shell">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
