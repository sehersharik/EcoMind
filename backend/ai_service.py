"""AI service: Claude via Emergent LLM key + prompt optimization/analysis heuristics."""

import os
import re
import math
import uuid
from typing import AsyncGenerator, Dict, Any, List, Tuple
import litellm


class UserMessage:
    def __init__(self, text: str):
        self.text = text


class TextDelta:
    def __init__(self, content: str):
        self.content = content


class StreamDone:
    pass


class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "anthropic"
        self.model = "claude-3-5-sonnet-20241022"

    def with_model(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        return self

    async def stream_message(self, msg: UserMessage):
        model_str = f"{self.provider}/{self.model}"
        if self.provider == "openai":
            model_str = self.model

        messages = [{"role": "system", "content": self.system_message}, {"role": "user", "content": msg.text}]

        try:
            response = await litellm.acompletion(model=model_str, messages=messages, stream=True, api_key=self.api_key if self.api_key else None)
            async for chunk in response:
                if chunk.choices and len(chunk.choices) > 0 and chunk.choices[0].delta.content:
                    yield TextDelta(content=chunk.choices[0].delta.content)
            yield StreamDone()
        except Exception as e:
            yield TextDelta(content=f" [LLM Error: {str(e)}]")
            yield StreamDone()


EMERGENT_LLM_KEY = os.environ.get("LLM_API_KEY", "")

# --------- LLM wrapper (modular so provider can be swapped) ---------
DEFAULT_PROVIDER = "anthropic"
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

PROVIDER_MODELS = {
    "claude": ("anthropic", "claude-3-5-sonnet-20241022"),
    "gpt": ("openai", "gpt-4o"),
    "gemini": ("gemini", "gemini-1.5-flash"),
}


def _resolve_model(model_choice: str) -> Tuple[str, str]:
    return PROVIDER_MODELS.get(model_choice, PROVIDER_MODELS["claude"])


def build_chat(session_id: str, system_message: str, model_choice: str = "claude") -> LlmChat:
    provider, model = _resolve_model(model_choice)
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)


async def stream_reply(
    session_id: str, history: List[Dict[str, str]], user_text: str, system_message: str, model_choice: str = "claude"
) -> AsyncGenerator[str, None]:
    """Yield content deltas for streaming."""
    chat = build_chat(session_id, system_message, model_choice)
    # Send history through system_message context (LlmChat retains context per session_id)
    # Note: session_id keeps context, so we just send the new message.
    msg = UserMessage(text=user_text)
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def optimize_prompt_llm(prompt: str) -> str:
    """Use Claude to REWRITE the user's prompt (never answer it)."""
    system = (
        "You are a Prompt Rewriter. Your ONLY job is to rewrite the user's INPUT PROMPT "
        "into a shorter, clearer, more efficient version of that same prompt.\n\n"
        "STRICT RULES:\n"
        "1. NEVER answer, respond to, or execute the prompt.\n"
        "2. NEVER add explanations, preambles, quotes, prefixes like 'Optimized:' or 'Here is'.\n"
        "3. Preserve the user's original intent and required outputs.\n"
        "4. Remove filler words (please, kindly, could you, I want you to, basically, actually).\n"
        "5. Keep it in the same language as the input.\n"
        "6. Output ONLY the rewritten prompt — nothing else.\n\n"
        "EXAMPLES:\n"
        "Input: 'Could you please kindly write me a python function that basically reverses a string for me?'\n"
        "Output: Write a Python function that reverses a string.\n\n"
        "Input: 'I want you to explain, in a very detailed way, what the theory of relativity is about, please.'\n"
        "Output: Explain the theory of relativity in detail.\n\n"
        "Input: 'hi, can you tell me the capital of france?'\n"
        "Output: What is the capital of France?"
    )
    chat = build_chat(f"opt_{uuid.uuid4().hex[:8]}", system, "claude")
    result = ""
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            result += ev.content
        elif isinstance(ev, StreamDone):
            break
    cleaned = result.strip().strip('"').strip("'")
    # Strip common preambles if the model still adds them
    for prefix in ("Optimized:", "Optimized prompt:", "Rewritten:", "Here is the rewritten prompt:", "Output:"):
        if cleaned.lower().startswith(prefix.lower()):
            cleaned = cleaned[len(prefix) :].strip().strip('"').strip("'")
    return cleaned


