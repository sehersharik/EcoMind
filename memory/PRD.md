# EcoMind — PRD

## Original Problem Statement
Build a Premium AI SaaS Website – EcoMind. Tagline: Think Smart. Think Green.
EcoMind is an AI Sustainability Copilot that helps users write better AI prompts by
providing real-time prompt suggestions, prompt optimization, AI model
recommendations, and sustainability insights before sending prompts to AI models.

## Architecture
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + Framer Motion + react-three-fiber
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations (Claude Sonnet 4.5)
- Auth: JWT email/password + Emergent-managed Google OAuth (session cookie)
- Reports: ReportLab PDF
- Modular: `ai_service.py` provider abstraction so GPT/Gemini/DeepSeek/Llama can be swapped

## Personas
- Student / researcher wanting sustainable AI usage
- Developer optimizing prompt cost & tokens
- Sustainability-minded team lead demoing FYP-grade SaaS

## What's implemented (2026-02-15)
- Landing page with 3D globe, particles, network lines, animated stats
- Auth: email/password JWT + Google (Emergent) with session cookies
- Dashboard: 9 metric cards, recent chats, recent optimizations
- AI Chat: streaming via SSE, multi-chat, delete, copy/regenerate, model switch, markdown
- Prompt Copilot: live analysis (350ms debounce), live suggestions (Smart Compose 750ms), one-click optimize, side-by-side compare, accept/ignore, confetti
- Prompt Analysis: quality/clarity/complexity/efficiency + eco score + tokens/carbon/cost/water
- Model Recommendation: heuristic + full 5-model comparison card
- Analytics: daily carbon trend, tokens bar chart, per-model footprint, pie chart, 7/14/30-day range
- Gamification: green coins, XP, level, daily challenges, badges (6), leaderboard
- Reports: PDF (ReportLab) + JSON export
- Profile & Settings: eco mode toggle, preferred model
- Admin panel: user list, stats, promote/demote
- Eco Mode toggle in Settings

## Prioritized Backlog
- P1: Real streaming autocomplete (WebSocket) for smoother Smart Compose
- P1: Persist eco_mode by auto-applying optimization in chat
- P2: Real-time notifications (weekly digest)
- P2: Multi-language support
- P2: Team workspaces / shared prompt libraries
- P2: API keys for external integrations
- P3: Slack/Discord notifications on badge unlock

## Test credentials
See /app/memory/test_credentials.md
