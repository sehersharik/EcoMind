import React, { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Leaf, Sparkles, BarChart3, Zap, Shield, ArrowRight, Github, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const Globe = lazy(() => import("@/components/Globe"));

const STATS = [
  { label: "AI Requests Optimized", value: "1.2M+", accent: "emerald" },
  { label: "Carbon Saved (kg)", value: "8,420", accent: "cyan" },
  { label: "Community Impact", value: "24k users", accent: "emerald" },
  { label: "Active Users", value: "3.6k", accent: "cyan" },
];

const FEATURES = [
  { icon: Sparkles, title: "Prompt Copilot", desc: "Gmail Smart Compose for AI prompts. Live suggestions, autocomplete, and instant optimization as you type." },
  { icon: BarChart3, title: "Carbon Analytics", desc: "Track carbon, water, energy, and cost saved. Every prompt is measured, every kilowatt is counted." },
  { icon: Zap, title: "Model Recommendation", desc: "We pick the greenest model for every task — GPT, Claude, Gemini, DeepSeek, or Llama." },
  { icon: Shield, title: "Eco Mode", desc: "One toggle. Auto-optimize every prompt, cache reused answers, prefer smaller models." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden noise">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-40 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="landing-logo">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">EcoMind</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#stats" className="hover:text-white transition-colors">Impact</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" data-testid="landing-signin-btn">
              <Button variant="ghost" className="rounded-full text-zinc-300 hover:text-white hover:bg-white/5">Sign in</Button>
            </Link>
            <Link to="/register" data-testid="landing-getstarted-btn">
              <Button className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 border-0 glow-emerald">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* 3D Globe */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={<div className="w-full h-full bg-[#050505]" />}>
            <Globe />
          </Suspense>
        </div>
        {/* Vignette */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505] pointer-events-none" />
        <div className="absolute inset-0 z-10 bg-grid opacity-30 pointer-events-none" />

        <div className="relative z-20 max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              AI Sustainability Copilot · Live
            </div>
            <h1 className="font-display font-black text-6xl sm:text-7xl lg:text-8xl leading-[0.9] tracking-tight mb-6">
              <span className="block">Eco</span>
              <span className="block gradient-text">Mind.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-zinc-300 font-light mb-3 tracking-tight">Think Smart. Think Green.</p>
            <p className="text-base text-zinc-500 mb-10 max-w-xl leading-relaxed">
              Write better AI prompts. Save tokens, carbon, water, and money — in real time.
              Powered by Claude, GPT, Gemini, and 40 years of sustainability science.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" data-testid="hero-cta-getstarted">
                <Button size="lg" className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold px-7 border-0 glow-emerald hover:opacity-95">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login" data-testid="hero-cta-demo">
                <Button size="lg" variant="outline" className="rounded-full glass border-white/10 hover:bg-white/5 text-white">
                  Try Demo
                </Button>
              </Link>
              <a href="#features" data-testid="hero-cta-learnmore">
                <Button size="lg" variant="ghost" className="rounded-full text-zinc-400 hover:text-white hover:bg-white/5">
                  Learn More
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-3xl p-6 card-lift"
                data-testid={`stat-${i}`}
              >
                <div className={`font-display font-bold text-4xl lg:text-5xl mb-2 ${s.accent === "emerald" ? "text-emerald-400" : "text-cyan-400"}`}>
                  {s.value}
                </div>
                <div className="text-sm text-zinc-500 tracking-wide">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-3">What EcoMind does</div>
            <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight mb-4">
              A smarter way to <span className="gradient-text">prompt AI.</span>
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed">
              Every character costs energy. EcoMind gives you real-time feedback, model recommendations,
              and gamified sustainability metrics so you write greener prompts without thinking about it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-3xl p-8 card-lift"
                data-testid={`feature-${i}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                  <f.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-display font-semibold text-2xl mb-2">{f.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-5xl sm:text-6xl tracking-tight mb-6">
            Start saving the planet, <br />
            <span className="gradient-text">one prompt at a time.</span>
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
            Free to try. No credit card. Join the community building the future of sustainable AI.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold px-8 border-0 glow-emerald" data-testid="cta-signup">
                Create your free account <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 text-center text-sm text-zinc-600">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <span>© 2026 EcoMind. Think Smart. Think Green.</span>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500">Made with</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </footer>
    </div>
  );
}
