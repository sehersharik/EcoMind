"""Application routes: chat, prompt, dashboard, gamification, reports, admin."""

import io
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from auth import get_current_user, get_admin_user
from models import User, ChatSession, ChatMessage, PromptRecord, serialize, new_id
from ai_service import (
    stream_reply,
    optimize_prompt_llm,
    suggest_batch_llm,
    analyze_prompt,
    recommend_model,
    estimate_tokens,
    estimate_impact,
    estimate_savings,
    MODEL_METRICS,
)

router = APIRouter()


# ------------------ Chat ------------------
class ChatCreateReq(BaseModel):
    title: Optional[str] = "New Chat"
    model: Optional[str] = "claude"


class ChatSendReq(BaseModel):
    session_id: str
    message: str
    model: Optional[str] = "claude"


@router.post("/chats")
async def create_chat(req: ChatCreateReq, user: User = Depends(get_current_user)):
    from server import db

    session = ChatSession(
        session_id=new_id("chat"),
        user_id=user.user_id,
        title=req.title or "New Chat",
        model=req.model or "claude",
    )
    await db.chat_sessions.insert_one(serialize(session))
    return session.model_dump()


@router.get("/chats")
async def list_chats(user: User = Depends(get_current_user)):
    from server import db

    docs = await db.chat_sessions.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return docs


