import React, { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import api from "@/lib/api";

const COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#a855f7", "#ef4444"];

export default function Analytics() {
  const [trends, setTrends] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    api.get(`/analytics/trends?days=${days}`).then(({ data }) => setTrends(data));
  }, [days]);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="analytics-page">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Insights</div>
          <h1 className="font-display font-bold text-4xl tracking-tight">Carbon Dashboard</h1>
          <p className="text-zinc-500 mt-1">Track your sustainability impact across time and models.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full glass border border-white/10">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              data-testid={`analytics-range-${d}`}
              className={`px-4 py-1.5 rounded-full text-xs transition-colors ${
                days === d ? "bg-emerald-500 text-black font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {!trends ? (
        <div className="text-zinc-500 font-mono text-sm">Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Carbon saved (g CO₂)</div>
            <h3 className="font-display font-semibold text-xl mb-4">Daily trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trends.daily}>
                <defs>
                  <linearGradient id="carbonG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="carbon" stroke="url(#carbonG)" strokeWidth={2.5} dot={{ fill: "#10b981", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Tokens saved</div>
            <h3 className="font-display font-semibold text-xl mb-4">Daily usage</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trends.daily}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="tokens" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Carbon per model (g CO₂ / 1k tokens)</div>
            <h3 className="font-display font-semibold text-xl mb-4">Model footprint</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trends.per_model} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis dataKey="model" type="category" tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="carbon" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Cost saved distribution</div>
            <h3 className="font-display font-semibold text-xl mb-4">Where you saved</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={trends.per_model}
                  dataKey="carbon"
                  nameKey="model"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {trends.per_model.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
