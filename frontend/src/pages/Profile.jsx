import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Award, Trophy, Leaf, Coins, Calendar, Mail } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="p-8 max-w-[1200px]" data-testid="profile-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Your account</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Profile</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 glass rounded-3xl p-6 text-center">
          <div className="w-24 h-24 rounded-2xl mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-display font-bold text-3xl overflow-hidden glow-emerald">
            {user.picture ? <img src={user.picture} alt="" className="w-24 h-24 object-cover" /> : user.name.slice(0, 1)}
          </div>
          <div className="font-display font-bold text-2xl">{user.name}</div>
          <div className="text-sm text-zinc-500 mt-1 flex items-center justify-center gap-1"><Mail className="w-3.5 h-3.5" /> {user.email}</div>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <Trophy className="w-3 h-3" /> Level {user.level}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <StatBox icon={Leaf} label="Eco Score" value={user.eco_score} />
          <StatBox icon={Coins} label="Green Coins" value={user.green_coins} />
          <StatBox icon={Trophy} label="XP" value={user.xp} />
          <StatBox icon={Award} label="Badges" value={user.badges?.length || 0} />
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="glass rounded-3xl p-6 card-lift">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
        <Icon className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="font-display font-bold text-3xl">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}