async def suggest_completion_llm(partial: str) -> str:
    """Suggest next few words for a partial prompt (Smart Compose style)."""
    if len(partial.strip()) < 4:
        return ""
    system = (
        "You are Smart Compose for AI prompts. Given the user's partial prompt, suggest a natural "
        "continuation of 3 to 10 words that would complete their thought. Output ONLY the "
        "continuation text (no repetition of what they already typed, no quotes, no explanation)."
    )
    chat = build_chat(f"sug_{uuid.uuid4().hex[:8]}", system, "claude")
    result = ""
    async for ev in chat.stream_message(UserMessage(text=partial)):
        if isinstance(ev, TextDelta):
            result += ev.content
        elif isinstance(ev, StreamDone):
            break
    # Keep short
    words = result.strip().split()
    return " ".join(words[:12])


async def suggest_batch_llm(partial: str) -> Dict[str, Any]:
    """Return inline continuation + 3 alternative continuations as chips.
    Uses ONE LLM call to keep latency low."""
    if len(partial.strip()) < 4:
        return {"inline": "", "chips": []}
    system = (
        "You are Smart Compose for AI prompts. Given the user's partial prompt, "
        "return 4 short, natural continuations (3-8 words each) that could complete their thought. "
        "Each continuation must:\n"
        "- NOT repeat what the user already typed\n"
        "- Be a plausible next fragment\n"
        "- Be distinct from the others (different angles)\n\n"
        "Output ONLY a JSON array of 4 strings, no explanation, no markdown fences. Example:\n"
        '["with error handling", "in Python 3", "and include unit tests", "step by step"]'
    )
    chat = build_chat(f"sugb_{uuid.uuid4().hex[:8]}", system, "claude")
    result = ""
    async for ev in chat.stream_message(UserMessage(text=partial)):
        if isinstance(ev, TextDelta):
            result += ev.content
        elif isinstance(ev, StreamDone):
            break
    # Extract JSON array
    import json as _j

    m = re.search(r"\[.*?\]", result, re.DOTALL)
    if m:
        try:
            arr = _j.loads(m.group(0))
            arr = [str(x).strip().strip('"').strip("'") for x in arr if str(x).strip()][:4]
            if arr:
                return {"inline": arr[0], "chips": arr}
        except Exception:
            pass
    # Fallback: single continuation
    words = result.strip().split()
    inline = " ".join(words[:8])
    return {"inline": inline, "chips": [inline] if inline else []}


# --------- Analytics heuristics (mock/estimate — modular for future real integration) ---------
# Token estimation: ~4 chars per token (industry standard for English)
def estimate_tokens(text: str) -> int:
    if not text or not text.strip():
        return 0
    return max(1, math.ceil(len(text.strip()) / 4))


# Realistic industry estimates per 1,000 tokens (input + avg output)
# Sources: Anthropic/OpenAI pricing pages, Hugging Face / Stanford HAI energy studies (2024).
MODEL_METRICS = {
    "gpt": {"co2_per_1k": 4.32, "cost_per_1k": 0.010, "water_ml_per_1k": 15.0, "energy_wh_per_1k": 2.9, "speed": 88, "accuracy": 94},
    "claude": {"co2_per_1k": 3.10, "cost_per_1k": 0.008, "water_ml_per_1k": 11.0, "energy_wh_per_1k": 2.1, "speed": 92, "accuracy": 96},
    "gemini": {"co2_per_1k": 2.40, "cost_per_1k": 0.006, "water_ml_per_1k": 9.0, "energy_wh_per_1k": 1.7, "speed": 95, "accuracy": 91},
    "deepseek": {"co2_per_1k": 1.80, "cost_per_1k": 0.003, "water_ml_per_1k": 7.5, "energy_wh_per_1k": 1.3, "speed": 90, "accuracy": 88},
    "llama": {"co2_per_1k": 1.50, "cost_per_1k": 0.002, "water_ml_per_1k": 6.0, "energy_wh_per_1k": 1.1, "speed": 82, "accuracy": 85},
}


def estimate_impact(tokens: int, model_choice: str = "claude") -> Dict[str, float]:
    """Impact is linear in tokens — never negative."""
    tokens = max(0, int(tokens))
    m = MODEL_METRICS.get(model_choice, MODEL_METRICS["claude"])
    k = tokens / 1000.0
    return {
        "tokens": tokens,
        "carbon_g": round(k * m["co2_per_1k"], 4),
        "cost_usd": round(k * m["cost_per_1k"], 5),
        "water_ml": round(k * m["water_ml_per_1k"], 3),
        "energy_wh": round(k * m["energy_wh_per_1k"], 4),
    }


