import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Circle, Target, Lock } from "lucide-react";
import api from "@/lib/api";

export default function Achievements() {
  const [challenges, setChallenges] = useState([]);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    api.get("/gamification/challenges").then(({ data }) => setChallenges(data));
    api.get("/gamification/badges").then(({ data }) => setBadges(data));
  }, []);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="achievements-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><Award className="w-3.5 h-3.5" /> Progress</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Achievements & Challenges</h1>
        <p className="text-zinc-500 mt-1">Earn Green Coins by keeping AI usage light and lean.</p>
      </div>

      <div className="mb-10">
        <h2 className="font-display font-semibold text-xl mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> Daily Challenges</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {challenges.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`glass rounded-3xl p-6 ${c.completed ? "border-emerald-500/30" : ""}`}
              data-testid={`challenge-${c.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                {c.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-zinc-600" />}
                <span className="text-xs font-mono text-emerald-400">+{c.reward} 🌱</span>
              </div>
              <div className="font-display font-semibold mb-2">{c.title}</div>
              <div className="h-1.5 rounded-full bg-white/5 mb-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%`, transition: "width 0.4s" }}
                />
              </div>
              <div className="text-xs text-zinc-500 font-mono">{c.progress} / {c.target}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-xl mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-emerald-400" /> Badges</h2>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {badges.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`glass rounded-3xl p-6 text-center ${b.earned ? "border-emerald-500/30" : "opacity-60"}`}
              data-testid={`badge-${b.id}`}
            >
              <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 ${b.earned ? "bg-gradient-to-br from-emerald-500 to-cyan-500 glow-emerald" : "bg-white/5"}`}>
                {b.earned ? <Award className="w-7 h-7 text-black" /> : <Lock className="w-6 h-6 text-zinc-600" />}
              </div>
              <div className="font-display font-semibold mb-1">{b.name}</div>
              <div className="text-xs text-zinc-500 mb-2">{b.desc}</div>
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{b.value} / {b.threshold}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
