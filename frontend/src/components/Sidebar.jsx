import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, MessageSquare, Sparkles, BarChart3, Trophy,
  Award, FileText, User, Settings, Shield, LogOut, Leaf,
} from "lucide-react";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/chat", label: "AI Chat", icon: MessageSquare, tid: "nav-chat" },
  { to: "/copilot", label: "Prompt Copilot", icon: Sparkles, tid: "nav-copilot" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, tid: "nav-analytics" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, tid: "nav-leaderboard" },
  { to: "/achievements", label: "Achievements", icon: Award, tid: "nav-achievements" },
  { to: "/reports", label: "Reports", icon: FileText, tid: "nav-reports" },
  { to: "/profile", label: "Profile", icon: User, tid: "nav-profile" },
  { to: "/settings", label: "Settings", icon: Settings, tid: "nav-settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 glass-strong border-r border-white/5 flex flex-col">
      <div className="p-6 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center glow-emerald">
          <Leaf className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none tracking-tight">EcoMind</div>
          <div className="text-[10px] text-zinc-500 mt-1 tracking-wider uppercase">Think Smart. Think Green.</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, tid }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={tid}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm my-0.5 transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            data-testid="nav-admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm my-0.5 transition-colors ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold text-sm">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              (user?.name || "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-zinc-500 truncate">Lv {user?.level || 1} · {user?.green_coins || 0} 🌱</div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={async () => { await logout(); nav("/"); }}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