def estimate_savings(tokens_before: int, tokens_after: int, model_choice: str = "claude") -> Dict[str, float]:
    """Compute savings from the token DELTA. Always non-negative — if optimized
    is same length or longer, all savings are exactly zero."""
    tokens_before = max(0, int(tokens_before))
    tokens_after = max(0, int(tokens_after))
    delta = max(0, tokens_before - tokens_after)
    impact = estimate_impact(delta, model_choice)
    return {
        "tokens_saved": delta,
        "carbon_saved": impact["carbon_g"],
        "cost_saved": impact["cost_usd"],
        "water_saved": impact["water_ml"],
        "energy_saved": impact["energy_wh"],
        "time_saved_s": round(delta * 0.02, 2),
    }


FILLER_WORDS = {
    "very",
    "really",
    "just",
    "actually",
    "basically",
    "literally",
    "simply",
    "perhaps",
    "maybe",
    "kind of",
    "sort of",
    "i mean",
    "i think that",
    "please",
    "could you",
    "would you kindly",
    "if possible",
    "for me",
    "i want you to",
}


def detect_improvements(prompt: str) -> List[Dict[str, Any]]:
    """Grammarly-style rule-based writing issues detector."""
    issues: List[Dict[str, Any]] = []
    if not prompt or not prompt.strip():
        return issues
    text = prompt
    lower = text.lower()

    # 1) Filler / redundant words
    fillers = [
        ("please", "Remove — LLMs don't need politeness."),
        ("kindly", "Remove — filler word."),
        ("could you", "Cut — go direct."),
        ("would you kindly", "Cut — overly polite."),
        ("i want you to", "Cut — start with the verb."),
        ("if possible", "Cut — assume yes."),
        ("basically", "Cut — vague filler."),
        ("really", "Cut — filler intensifier."),
        ("very", "Reduce use — often filler."),
        ("actually", "Cut — filler."),
        ("just", "Cut — filler."),
        ("literally", "Cut — filler."),
        ("simply", "Cut — filler."),
        ("for me", "Cut — implied."),
        ("i mean", "Cut — filler."),
        ("i think that", "Cut — hedging."),
    ]
    for word, msg in fillers:
        # Word-boundary match, avoid false positives inside other words
        if re.search(rf"\b{re.escape(word)}\b", lower):
            issues.append(
                {
                    "type": "redundant",
                    "text": word,
                    "message": msg,
                    "severity": "low",
                }
            )

    # 2) Vague words
    vague_terms = [
        ("something", "Be specific — replace with the actual thing."),
        ("somehow", "Explain how — be specific."),
        ("somewhere", "Where exactly?"),
        ("somewhat", "Quantify — how much?"),
        ("maybe", "Decide — remove uncertainty."),
        ("perhaps", "Decide — remove uncertainty."),
        ("kind of", "Vague — commit to a description."),
        ("sort of", "Vague — commit to a description."),
        ("stuff", "Replace with the specific noun."),
        ("things", "Replace with the specific noun."),
        ("nice", "Vague — specify what makes it good."),
        ("good", "Vague — specify criteria (e.g. 'concise', 'fast')."),
    ]
    for word, msg in vague_terms:
        if re.search(rf"\b{re.escape(word)}\b", lower):
            issues.append(
                {
                    "type": "vague",
                    "text": word,
                    "message": msg,
                    "severity": "medium",
                }
            )

    # 3) Long sentences
    sentences = [s.strip() for s in re.split(r"[.!?]", text) if s.strip()]
    for s in sentences:
        wc = len(s.split())
        if wc > 30:
            issues.append(
                {
                    "type": "long_sentence",
                    "text": (s[:60] + "…") if len(s) > 60 else s,
                    "message": f"Sentence has {wc} words — split under 25.",
                    "severity": "high",
                }
            )

    # 4) Overall length
    total_words = len(re.findall(r"\w+", text))
    if total_words > 100:
        issues.append(
            {
                "type": "too_long",
                "text": f"{total_words} words",
                "message": "Prompt is long — trim under 80 words for efficiency.",
                "severity": "medium",
            }
        )

    # 5) Missing action verb
    action_verbs = {
        "write",
        "generate",
        "explain",
        "summarize",
        "analyze",
        "create",
        "list",
        "compare",
        "translate",
        "code",
        "debug",
        "refactor",
        "design",
        "plan",
        "describe",
        "review",
        "convert",
        "build",
        "fix",
        "find",
        "identify",
    }
    words_lower = [w.lower() for w in re.findall(r"\w+", text)]
    if total_words >= 6 and not any(w in action_verbs for w in words_lower):
        issues.append(
            {
                "type": "no_action",
                "text": "no action verb",
                "message": "Start with a clear verb (write, explain, generate…).",
                "severity": "medium",
            }
        )

    # 6) All caps shouting
    caps_words = [w for w in re.findall(r"\w+", text) if len(w) > 3 and w.isupper()]
    if len(caps_words) >= 2:
        issues.append(
            {
                "type": "shouting",
                "text": ", ".join(caps_words[:3]),
                "message": "Avoid ALL CAPS — doesn't add priority for LLMs.",
                "severity": "low",
            }
        )

    # Cap total issues shown
    return issues[:8]


