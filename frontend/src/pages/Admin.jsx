import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Users, Cloud, MessageSquare, Sparkles } from "lucide-react";
import api from "@/lib/api";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  const load = async () => {
    try {
      const [s, u] = await Promise.all([api.get("/admin/stats"), api.get("/admin/users")]);
      setStats(s.data); setUsers(u.data);
    } catch { toast.error("Admin access required"); }
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (uid, role) => {
    try {
      await api.patch(`/admin/users/${uid}/role`, { role: role === "admin" ? "user" : "admin" });
      toast.success("Role updated");
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="p-8 max-w-[1400px]" data-testid="admin-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Admin</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Admin Panel</h1>
        <p className="text-zinc-500 mt-1">Manage users, monitor usage, oversee sustainability metrics.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <AdminStat icon={Users} label="Total Users" value={stats.total_users} />
          <AdminStat icon={MessageSquare} label="Total Chats" value={stats.total_chats} />
          <AdminStat icon={Sparkles} label="Total Prompts" value={stats.total_prompts} />
          <AdminStat icon={Cloud} label="Tokens Saved" value={stats.total_tokens_saved.toLocaleString()} />
          <AdminStat icon={Cloud} label="Carbon Saved" value={`${stats.total_carbon_saved}g`} />
        </div>
      )}

      <div className="glass rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="font-display font-semibold text-lg">Users</div>
          <div className="text-xs text-zinc-500 font-mono">{users.length} total</div>
        </div>
        <div className="grid grid-cols-[1fr_120px_100px_100px_100px] gap-4 px-6 py-3 border-b border-white/5 text-xs uppercase tracking-widest text-zinc-500">
          <span>User</span><span>Role</span><span className="text-right">XP</span><span className="text-right">Coins</span><span className="text-right">Action</span>
        </div>
        {users.map((u) => (
          <div key={u.user_id} className="grid grid-cols-[1fr_120px_100px_100px_100px] gap-4 px-6 py-3 border-b border-white/5 items-center" data-testid={`admin-user-${u.user_id}`}>
            <div className="min-w-0">
              <div className="text-sm truncate">{u.name}</div>
              <div className="text-xs text-zinc-500 truncate">{u.email}</div>
            </div>
            <span className={`text-xs font-mono ${u.role === "admin" ? "text-cyan-400" : "text-zinc-400"}`}>{u.role}</span>
            <span className="text-right font-mono text-sm">{u.xp || 0}</span>
            <span className="text-right font-mono text-sm text-emerald-400">{u.green_coins || 0}</span>
            <div className="text-right">
              <button
                onClick={() => toggleRole(u.user_id, u.role)}
                className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
                data-testid={`admin-toggle-role-${u.user_id}`}
              >
                {u.role === "admin" ? "Demote" : "Promote"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminStat({ icon: Icon, label, value }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-cyan-400" />
      </div>
      <div className="font-display font-bold text-2xl">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
