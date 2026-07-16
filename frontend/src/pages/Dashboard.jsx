import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Leaf, Coins, Cloud, Zap, Droplet, DollarSign, MessageSquare, Sparkles, Trophy, Award } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function Stat({ icon: Icon, label, value, unit, accent = "emerald", tid }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-6 card-lift"
      data-testid={tid}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent === "emerald" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-cyan-500/10 border border-cyan-500/20"}`}>
          <Icon className={`w-4 h-4 ${accent === "emerald" ? "text-emerald-400" : "text-cyan-400"}`} />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">{unit}</span>
      </div>
      <div className="font-display font-bold text-3xl mb-1 tracking-tight">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="p-8 text-zinc-500 font-mono text-sm">Loading dashboard…</div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px]" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Welcome back</div>
          <h1 className="font-display font-bold text-4xl tracking-tight">Hey, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-zinc-500 mt-1">Here's your sustainability impact at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/chat">
            <button className="px-5 py-2.5 rounded-full glass border border-white/10 hover:bg-white/5 text-sm transition-colors" data-testid="dashboard-newchat-btn">
              <MessageSquare className="w-4 h-4 inline mr-2" /> New chat
            </button>
          </Link>
          <Link to="/copilot">
            <button className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold text-sm glow-emerald" data-testid="dashboard-copilot-btn">
              <Sparkles className="w-4 h-4 inline mr-2" /> Open Copilot
            </button>
          </Link>
        </div>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat icon={Leaf} label="Eco Score" value={data.eco_score} unit="pts" tid="stat-eco-score" />
        <Stat icon={Coins} label="Green Coins" value={data.green_coins} unit="coins" accent="cyan" tid="stat-green-coins" />
        <Stat icon={Trophy} label="Level" value={data.level} unit={`${data.xp} XP`} tid="stat-level" />
        <Stat icon={MessageSquare} label="Total Prompts" value={data.total_prompts} unit="count" accent="cyan" tid="stat-prompts" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat icon={Cloud} label="Carbon Saved" value={data.total_carbon_saved.toFixed(2)} unit="g CO₂" tid="stat-carbon" />
        <Stat icon={Zap} label="Energy Saved" value={data.total_energy_saved.toFixed(2)} unit="Wh" accent="cyan" tid="stat-energy" />
        <Stat icon={Droplet} label="Water Saved" value={data.total_water_saved.toFixed(1)} unit="ml" tid="stat-water" />
        <Stat icon={DollarSign} label="Cost Saved" value={`$${data.total_cost_saved.toFixed(4)}`} unit="USD" accent="cyan" tid="stat-cost" />
        <Stat icon={Sparkles} label="Tokens Saved" value={data.total_tokens_saved.toLocaleString()} unit="tokens" tid="stat-tokens" />
      </div>

      {/* Two column: chats + prompts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-xl">Recent Chats</h3>
            <Link to="/chat" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</Link>
          </div>
          {data.recent_chats.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">No chats yet. Start one!</div>
          ) : (
            <div className="space-y-2">
              {data.recent_chats.map((c) => (
                <Link key={c.session_id} to={`/chat?s=${c.session_id}`} className="block p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{c.title}</span>
                    <span className="text-xs text-zinc-600 font-mono">{c.model}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-xl">Recent Optimizations</h3>
            <Link to="/copilot" className="text-xs text-emerald-400 hover:text-emerald-300">Open Copilot →</Link>
          </div>
          {data.recent_prompts.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">Optimize your first prompt to see it here.</div>
          ) : (
            <div className="space-y-2">
              {data.recent_prompts.slice(0, 5).map((p) => (
                <div key={p.prompt_id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-sm truncate">{p.original}</div>
                  <div className="mt-1 text-xs text-emerald-400 font-mono">
                    -{p.tokens_saved} tokens · {p.carbon_saved.toFixed(3)}g CO₂
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Badges preview */}
      <div className="mt-4 glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-xl flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" /> Recent Badges
          </h3>
          <Link to="/achievements" className="text-xs text-emerald-400 hover:text-emerald-300">See all →</Link>
        </div>
        <div className="text-sm text-zinc-500">
          {data.badges?.length ? data.badges.join(", ") : "Complete challenges to unlock badges."}
        </div>
      </div>
    </div>
  );
}