def analyze_prompt(prompt: str) -> Dict[str, Any]:
    """Rule-based prompt health analysis."""
    text = prompt.strip()
    if not text:
        return {
            "quality": 0,
            "clarity": 0,
            "complexity": 0,
            "efficiency": 0,
            "eco_score": 0,
            **estimate_impact(0),
            "improvements": [],
        }
    words = re.findall(r"\w+", text)
    n_words = len(words)
    n_chars = len(text)
    sentences = [s for s in re.split(r"[.!?]", text) if s.strip()]
    n_sent = max(1, len(sentences))
    avg_sent = n_words / n_sent

    # Quality: presence of action verbs, specificity, structure
    action_verbs = {
        "write",
        "generate",
        "explain",
        "summarize",
        "analyze",
        "create",
        "list",
        "compare",
        "translate",
        "code",
        "debug",
        "refactor",
        "design",
        "plan",
    }
    has_action = int(any(w.lower() in action_verbs for w in words))
    has_context = int(n_words >= 8)
    has_specificity = int(any(c.isdigit() for c in text) or any(w[0].isupper() for w in words[1:]))
    quality = min(100, 30 + 20 * has_action + 25 * has_context + 15 * has_specificity + min(10, n_words // 5))

    # Clarity: penalize filler words and very long sentences
    lower = text.lower()
    filler_count = sum(1 for f in FILLER_WORDS if f in lower)
    clarity = max(10, 100 - filler_count * 8 - max(0, int(avg_sent - 25)) * 2)

    # Complexity: word length + sentence length
    avg_word_len = sum(len(w) for w in words) / max(1, n_words)
    complexity = min(100, int(avg_word_len * 6 + avg_sent * 1.2))

    # Efficiency: shorter and denser is more efficient
    efficiency = max(10, 100 - max(0, (n_chars - 200) // 8))

    tokens = estimate_tokens(text)
    impact = estimate_impact(tokens, "claude")

    # Eco score: efficiency-weighted
    eco_score = int(0.5 * efficiency + 0.3 * clarity + 0.2 * quality)

    return {
        "quality": int(quality),
        "clarity": int(clarity),
        "complexity": int(complexity),
        "efficiency": int(efficiency),
        "eco_score": int(eco_score),
        **impact,
        "word_count": n_words,
        "char_count": n_chars,
        "improvements": detect_improvements(prompt),
    }


def recommend_model(prompt: str) -> Dict[str, Any]:
    """Heuristic model recommendation based on prompt content."""
    lower = prompt.lower()
    reasons = []
    if any(k in lower for k in ["code", "function", "bug", "python", "javascript", "sql", "refactor"]):
        best = "claude"
        reasons.append("Coding task — Claude excels at code reasoning.")
    elif any(k in lower for k in ["image", "creative", "story", "poem", "brainstorm"]):
        best = "gpt"
        reasons.append("Creative task — GPT is strong at open-ended generation.")
    elif any(k in lower for k in ["search", "current", "news", "latest", "web"]):
        best = "gemini"
        reasons.append("Real-time / factual — Gemini has strong grounding.")
    elif len(prompt) < 80:
        best = "gemini"
        reasons.append("Short prompt — smaller model saves carbon with similar quality.")
    else:
        best = "claude"
        reasons.append("General reasoning — Claude balances accuracy and efficiency.")

    comparisons = []
    for k, m in MODEL_METRICS.items():
        comparisons.append(
            {
                "model": k,
                "name": {"gpt": "GPT-5.4", "claude": "Claude Sonnet 4.5", "gemini": "Gemini 3 Flash", "deepseek": "DeepSeek V3", "llama": "Llama 3.3"}[k],
                **m,
                "recommended": k == best,
            }
        )
    return {"recommended": best, "reasons": reasons, "models": comparisons}
