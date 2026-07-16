import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Check, X, GitCompare, Zap, Cloud, Droplet, Clock, DollarSign,
  Leaf, Brain, Wand2, Send, Edit3, Bot, Loader2, RotateCcw,
  AlertCircle, AlertTriangle, Info, CornerDownLeft,
} from "lucide-react";
import api, { API } from "@/lib/api";

const MODELS = [
  { id: "claude", name: "Claude Sonnet 4.5" },
  { id: "gpt", name: "GPT-5.4" },
  { id: "gemini", name: "Gemini 3 Flash" },
];

const SEVERITY = {
  high:   { icon: AlertCircle,   color: "text-red-400",     bg: "bg-red-500/5 border-red-500/20" },
  medium: { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/5 border-amber-500/20" },
  low:    { icon: Info,          color: "text-cyan-400",    bg: "bg-cyan-500/5 border-cyan-500/20" },
};

function Bar({ label, value, color = "emerald", tid }) {
  const v = Math.max(0, Math.min(100, value));
  const grade = v >= 80 ? "excellent" : v >= 60 ? "good" : v >= 40 ? "ok" : "poor";
  return (
    <div data-testid={tid}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className={`font-mono ${color === "emerald" ? "text-emerald-400" : "text-cyan-400"}`}>
          {v} <span className="text-zinc-600">· {grade}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color === "emerald" ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-gradient-to-r from-cyan-500 to-cyan-300"}`}
          style={{ width: `${v}%`, transition: "width 0.35s cubic-bezier(0.2,0.9,0.3,1)" }}
        />
      </div>
    </div>
  );
}

/** Textarea with inline ghost-text (Gmail Smart Compose). */
function GhostTextarea({ value, onChange, suggestion, onAcceptSuggestion, testarea = {} }) {
  const areaRef = useRef();
  const ghostRef = useRef();

  // Sync scroll between textarea and mirror
  const handleScroll = () => {
    if (ghostRef.current && areaRef.current) {
      ghostRef.current.scrollTop = areaRef.current.scrollTop;
      ghostRef.current.scrollLeft = areaRef.current.scrollLeft;
    }
  };

  // Compose the ghost text: caret is at end of value, so append suggestion.
  // We only show ghost when value ends with content (not while user is deep-editing).
  const showGhost = !!suggestion && value.length > 0;
  // Add a joining space if user's text doesn't already end with whitespace
  const gap = value.length && !/\s$/.test(value) ? " " : "";

  return (
    <div className="relative rounded-2xl bg-black/30 border border-white/10 focus-within:border-emerald-500/50 transition-colors">
      {/* Ghost mirror layer (behind textarea) */}
      <div
        ref={ghostRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden p-4 font-mono text-sm leading-relaxed"
        style={{ color: "transparent" }}
      >
        <span>{value}</span>
        {showGhost && (
          <span className="text-zinc-500" data-testid="ghost-suggestion">{gap}{suggestion}</span>
        )}
        {/* Trailing space to preserve last-line height when empty */}
        {"\u200b"}
      </div>

      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={(e) => {
          if (e.key === "Tab" && suggestion) {
            e.preventDefault();
            onAcceptSuggestion();
          }
        }}
        rows={7}
        spellCheck
        {...testarea}
        className="relative w-full bg-transparent p-4 text-white placeholder:text-zinc-600 focus:outline-none resize-none font-mono text-sm leading-relaxed"
      />

      {showGhost && (
        <div className="absolute top-2 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 pointer-events-none">
          <CornerDownLeft className="w-3 h-3 -rotate-90" /> Tab to accept
        </div>
      )}
    </div>
  );
}

export default function Copilot() {
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [chips, setChips] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [optimized, setOptimized] = useState(null);
  const [editedOptimized, setEditedOptimized] = useState("");
  const [recommend, setRecommend] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude");

  // 'compose' → 'compare' → 'response'
  const [stage, setStage] = useState("compose");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const analyzeRef = useRef();
  const suggestRef = useRef();
  const responseRef = useRef();
  const suggestReqId = useRef(0);

  // Real-time analysis + model rec (fast, rule-based on server)
  useEffect(() => {
    if (analyzeRef.current) clearTimeout(analyzeRef.current);
    analyzeRef.current = setTimeout(async () => {
      if (!prompt.trim()) { setAnalysis(null); setRecommend(null); return; }
      try {
        const [{ data: a }, { data: r }] = await Promise.all([
          api.post("/prompt/analyze", { prompt, model: selectedModel }),
          api.post("/prompt/recommend", { prompt, model: selectedModel }),
        ]);
        setAnalysis(a);
        setRecommend(r);
      } catch {}
    }, 180);
    return () => clearTimeout(analyzeRef.current);
  }, [prompt, selectedModel]);

  // LLM Smart Compose (inline + chips) — slower debounce
  useEffect(() => {
    if (suggestRef.current) clearTimeout(suggestRef.current);
    setSuggestion("");
    setChips([]);
    if (prompt.trim().length < 8 || stage !== "compose") { setSuggestLoading(false); return; }
    setSuggestLoading(true);
    const myReq = ++suggestReqId.current;
    suggestRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post("/prompt/suggest", { prompt });
        // Only apply the latest request (avoid stale overwrites)
        if (myReq !== suggestReqId.current) return;
        setSuggestion(data.suggestion || "");
        setChips(Array.isArray(data.chips) ? data.chips.slice(0, 4) : []);
      } catch {} finally {
        if (myReq === suggestReqId.current) setSuggestLoading(false);
      }
    }, 500);
    return () => clearTimeout(suggestRef.current);
  }, [prompt, stage]);

  useEffect(() => {
    if (response) responseRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [response]);

  const acceptSuggestion = useCallback((text) => {
    const s = text ?? suggestion;
    if (!s) return;
    setPrompt((p) => p + (p.length && !/\s$/.test(p) ? " " : "") + s);
    setSuggestion("");
    setChips([]);
  }, [suggestion]);

  const applyImprovement = (issue) => {
    if (!issue?.text) return;
    // Remove first occurrence of the flagged text (case-insensitive, word boundary)
    const re = new RegExp(`\\s*\\b${issue.text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b\\s*`, "i");
    setPrompt((p) => p.replace(re, " ").replace(/\s+/g, " ").trim());
    toast.success("Applied — prompt cleaned");
  };

  // Optimize (rewrite prompt)
  const optimize = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setOptimized(null);
    try {
      const { data } = await api.post("/prompt/optimize", { prompt, model: selectedModel });
      setOptimized(data);
      setEditedOptimized(data.optimized);
      setStage("compare");
    } catch {
      toast.error("Optimization failed");
    } finally {
      setBusy(false);
    }
  };

  // Send final prompt to Claude
  const sendPromptToAI = async (finalText, wasOptimized) => {
    setStage("response");
    setFinalPrompt(finalText);
    setResponse("");
    setStreaming(true);
    if (wasOptimized && optimized) {
      try {
        await api.post("/prompt/accept", { prompt_id: optimized.prompt_id, accepted: true });
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ["#10b981", "#06b6d4", "#ffffff"] });
        toast.success(`🌱 +${Math.max(1, Math.floor(optimized.tokens_saved / 5))} Green Coins · ${optimized.tokens_saved} tokens saved`);
      } catch {}
    } else if (optimized) {
      try { await api.post("/prompt/accept", { prompt_id: optimized.prompt_id, accepted: false }); } catch {}
    }
    try {
      const token = localStorage.getItem("ecomind_token");
      const res = await fetch(`${API}/prompt/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ prompt: finalText, model: selectedModel }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const j = JSON.parse(line.slice(5).trim());
            if (j.delta) { full += j.delta; setResponse(full); }
            if (j.error) toast.error(j.error);
          } catch {}
        }
      }
    } catch { toast.error("Response failed"); }
    finally { setStreaming(false); }
  };

  const reset = () => {
    setStage("compose"); setOptimized(null); setEditedOptimized("");
    setResponse(""); setFinalPrompt("");
  };

  return (
    <div className="p-8 max-w-[1400px]" data-testid="copilot-page">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Signature feature
          </div>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-1">Prompt Copilot</h1>
          <p className="text-zinc-500">Real-time AI writing assistant · Smart Compose + Grammarly for prompts.</p>
        </div>
        {stage !== "compose" && (
          <button onClick={reset} data-testid="copilot-newprompt-btn"
            className="px-5 py-2.5 rounded-full glass border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> New prompt
          </button>
        )}
      </div>

      {/* Progress steps */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {[
          { id: "compose", label: "1. Compose" },
          { id: "compare", label: "2. Review & edit" },
          { id: "response", label: "3. AI response" },
        ].map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`px-3 py-1 rounded-full text-xs font-mono tracking-wide ${
              stage === s.id ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-zinc-500 border border-white/10"
            }`}>{s.label}</div>
            {i < 2 && <div className="w-6 h-px bg-white/10" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT column */}
        <div className="lg:col-span-2 space-y-4">
          {stage === "compose" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  Your prompt
                  {suggestLoading && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  data-testid="copilot-model-select"
                >
                  {MODELS.map((m) => <option key={m.id} value={m.id} className="bg-black">{m.name}</option>)}
                </select>
              </div>

              {/* Ghost-text textarea */}
              <GhostTextarea
                value={prompt}
                onChange={setPrompt}
                suggestion={suggestion}
                onAcceptSuggestion={() => acceptSuggestion()}
                testarea={{
                  placeholder: "Type a prompt… try 'could you please write a python function that reverses a string for me'",
                  "data-testid": "copilot-textarea",
                }}
              />

              {/* Suggestion chips */}
              <AnimatePresence>
                {chips.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 flex flex-wrap gap-2"
                    data-testid="copilot-chips"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1 w-full mb-1">
                      <Wand2 className="w-3 h-3 text-emerald-400" /> Try adding
                    </div>
                    {chips.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => acceptSuggestion(c)}
                        data-testid={`copilot-chip-${i}`}
                        className="group px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-xs text-zinc-300 hover:text-emerald-300 transition-colors"
                      >
                        <span className="text-emerald-500/70 group-hover:text-emerald-400 mr-1">+</span>
                        {c}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Live Improvements (Grammarly-style) */}
              <AnimatePresence>
                {analysis?.improvements?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4"
                    data-testid="copilot-improvements"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400" /> Live improvements ({analysis.improvements.length})
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {analysis.improvements.map((iss, idx) => {
                        const sev = SEVERITY[iss.severity] || SEVERITY.low;
                        const Icon = sev.icon;
                        const dismissable = ["redundant", "vague"].includes(iss.type);
                        return (
                          <div
                            key={idx}
                            className={`flex items-start gap-2 p-2.5 rounded-xl border ${sev.bg}`}
                            data-testid={`improvement-${idx}`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${sev.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-zinc-200">
                                <span className={`font-mono ${sev.color}`}>{iss.text}</span>
                                <span className="text-zinc-500"> — {iss.message}</span>
                              </div>
                            </div>
                            {dismissable && (
                              <button
                                onClick={() => applyImprovement(iss)}
                                data-testid={`improvement-apply-${idx}`}
                                className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/10 transition-colors"
                              >
                                Fix
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={optimize} disabled={busy || !prompt.trim()} data-testid="copilot-optimize-btn"
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold text-sm disabled:opacity-40 glow-emerald flex items-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {busy ? "Optimizing…" : "Optimize prompt"}
                </button>
                <button onClick={() => sendPromptToAI(prompt, false)} disabled={!prompt.trim() || streaming}
                  data-testid="copilot-send-original-btn"
                  className="px-5 py-2.5 rounded-full glass border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send as-is
                </button>
                <button onClick={() => { setPrompt(""); setSuggestion(""); setChips([]); }}
                  className="px-5 py-2.5 rounded-full text-zinc-400 hover:text-white text-sm" data-testid="copilot-clear-btn">
                  Clear
                </button>
              </div>
            </motion.div>
          )}

          {stage === "compare" && optimized && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-6 border border-emerald-500/20"
              data-testid="copilot-compare-panel">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-emerald-400" />
                  <span className="font-display font-semibold text-lg">Review your optimized prompt</span>
                </div>
                <div className="text-xs text-emerald-400 font-mono">
                  {optimized.tokens_saved > 0 ? `-${optimized.tokens_saved} tokens` : "No savings"}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <div className="text-[10px] uppercase tracking-widest text-red-400 mb-2">Original · {optimized.tokens_before} tokens</div>
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{optimized.original}</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> Optimized · editable
                  </div>
                  <textarea value={editedOptimized} onChange={(e) => setEditedOptimized(e.target.value)}
                    rows={5} data-testid="copilot-optimized-editor"
                    className="w-full bg-transparent text-sm text-zinc-100 focus:outline-none resize-none leading-relaxed font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {[
                  { icon: Zap, label: "Tokens", value: optimized.tokens_saved > 0 ? `-${optimized.tokens_saved}` : "0" },
                  { icon: Cloud, label: "Carbon", value: `${optimized.carbon_saved.toFixed(3)}g` },
                  { icon: DollarSign, label: "Cost", value: `$${optimized.cost_saved.toFixed(5)}` },
                  { icon: Droplet, label: "Water", value: `${optimized.water_saved.toFixed(2)}ml` },
                  { icon: Clock, label: "Time", value: `${optimized.time_saved_s}s` },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-white/5 text-center">
                    <m.icon className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                    <div className="text-sm font-mono text-white">{m.value}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => sendPromptToAI(editedOptimized, true)} disabled={!editedOptimized.trim()}
                  data-testid="copilot-accept-btn"
                  className="flex-1 min-w-[200px] py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold text-sm glow-emerald flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Accept & send to AI
                </button>
                <button onClick={() => sendPromptToAI(optimized.original, false)} data-testid="copilot-ignore-btn"
                  className="flex-1 min-w-[200px] py-2.5 rounded-full glass border border-white/10 hover:bg-white/5 text-sm flex items-center justify-center gap-2">
                  <X className="w-4 h-4" /> Use original instead
                </button>
              </div>
            </motion.div>
          )}

          {stage === "response" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"
              data-testid="copilot-response-panel">
              <div className="glass rounded-3xl p-5 border border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Prompt sent to {MODELS.find(m => m.id === selectedModel)?.name}</div>
                <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{finalPrompt}</div>
              </div>
              <div className="glass-strong rounded-3xl p-6 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-display font-semibold">EcoMind AI</span>
                  {streaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 ml-2" />}
                </div>
                {response ? (
                  <div className={`markdown text-zinc-100 ${streaming ? "streaming-cursor" : ""}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 py-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Thinking…
                  </div>
                )}
                <div ref={responseRef} />
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT column — live scores + model rec */}
        <div className="space-y-4">
          <div className="glass rounded-3xl p-6" data-testid="prompt-health-panel">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span className="font-display font-semibold">Prompt Health</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" title="Live" />
              </div>
              {analysis?.eco_score !== undefined && (
                <div className="text-xs font-mono text-emerald-400">Eco {analysis.eco_score}</div>
              )}
            </div>

            {!analysis ? (
              <div className="text-sm text-zinc-500 py-4 text-center">Start typing to analyze.</div>
            ) : (
              <div className="space-y-4">
                <Bar label="Quality" value={analysis.quality} tid="score-quality" />
                <Bar label="Clarity" value={analysis.clarity} color="cyan" tid="score-clarity" />
                <Bar label="Efficiency" value={analysis.efficiency} color="cyan" tid="score-efficiency" />
                <Bar label="Complexity" value={analysis.complexity} tid="score-complexity" />

                <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Est. tokens</div>
                    <div className="font-mono text-sm text-emerald-400">{analysis.tokens}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Carbon</div>
                    <div className="font-mono text-sm text-emerald-400">{analysis.carbon_g}g</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Cost</div>
                    <div className="font-mono text-sm text-cyan-400">${analysis.cost_usd}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Water</div>
                    <div className="font-mono text-sm text-cyan-400">{analysis.water_ml}ml</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {recommend && (
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Leaf className="w-4 h-4 text-emerald-400" />
                <span className="font-display font-semibold">Model Recommendation</span>
              </div>
              <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-400 uppercase tracking-widest mb-1">Best pick</div>
                <div className="font-display font-semibold text-lg">{recommend.models.find((m) => m.recommended)?.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{recommend.reasons[0]}</div>
              </div>
              <div className="space-y-2">
                {recommend.models.map((m) => (
                  <div key={m.model} className={`p-2.5 rounded-xl border ${m.recommended ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.02] border-white/5"}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={m.recommended ? "text-emerald-300 font-medium" : "text-zinc-300"}>{m.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{m.co2_per_1k}g/1k</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                      <span>speed {m.speed}</span>
                      <span>acc {m.accuracy}</span>
                      <span>${m.cost_per_1k}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