@router.get("/chats/{session_id}/messages")
async def get_messages(session_id: str, user: User = Depends(get_current_user)):
    from server import db

    sess = await db.chat_sessions.find_one({"session_id": session_id, "user_id": user.user_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Chat not found")
    msgs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@router.delete("/chats/{session_id}")
async def delete_chat(session_id: str, user: User = Depends(get_current_user)):
    from server import db

    await db.chat_sessions.delete_one({"session_id": session_id, "user_id": user.user_id})
    await db.chat_messages.delete_many({"session_id": session_id})
    return {"ok": True}


@router.post("/chats/stream")
async def chat_stream(req: ChatSendReq, user: User = Depends(get_current_user)):
    from server import db

    sess = await db.chat_sessions.find_one({"session_id": req.session_id, "user_id": user.user_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Save user message
    user_msg = ChatMessage(
        message_id=new_id("msg"),
        session_id=req.session_id,
        user_id=user.user_id,
        role="user",
        content=req.message,
        tokens=estimate_tokens(req.message),
    )
    await db.chat_messages.insert_one(serialize(user_msg))

    # Fetch prior history for context (used implicitly via LLM session_id)
    system_msg = (
        "You are EcoMind — an AI Sustainability Copilot. You are helpful, concise, and always aware "
        "that shorter, clearer replies save energy and carbon. Use markdown when useful. "
        "Include code fences for code."
    )

    async def event_gen():
        full = ""
        try:
            async for chunk in stream_reply(
                session_id=req.session_id,
                history=[],
                user_text=req.message,
                system_message=system_msg,
                model_choice=req.model or "claude",
            ):
                full += chunk
                yield f"data: {json.dumps({'delta': chunk})}\n\n"

            # Save assistant message
            tokens = estimate_tokens(full)
            impact = estimate_impact(tokens, req.model or "claude")
            asst = ChatMessage(
                message_id=new_id("msg"),
                session_id=req.session_id,
                user_id=user.user_id,
                role="assistant",
                content=full,
                tokens=tokens,
                model=req.model or "claude",
                carbon_g=impact["carbon_g"],
            )
            await db.chat_messages.insert_one(serialize(asst))
            await db.chat_sessions.update_one(
                {"session_id": req.session_id},
                {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            # Auto-title from first user message if still default
            if sess.get("title") in (None, "", "New Chat"):
                title = (req.message[:48] + "...") if len(req.message) > 48 else req.message
                await db.chat_sessions.update_one({"session_id": req.session_id}, {"$set": {"title": title}})
            # Update user stats
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$inc": {"total_prompts": 1, "xp": 10, "green_coins": 2}},
            )
            yield f"data: {json.dumps({'done': True, 'tokens': tokens, 'carbon_g': impact['carbon_g']})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ------------------ Prompt Copilot ------------------
class PromptReq(BaseModel):
    prompt: str
    model: Optional[str] = "claude"


@router.post("/prompt/analyze")
async def analyze(req: PromptReq, user: User = Depends(get_current_user)):
    return analyze_prompt(req.prompt)


@router.post("/prompt/suggest")
async def suggest(req: PromptReq, user: User = Depends(get_current_user)):
    """Return an inline continuation + up to 4 chip suggestions in ONE LLM call."""
    try:
        data = await suggest_batch_llm(req.prompt)
        return {"suggestion": data.get("inline", ""), "chips": data.get("chips", [])}
    except Exception as e:
        return {"suggestion": "", "chips": [], "error": str(e)}


@router.post("/prompt/optimize")
async def optimize(req: PromptReq, user: User = Depends(get_current_user)):
    from server import db

    original = req.prompt
    try:
        optimized = await optimize_prompt_llm(original)
    except Exception:
        # Fallback heuristic: remove filler words + collapse whitespace
        import re as _re

        cleaned = _re.sub(r"\b(please|could you|would you kindly|i want you to|for me|if possible)\b", "", original, flags=_re.IGNORECASE)
        optimized = _re.sub(r"\s+", " ", cleaned).strip()

    # Guard: if the optimizer produced empty output or something longer, fall back to original
    if not optimized or not optimized.strip():
        optimized = original

    tokens_before = estimate_tokens(original)
    tokens_after = estimate_tokens(optimized)
    savings = estimate_savings(tokens_before, tokens_after, req.model or "claude")

    record = PromptRecord(
        prompt_id=new_id("pr"),
        user_id=user.user_id,
        original=original,
        optimized=optimized,
        tokens_before=tokens_before,
        tokens_after=tokens_after,
        tokens_saved=savings["tokens_saved"],
        carbon_saved=savings["carbon_saved"],
        cost_saved=savings["cost_saved"],
        water_saved=savings["water_saved"],
        energy_saved=savings["energy_saved"],
    )
    await db.prompts.insert_one(serialize(record))

    return {
        "prompt_id": record.prompt_id,
        "original": original,
        "optimized": optimized,
        "tokens_before": tokens_before,
        "tokens_after": tokens_after,
        **savings,
    }


class AcceptReq(BaseModel):
    prompt_id: str
    accepted: bool


@router.post("/prompt/accept")
async def accept_optimization(req: AcceptReq, user: User = Depends(get_current_user)):
    from server import db

    doc = await db.prompts.find_one({"prompt_id": req.prompt_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prompt not found")
    await db.prompts.update_one({"prompt_id": req.prompt_id}, {"$set": {"accepted": req.accepted}})

    if req.accepted:
        coins = max(1, doc["tokens_saved"] // 5)
        await db.users.update_one(
            {"user_id": user.user_id},
            {
                "$inc": {
                    "green_coins": coins,
                    "xp": coins * 2,
                    "total_tokens_saved": doc["tokens_saved"],
                    "total_carbon_saved": doc["carbon_saved"],
                    "total_cost_saved": doc["cost_saved"],
                    "total_water_saved": doc["water_saved"],
                    "total_energy_saved": doc["energy_saved"],
                    "eco_score": max(1, doc["tokens_saved"] // 10),
                }
            },
        )
        # Level up: level = 1 + xp // 500
        u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        new_level = 1 + (u.get("xp", 0) // 500)
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"level": new_level}})
    return {"ok": True}


@router.post("/prompt/recommend")
async def recommend(req: PromptReq, user: User = Depends(get_current_user)):
    return recommend_model(req.prompt)


@router.post("/prompt/run")
async def run_prompt(req: PromptReq, user: User = Depends(get_current_user)):
    """Send the (optimized) prompt to Claude and stream the response back.
    This is the final step of the Prompt Copilot flow."""
    from server import db

    system_msg = (
        "You are EcoMind — an AI Sustainability Copilot. Provide a helpful, concise answer "
        "to the user's prompt. Use markdown when useful. Keep responses lean to save energy."
    )

    async def event_gen():
        full = ""
        session_id = f"copilot_{new_id('run')}"
        try:
            from ai_service import stream_reply as _sr

            async for chunk in _sr(
                session_id=session_id,
                history=[],
                user_text=req.prompt,
                system_message=system_msg,
                model_choice=req.model or "claude",
            ):
                full += chunk
                yield f"data: {json.dumps({'delta': chunk})}\n\n"

            tokens = estimate_tokens(full)
            impact = estimate_impact(tokens, req.model or "claude")
            # Track this as a chat-equivalent for stats
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$inc": {"total_prompts": 1, "xp": 10, "green_coins": 2}},
            )
            yield f"data: {json.dumps({'done': True, 'tokens': tokens, 'carbon_g': impact['carbon_g']})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ------------------ Dashboard / Analytics ------------------
@router.get("/dashboard/summary")
async def dashboard_summary(user: User = Depends(get_current_user)):
    from server import db

    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    recent_chats = await db.chat_sessions.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).limit(5).to_list(5)
    recent_prompts = await db.prompts.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

    return {
        "eco_score": u.get("eco_score", 0),
        "green_coins": u.get("green_coins", 0),
        "xp": u.get("xp", 0),
        "level": u.get("level", 1),
        "total_prompts": u.get("total_prompts", 0),
        "total_tokens_saved": u.get("total_tokens_saved", 0),
        "total_carbon_saved": u.get("total_carbon_saved", 0.0),
        "total_cost_saved": u.get("total_cost_saved", 0.0),
        "total_water_saved": u.get("total_water_saved", 0.0),
        "total_energy_saved": u.get("total_energy_saved", 0.0),
        "badges": u.get("badges", []),
        "recent_chats": recent_chats,
        "recent_prompts": recent_prompts,
    }


@router.get("/analytics/trends")
async def analytics_trends(user: User = Depends(get_current_user), days: int = 7):
    from server import db

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    prompts = await db.prompts.find({"user_id": user.user_id}, {"_id": 0}).to_list(2000)

    daily = {}
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[d] = {"date": d, "carbon": 0.0, "tokens": 0, "cost": 0.0, "prompts": 0}

    for p in prompts:
        c = p.get("created_at")
        if isinstance(c, str):
            try:
                dt = datetime.fromisoformat(c)
            except Exception:
                continue
        else:
            dt = c
        key = dt.strftime("%Y-%m-%d")
        if key in daily:
            daily[key]["carbon"] += p.get("carbon_saved", 0.0)
            daily[key]["tokens"] += p.get("tokens_saved", 0)
            daily[key]["cost"] += p.get("cost_saved", 0.0)
            daily[key]["prompts"] += 1

    # Carbon per model (simulated distribution based on user's history)
    per_model = []
    for k, m in MODEL_METRICS.items():
        per_model.append({"model": k, "carbon": round(m["co2_per_1k"], 2)})

    return {
        "daily": list(daily.values()),
        "per_model": per_model,
    }


@router.get("/leaderboard")
async def leaderboard(user: User = Depends(get_current_user)):
    from server import db

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("green_coins", -1).limit(20).to_list(20)
    return [
        {
            "user_id": u["user_id"],
            "name": u["name"],
            "picture": u.get("picture"),
            "green_coins": u.get("green_coins", 0),
            "xp": u.get("xp", 0),
            "level": u.get("level", 1),
            "eco_score": u.get("eco_score", 0),
        }
        for u in users
    ]


# ------------------ Gamification ------------------
DAILY_CHALLENGES = [
    {"id": "opt5", "title": "Optimize 5 prompts today", "target": 5, "reward": 50, "type": "optimize"},
    {"id": "chat3", "title": "Have 3 AI chats", "target": 3, "reward": 30, "type": "chat"},
    {"id": "save100", "title": "Save 100 tokens", "target": 100, "reward": 40, "type": "tokens"},
]

BADGES = [
    {"id": "first_step", "name": "First Step", "desc": "Complete your first optimization", "threshold": 1, "field": "total_tokens_saved"},
    {"id": "eco_novice", "name": "Eco Novice", "desc": "Save 500 tokens", "threshold": 500, "field": "total_tokens_saved"},
    {"id": "eco_warrior", "name": "Eco Warrior", "desc": "Save 5,000 tokens", "threshold": 5000, "field": "total_tokens_saved"},
    {"id": "carbon_saver", "name": "Carbon Saver", "desc": "Save 10g of CO2", "threshold": 10, "field": "total_carbon_saved"},
    {"id": "green_master", "name": "Green Master", "desc": "Reach level 5", "threshold": 5, "field": "level"},
    {"id": "prompt_pro", "name": "Prompt Pro", "desc": "50 prompts", "threshold": 50, "field": "total_prompts"},
]


@router.get("/gamification/challenges")
async def get_challenges(user: User = Depends(get_current_user)):
    from server import db

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prompts_today = await db.prompts.count_documents(
        {
            "user_id": user.user_id,
            "accepted": True,
            "created_at": {"$regex": f"^{today}"},
        }
    )
    chats_today = await db.chat_sessions.count_documents(
        {
            "user_id": user.user_id,
            "created_at": {"$regex": f"^{today}"},
        }
    )
    tokens_agg = await db.prompts.find(
        {"user_id": user.user_id, "accepted": True, "created_at": {"$regex": f"^{today}"}}, {"_id": 0, "tokens_saved": 1}
    ).to_list(500)
    tokens_saved_today = sum(p.get("tokens_saved", 0) for p in tokens_agg)

    progress = {
        "optimize": prompts_today,
        "chat": chats_today,
        "tokens": tokens_saved_today,
    }
    return [{**c, "progress": progress.get(c["type"], 0), "completed": progress.get(c["type"], 0) >= c["target"]} for c in DAILY_CHALLENGES]


@router.get("/gamification/badges")
async def get_badges(user: User = Depends(get_current_user)):
    from server import db

    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    unlocked = []
    for b in BADGES:
        val = u.get(b["field"], 0)
        earned = val >= b["threshold"]
        unlocked.append({**b, "earned": earned, "value": val})
    return unlocked


# ------------------ Settings / Profile ------------------
class SettingsReq(BaseModel):
    eco_mode: Optional[bool] = None
    preferred_model: Optional[str] = None


@router.patch("/user/settings")
async def update_settings(req: SettingsReq, user: User = Depends(get_current_user)):
    from server import db

    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return {"eco_mode": u.get("eco_mode"), "preferred_model": u.get("preferred_model")}


@router.get("/user/export")
async def export_user_data(user: User = Depends(get_current_user)):
    from server import db

    prompts = await db.prompts.find({"user_id": user.user_id}, {"_id": 0}).to_list(5000)
    chats = await db.chat_sessions.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    msgs = await db.chat_messages.find({"user_id": user.user_id}, {"_id": 0}).to_list(5000)
    return {"user": user.model_dump(exclude={"password_hash"}), "prompts": prompts, "chats": chats, "messages": msgs}


# ------------------ Reports (PDF) ------------------
@router.get("/reports/pdf")
async def report_pdf(user: User = Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from server import db

    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    prompts = await db.prompts.find({"user_id": user.user_id, "accepted": True}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # Header
    c.setFillColor(colors.HexColor("#10B981"))
    c.rect(0, h - 3 * cm, w, 3 * cm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, h - 1.8 * cm, "EcoMind Sustainability Report")
    c.setFont("Helvetica", 11)
    c.drawString(2 * cm, h - 2.5 * cm, f"For {u.get('name')} — {datetime.now(timezone.utc).strftime('%B %d, %Y')}")

    # Stats
    y = h - 4.5 * cm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, y, "Your Impact")
    y -= 0.8 * cm
    c.setFont("Helvetica", 11)
    stats = [
        ("Eco Score", f"{u.get('eco_score', 0)}"),
        ("Green Coins", f"{u.get('green_coins', 0)}"),
        ("Level", f"{u.get('level', 1)} (XP {u.get('xp', 0)})"),
        ("Total Prompts", f"{u.get('total_prompts', 0)}"),
        ("Tokens Saved", f"{u.get('total_tokens_saved', 0):,}"),
        ("Carbon Saved", f"{u.get('total_carbon_saved', 0):.3f} g CO2"),
        ("Water Saved", f"{u.get('total_water_saved', 0):.2f} ml"),
        ("Energy Saved", f"{u.get('total_energy_saved', 0):.3f} Wh"),
        ("Cost Saved", f"${u.get('total_cost_saved', 0):.4f}"),
    ]
    for label, val in stats:
        c.drawString(2.2 * cm, y, f"{label}:")
        c.drawString(7.5 * cm, y, val)
        y -= 0.55 * cm

    # Recent optimizations
    y -= 0.4 * cm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, y, "Recent Optimizations")
    y -= 0.7 * cm
    c.setFont("Helvetica", 9)
    for p in prompts[:15]:
        if y < 3 * cm:
            c.showPage()
            y = h - 2 * cm
        orig = p.get("original", "")[:80] + ("..." if len(p.get("original", "")) > 80 else "")
        c.setFillColor(colors.HexColor("#71717A"))
        c.drawString(2 * cm, y, f"• {orig}")
        y -= 0.4 * cm
        c.setFillColor(colors.HexColor("#10B981"))
        c.drawString(2.3 * cm, y, f"  Saved {p.get('tokens_saved', 0)} tokens · {p.get('carbon_saved', 0):.3f}g CO2")
        y -= 0.55 * cm

    # Recommendations
    if y < 5 * cm:
        c.showPage()
        y = h - 2 * cm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, y, "Recommendations")
    y -= 0.7 * cm
    c.setFont("Helvetica", 10)
    for rec in [
        "Enable Eco Mode to auto-optimize prompts on every request.",
        "Prefer Gemini Flash or Claude for short factual queries — they use ~40% less energy.",
        "Cache repeat prompts to eliminate redundant model calls.",
        "Batch similar prompts to reduce total tokens and cost.",
    ]:
        c.drawString(2.2 * cm, y, f"• {rec}")
        y -= 0.5 * cm

    c.showPage()
    c.save()
    pdf = buf.getvalue()
    buf.close()

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ecomind-report.pdf"},
    )


# ------------------ Admin ------------------
@router.get("/admin/stats")
async def admin_stats(user: User = Depends(get_admin_user)):
    from server import db

    n_users = await db.users.count_documents({})
    n_chats = await db.chat_sessions.count_documents({})
    n_prompts = await db.prompts.count_documents({})
    total_tokens = 0
    total_carbon = 0.0
    async for p in db.prompts.find({}, {"_id": 0, "tokens_saved": 1, "carbon_saved": 1}):
        total_tokens += p.get("tokens_saved", 0)
        total_carbon += p.get("carbon_saved", 0.0)
    return {
        "total_users": n_users,
        "total_chats": n_chats,
        "total_prompts": n_prompts,
        "total_tokens_saved": total_tokens,
        "total_carbon_saved": round(total_carbon, 3),
    }


@router.get("/admin/users")
async def admin_users(user: User = Depends(get_admin_user)):
    from server import db

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return users


class RoleReq(BaseModel):
    role: str


@router.patch("/admin/users/{user_id}/role")
async def set_user_role(user_id: str, req: RoleReq, admin: User = Depends(get_admin_user)):
    from server import db

    if req.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": req.role}})
    return {"ok": True}
