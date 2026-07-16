import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, Plus, Trash2, Copy, RefreshCw, Loader2, Bot, User as UserIcon, Sparkles } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const MODEL_OPTIONS = [
  { id: "claude", name: "Claude Sonnet 4.5" },
  { id: "gpt", name: "GPT-5.4" },
  { id: "gemini", name: "Gemini 3 Flash" },
];

export default function Chat() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(params.get("s") || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [model, setModel] = useState(user?.preferred_model || "claude");
  const bottomRef = useRef();

  const loadChats = useCallback(async () => {
    const { data } = await api.get("/chats");
    setChats(data);
    setActiveId((prev) => {
      if (!prev && data[0]) return data[0].session_id;
      return prev;
    });
  }, []);

  const loadMessages = async (sid) => {
    if (!sid) { setMessages([]); return; }
    const { data } = await api.get(`/chats/${sid}/messages`);
    setMessages(data);
  };

  const newChat = async () => {
    const { data } = await api.post("/chats", { title: "New Chat", model });
    setChats((c) => [data, ...c]);
    setActiveId(data.session_id);
    setMessages([]);
    setParams({ s: data.session_id });
  };

  const deleteChat = async (sid) => {
    await api.delete(`/chats/${sid}`);
    setChats((c) => c.filter((x) => x.session_id !== sid));
    if (activeId === sid) {
      setActiveId(null);
      setMessages([]);
    }
    toast.success("Chat deleted");
  };

  useEffect(() => { loadChats(); }, [loadChats]);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    let sid = activeId;
    if (!sid) {
      const { data } = await api.post("/chats", { title: input.slice(0, 40), model });
      setChats((c) => [data, ...c]);
      sid = data.session_id;
      setActiveId(sid);
      setParams({ s: sid });
    }
    const userText = input;
    setInput("");
    setMessages((m) => [...m, { message_id: `local-${Date.now()}`, role: "user", content: userText }]);
    setStreaming(true);
    setStreamingText("");

    try {
      const token = localStorage.getItem("ecomind_token");
      const res = await fetch(`${API}/chats/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ session_id: sid, message: userText, model }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
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
            if (j.delta) {
              full += j.delta;
              setStreamingText(full);
            }
            if (j.done) {
              setMessages((m) => [...m, { message_id: `local-a-${Date.now()}`, role: "assistant", content: full, tokens: j.tokens, carbon_g: j.carbon_g }]);
              setStreamingText("");
            }
            if (j.error) toast.error(j.error);
          } catch {}
        }
      }
      loadChats();
    } catch (e) {
      toast.error("Stream failed");
    } finally {
      setStreaming(false);
    }
  };

  const regenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Remove last assistant
    setMessages((m) => {
      const idx = [...m].reverse().findIndex((x) => x.role === "assistant");
      if (idx === -1) return m;
      return m.slice(0, m.length - 1 - idx);
    });
    setInput(lastUser.content);
    setTimeout(send, 50);
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="flex h-screen" data-testid="chat-page">
      {/* Chat list */}
      <aside className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a0a]/60">
        <div className="p-4 border-b border-white/5">
          <button
            onClick={newChat}
            data-testid="chat-new-btn"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold text-sm glow-emerald"
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((c) => (
            <div
              key={c.session_id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors mb-0.5 ${
                activeId === c.session_id ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => { setActiveId(c.session_id); setParams({ s: c.session_id }); }}
              data-testid={`chat-item-${c.session_id}`}
            >
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(c.session_id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity"
                aria-label="delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="text-xs text-zinc-600 p-4 text-center">No chats yet</div>
          )}
        </div>
      </aside>

      {/* Chat main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="glass-strong border-b border-white/5 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-emerald-400" />
            <span className="font-display font-semibold text-lg">AI Chat</span>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            data-testid="chat-model-select"
            className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id} className="bg-black">{m.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8" data-testid="chat-messages">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !streamingText && (
              <div className="text-center py-20">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-4 glow-emerald">
                  <Sparkles className="w-6 h-6 text-black" />
                </div>
                <h2 className="font-display font-bold text-2xl mb-2">How can I help you today?</h2>
                <p className="text-zinc-500 text-sm">Chat sustainably — EcoMind measures every token.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <motion.div
                key={m.message_id + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-emerald-500 to-cyan-500"}`}>
                  {m.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-black" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                    <span>{m.role === "user" ? user?.name : "EcoMind"}</span>
                    {m.tokens ? <span className="font-mono text-emerald-400">{m.tokens} tokens · {m.carbon_g?.toFixed(3)}g CO₂</span> : null}
                  </div>
                  <div className="markdown text-zinc-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                  {m.role === "assistant" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => copy(m.content)} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1" data-testid="msg-copy-btn">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button onClick={regenerate} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1" data-testid="msg-regen-btn">
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {streamingText && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500">
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-zinc-500 mb-1">EcoMind</div>
                  <div className="markdown text-zinc-100 streaming-cursor">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-white/5 px-6 py-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything… (Shift+Enter for newline)"
              rows={2}
              data-testid="chat-input"
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              data-testid="chat-send-btn"
              className="w-12 h-12 self-end rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold flex items-center justify-center disabled:opacity-40 glow-emerald"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="max-w-3xl mx-auto text-[10px] text-zinc-600 mt-2 text-center uppercase tracking-widest">
            EcoMind may produce inaccurate information. Every prompt counts — think green.
          </div>
        </div>
      </div>
    </div>
  );
}
