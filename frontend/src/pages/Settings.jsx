import React, { useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Leaf, Bell, Globe, Shield, Palette } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [ecoMode, setEcoMode] = useState(user?.eco_mode ?? true);
  const [preferredModel, setPreferredModel] = useState(user?.preferred_model || "claude");

  const save = async (updates) => {
    try {
      const { data } = await api.patch("/user/settings", updates);
      setUser({ ...user, ...data });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
    <div className="p-8 max-w-[1000px]" data-testid="settings-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><SettingsIcon className="w-3.5 h-3.5" /> Preferences</div>
        <h1 className="font-display font-bold text-4xl tracking-tight">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Eco Mode */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="font-display font-semibold text-lg">Eco Mode</div>
                <div className="text-sm text-zinc-500 mt-1">Auto-optimize prompts, prefer smaller models, cache responses.</div>
              </div>
            </div>
            <Switch
              checked={ecoMode}
              onCheckedChange={(v) => { setEcoMode(v); save({ eco_mode: v }); }}
              data-testid="settings-ecomode-switch"
            />
          </div>
        </div>

        {/* Preferred model */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Palette className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Preferred AI Model</div>
              <div className="text-sm text-zinc-500 mt-1">Default model for chats and analysis.</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "claude", name: "Claude", desc: "Sonnet 4.5" },
              { id: "gpt", name: "GPT", desc: "GPT-5.4" },
              { id: "gemini", name: "Gemini", desc: "3 Flash" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => { setPreferredModel(m.id); save({ preferred_model: m.id }); }}
                data-testid={`settings-model-${m.id}`}
                className={`p-4 rounded-2xl border transition-colors text-left ${
                  preferredModel === m.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <div className="font-display font-semibold">{m.name}</div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Other placeholders */}
        <div className="glass rounded-3xl p-6 opacity-70">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Notifications</div>
              <div className="text-sm text-zinc-500">Coming soon — weekly sustainability digest.</div>
            </div>
            <Switch disabled />
          </div>
        </div>

        <div className="glass rounded-3xl p-6 opacity-70">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Language</div>
              <div className="text-sm text-zinc-500">English (more languages soon).</div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 opacity-70">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Privacy</div>
              <div className="text-sm text-zinc-500">Your prompts are encrypted at rest. Never shared.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
