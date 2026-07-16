import React, { useEffect, useState } from "react";
import { Trophy, Award, Star } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/leaderboard").then(({ data }) => setRows(data)); }, []);

  return (
    <div className="p-8 max-w-[1200px]" data-testid="leaderboard-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><Trophy className="w-3.5 h-3.5" /> Community</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Leaderboard</h1>
        <p className="text-zinc-500 mt-1">The greenest prompters on EcoMind. Save more, rise faster.</p>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_120px_120px_120px] gap-4 px-6 py-4 border-b border-white/5 text-xs uppercase tracking-widest text-zinc-500">
          <span>Rank</span><span>User</span><span className="text-right">Green Coins</span><span className="text-right">Level</span><span className="text-right">Eco Score</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.user_id}
            className={`grid grid-cols-[60px_1fr_120px_120px_120px] gap-4 px-6 py-4 border-b border-white/5 items-center ${
              r.user_id === user?.user_id ? "bg-emerald-500/5" : ""
            }`}
            data-testid={`leaderboard-row-${i}`}
          >
            <span className={`font-display font-bold text-lg ${i < 3 ? "text-emerald-400" : "text-zinc-500"}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold text-sm shrink-0 overflow-hidden">
                {r.picture ? <img src={r.picture} alt="" className="w-9 h-9 object-cover" /> : r.name.slice(0, 1)}
              </div>
              <span className="truncate">{r.name}{r.user_id === user?.user_id && <span className="ml-2 text-xs text-emerald-400">(you)</span>}</span>
            </div>
            <span className="text-right font-mono text-emerald-400">{r.green_coins}</span>
            <span className="text-right font-mono">Lv {r.level}</span>
            <span className="text-right font-mono text-cyan-400">{r.eco_score}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="p-8 text-center text-zinc-500 text-sm">No data yet.</div>}
      </div>
    </div>
  );
}
