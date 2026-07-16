"""EcoMind Backend API tests."""

import os
import time
import uuid
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://carbon-sync-test.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Unique test creds per run
RUN_ID = uuid.uuid4().hex[:8]
TEST_EMAIL = f"test_{RUN_ID}@ecomind.app"
TEST_PASSWORD = "test1234"
TEST_NAME = f"Test User {RUN_ID}"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    """Register a fresh user, return (token, user)."""
    r = session.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME})
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def auth_headers(auth):
    token, _ = auth
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------------------- Health --------------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# -------------------- Auth --------------------
class TestAuth:
    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_and_login(self, session, auth):
        token, user = auth
        assert user["email"] == TEST_EMAIL
        assert user["name"] == TEST_NAME
        assert user["role"] == "user"

        # Login with same creds
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"] == TEST_EMAIL

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME})
        assert r.status_code == 400

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == TEST_EMAIL
        assert "password_hash" not in d


# -------------------- Dashboard --------------------
class TestDashboard:
    def test_summary_fields(self, session, auth_headers):
        r = session.get(f"{API}/dashboard/summary", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for f in (
            "eco_score",
            "green_coins",
            "xp",
            "level",
            "total_prompts",
            "total_tokens_saved",
            "total_carbon_saved",
            "total_cost_saved",
            "total_water_saved",
            "total_energy_saved",
            "badges",
            "recent_chats",
            "recent_prompts",
        ):
            assert f in d, f"Missing field {f}"


# -------------------- Prompt Copilot --------------------
class TestPromptCopilot:
    def test_analyze(self, session, auth_headers):
        r = session.post(f"{API}/prompt/analyze", headers=auth_headers, json={"prompt": "Write a python function to sort a list of numbers"})
        assert r.status_code == 200
        d = r.json()
        for k in ("quality", "clarity", "complexity", "efficiency", "eco_score", "tokens", "carbon_g", "cost_usd", "water_ml", "energy_wh"):
            assert k in d
        assert d["tokens"] > 0

    def test_suggest(self, session, auth_headers):
        r = session.post(f"{API}/prompt/suggest", headers=auth_headers, json={"prompt": "Write a poem about"})
        assert r.status_code == 200
        assert "suggestion" in r.json()

    def test_recommend(self, session, auth_headers):
        r = session.post(f"{API}/prompt/recommend", headers=auth_headers, json={"prompt": "Refactor this python function"})
        assert r.status_code == 200
        d = r.json()
        assert "recommended" in d and "models" in d
        assert len(d["models"]) == 5

    def test_optimize_and_accept(self, session, auth_headers):
        # Optimize (may fallback to heuristic if LLM slow, but should return 200)
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "Could you please kindly write a really very simple function that basically just prints hello world for me if possible"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert "prompt_id" in d and "optimized" in d
        assert d["tokens_before"] >= d["tokens_after"]
        prompt_id = d["prompt_id"]

        # Accept adds coins
        # Get user before
        before = session.get(f"{API}/dashboard/summary", headers=auth_headers).json()
        coins_before = before["green_coins"]

        ra = session.post(f"{API}/prompt/accept", headers=auth_headers, json={"prompt_id": prompt_id, "accepted": True})
        assert ra.status_code == 200

        after = session.get(f"{API}/dashboard/summary", headers=auth_headers).json()
        assert after["green_coins"] >= coins_before  # coins added (may be 1+ or same if 0 saved)


# -------------------- Chat --------------------
class TestChat:
    _session_id = None

    def test_create_chat(self, session, auth_headers):
        r = session.post(f"{API}/chats", headers=auth_headers, json={"title": "Test Chat", "model": "claude"})
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "Test Chat"
        assert "session_id" in d
        TestChat._session_id = d["session_id"]

    def test_list_chats(self, session, auth_headers):
        r = session.get(f"{API}/chats", headers=auth_headers)
        assert r.status_code == 200
        chats = r.json()
        assert isinstance(chats, list)
        assert any(c["session_id"] == TestChat._session_id for c in chats)

    def test_stream_message(self, session, auth_headers):
        """Stream a short chat message and verify SSE + persisted messages."""
        sid = TestChat._session_id
        assert sid, "No chat session"
        # POST SSE
        with session.post(
            f"{API}/chats/stream", headers=auth_headers, json={"session_id": sid, "message": "say hi in 3 words", "model": "claude"}, stream=True, timeout=60
        ) as r:
            assert r.status_code == 200, f"stream failed: {r.status_code} {r.text[:200]}"
            got_delta = False
            got_done = False
            for line in r.iter_lines():
                if not line:
                    continue
                s = line.decode() if isinstance(line, bytes) else line
                if s.startswith("data: "):
                    payload = s[6:]
                    try:
                        obj = json.loads(payload)
                    except Exception:
                        continue
                    if "delta" in obj:
                        got_delta = True
                    if obj.get("done"):
                        got_done = True
                        assert "tokens" in obj
                        break
                    if "error" in obj:
                        pytest.fail(f"stream error: {obj['error']}")
            assert got_delta, "No delta received from stream"
            assert got_done, "Stream did not signal done"

        # Verify messages persisted
        time.sleep(0.5)
        r2 = session.get(f"{API}/chats/{sid}/messages", headers=auth_headers)
        assert r2.status_code == 200
        msgs = r2.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

    def test_delete_chat(self, session, auth_headers):
        # Create then delete
        r = session.post(f"{API}/chats", headers=auth_headers, json={"title": "Del", "model": "claude"})
        sid = r.json()["session_id"]
        rd = session.delete(f"{API}/chats/{sid}", headers=auth_headers)
        assert rd.status_code == 200
        # Get messages should 404
        rm = session.get(f"{API}/chats/{sid}/messages", headers=auth_headers)
        assert rm.status_code == 404


# -------------------- Analytics / Leaderboard / Gamification --------------------
class TestAnalytics:
    @pytest.mark.parametrize("days", [7, 14, 30])
    def test_trends(self, session, auth_headers, days):
        r = session.get(f"{API}/analytics/trends?days={days}", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "daily" in d and len(d["daily"]) == days
        assert "per_model" in d and len(d["per_model"]) == 5

    def test_leaderboard(self, session, auth_headers):
        r = session.get(f"{API}/leaderboard", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_challenges(self, session, auth_headers):
        r = session.get(f"{API}/gamification/challenges", headers=auth_headers)
        assert r.status_code == 200
        chals = r.json()
        assert len(chals) == 3
        for c in chals:
            for f in ("id", "title", "target", "reward", "progress", "completed"):
                assert f in c

    def test_badges(self, session, auth_headers):
        r = session.get(f"{API}/gamification/badges", headers=auth_headers)
        assert r.status_code == 200
        badges = r.json()
        assert len(badges) == 6
        for b in badges:
            assert "earned" in b


# -------------------- Settings / Reports --------------------
class TestSettingsReports:
    def test_settings_persist(self, session, auth_headers):
        r = session.patch(f"{API}/user/settings", headers=auth_headers, json={"eco_mode": False, "preferred_model": "gemini"})
        assert r.status_code == 200
        d = r.json()
        assert d["eco_mode"] is False
        assert d["preferred_model"] == "gemini"

        # Re-toggle
        r2 = session.patch(f"{API}/user/settings", headers=auth_headers, json={"eco_mode": True})
        assert r2.json()["eco_mode"] is True

    def test_export(self, session, auth_headers):
        r = session.get(f"{API}/user/export", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for f in ("user", "prompts", "chats", "messages"):
            assert f in d

    def test_pdf_report(self, session, auth_headers):
        r = session.get(f"{API}/reports/pdf", headers=auth_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# -------------------- Bug fix: Savings calculations must never be negative --------------------
# Model metrics constants mirror ai_service.MODEL_METRICS for validation
CLAUDE_METRICS = {"co2_per_1k": 3.10, "cost_per_1k": 0.008, "water_ml_per_1k": 11.0, "energy_wh_per_1k": 2.1}


def _expected_savings(tokens_saved: int, m=CLAUDE_METRICS):
    k = tokens_saved / 1000.0
    return {
        "carbon_saved": round(k * m["co2_per_1k"], 4),
        "cost_saved": round(k * m["cost_per_1k"], 5),
        "water_saved": round(k * m["water_ml_per_1k"], 3),
        "energy_saved": round(k * m["energy_wh_per_1k"], 4),
        "time_saved_s": round(tokens_saved * 0.02, 2),
    }


class TestSavingsCalculations:
    """BUG VERIFICATION: /api/prompt/optimize must always return non-negative savings
    and savings must be the delta between original and optimized (using estimate_savings)."""

    def test_estimate_tokens_helper(self):
        """BUG #5: estimate_tokens('') must return 0 (not 1)."""
        from ai_service import estimate_tokens

        assert estimate_tokens("") == 0
        assert estimate_tokens("   ") == 0
        assert estimate_tokens("a") >= 1
        assert estimate_tokens("hello world") >= 1

    def test_estimate_savings_helper_non_negative(self):
        """estimate_savings must be non-negative even when optimized is longer."""
        from ai_service import estimate_savings

        # Optimized longer than original -> all zeros
        s = estimate_savings(10, 50, "claude")
        assert s["tokens_saved"] == 0
        assert s["carbon_saved"] == 0
        assert s["cost_saved"] == 0
        assert s["water_saved"] == 0
        assert s["energy_saved"] == 0
        assert s["time_saved_s"] == 0

    def test_estimate_savings_math_matches(self):
        """estimate_savings math must match impact multipliers exactly."""
        from ai_service import estimate_savings

        s = estimate_savings(200, 50, "claude")
        delta = 150
        exp = _expected_savings(delta)
        assert s["tokens_saved"] == delta
        assert s["carbon_saved"] == exp["carbon_saved"]
        assert s["cost_saved"] == exp["cost_saved"]
        assert s["water_saved"] == exp["water_saved"]
        assert s["energy_saved"] == exp["energy_saved"]
        assert s["time_saved_s"] == exp["time_saved_s"]

    def test_optimize_verbose_prompt_positive_savings(self, session, auth_headers):
        """BUG #2: Verbose prompt should produce non-negative delta-based savings."""
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "Could you please kindly write me a python function that basically reverses a string for me?", "model": "claude"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        # All savings must be non-negative
        for f in ("tokens_saved", "carbon_saved", "cost_saved", "water_saved", "energy_saved", "time_saved_s"):
            assert f in d, f"missing field {f}"
            assert d[f] >= 0, f"{f} is negative: {d[f]}"
        # Delta consistency
        assert d["tokens_before"] >= d["tokens_after"] or d["tokens_saved"] == 0
        expected_delta = max(0, d["tokens_before"] - d["tokens_after"])
        assert d["tokens_saved"] == expected_delta
        # Math check against Claude multipliers
        exp = _expected_savings(d["tokens_saved"])
        assert d["carbon_saved"] == exp["carbon_saved"], f'carbon {d["carbon_saved"]} vs {exp["carbon_saved"]}'
        assert d["cost_saved"] == exp["cost_saved"]
        assert d["water_saved"] == exp["water_saved"]
        assert d["energy_saved"] == exp["energy_saved"]
        assert d["time_saved_s"] == exp["time_saved_s"]

    def test_optimize_already_short_prompt(self, session, auth_headers):
        """BUG #3: If optimized has same/more tokens than original, all savings are 0."""
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "Reverse a string in Python.", "model": "claude"},
        )
        assert r.status_code == 200
        d = r.json()
        # Even if LLM returns something longer, must clamp to zero
        for f in ("tokens_saved", "carbon_saved", "cost_saved", "water_saved", "energy_saved", "time_saved_s"):
            assert d[f] >= 0, f"{f} is negative for optimal prompt: {d[f]}"

    def test_optimize_empty_prompt(self, session, auth_headers):
        """BUG #4: Empty prompt must not crash, all zeros."""
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "", "model": "claude"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        # Empty original -> tokens_before is 0 -> all savings 0
        assert d["tokens_before"] == 0
        assert d["tokens_saved"] == 0
        assert d["carbon_saved"] == 0
        assert d["cost_saved"] == 0
        assert d["water_saved"] == 0
        assert d["energy_saved"] == 0

    def test_optimize_whitespace_prompt(self, session, auth_headers):
        """BUG #4: Whitespace-only prompt behaves like empty."""
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "   ", "model": "claude"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d["tokens_before"] == 0
        assert d["tokens_saved"] == 0
        assert d["carbon_saved"] == 0

    def test_optimize_returns_rewritten_prompt_not_answer(self, session, auth_headers):
        """REGRESSION: optimized field must be a rewritten prompt, not an answer."""
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "Could you please kindly write me a python function that basically reverses a string for me?", "model": "claude"},
        )
        assert r.status_code == 200
        d = r.json()
        opt = d["optimized"].lower()
        # Should NOT contain code / function definition (which would indicate the LLM answered instead)
        assert "def " not in opt, f"optimized looks like an answer: {d['optimized'][:200]}"
        assert "return" not in opt or len(opt) < 200, f"optimized looks like an answer: {d['optimized'][:200]}"

    def test_accept_does_not_accumulate_negative(self, session, auth_headers):
        """BUG #6: Accept must not decrement any total_* field."""
        # First get baseline
        before = session.get(f"{API}/dashboard/summary", headers=auth_headers).json()
        # Optimize an already-short prompt (likely zero savings)
        r = session.post(
            f"{API}/prompt/optimize",
            headers=auth_headers,
            json={"prompt": "Reverse a string in Python.", "model": "claude"},
        )
        assert r.status_code == 200
        pid = r.json()["prompt_id"]
        ra = session.post(f"{API}/prompt/accept", headers=auth_headers, json={"prompt_id": pid, "accepted": True})
        assert ra.status_code == 200

        after = session.get(f"{API}/dashboard/summary", headers=auth_headers).json()
        for f in ("total_tokens_saved", "total_carbon_saved", "total_cost_saved", "total_water_saved", "total_energy_saved"):
            assert after[f] >= before[f], f"{f} decreased: {before[f]} -> {after[f]}"
            assert after[f] >= 0, f"{f} is negative after accept: {after[f]}"


# -------------------- Iteration 3: Smart Compose (suggest_batch_llm) --------------------
class TestSuggestBatch:
    """New /api/prompt/suggest endpoint returns {suggestion, chips[]} in one LLM call."""

    def test_suggest_returns_suggestion_and_chips(self, session, auth_headers):
        r = session.post(f"{API}/prompt/suggest", headers=auth_headers, json={"prompt": "Write a python function to"})
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert "suggestion" in d
        assert "chips" in d
        assert isinstance(d["chips"], list)
        assert len(d["chips"]) <= 4
        # Non-empty for a long enough partial prompt
        # (LLM call may occasionally fall back to empty on transient errors, so tolerate that)
        if d.get("error"):
            pytest.skip(f"LLM transient error: {d['error']}")
        assert isinstance(d["suggestion"], str)

    def test_suggest_short_prompt_returns_empty(self, session, auth_headers):
        """Prompts under 4 chars trimmed should return empty (no LLM call)."""
        r = session.post(f"{API}/prompt/suggest", headers=auth_headers, json={"prompt": "ab"})
        assert r.status_code == 200
        d = r.json()
        assert d["suggestion"] == ""
        assert d["chips"] == []

    def test_suggest_empty_prompt(self, session, auth_headers):
        r = session.post(f"{API}/prompt/suggest", headers=auth_headers, json={"prompt": ""})
        assert r.status_code == 200
        d = r.json()
        assert d["suggestion"] == ""
        assert d["chips"] == []


# -------------------- Iteration 3: Improvements detector --------------------
class TestImprovementsDetector:
    """analyze_prompt now returns an 'improvements' array (Grammarly-style)."""

    def _analyze(self, session, auth_headers, prompt):
        r = session.post(f"{API}/prompt/analyze", headers=auth_headers, json={"prompt": prompt})
        assert r.status_code == 200
        d = r.json()
        assert "improvements" in d
        assert isinstance(d["improvements"], list)
        return d["improvements"]

    def test_filler_heavy_prompt_detects_redundant_and_vague(self, session, auth_headers):
        prompt = "Could you please kindly write me some code that does something really nice for me?"
        issues = self._analyze(session, auth_headers, prompt)
        assert len(issues) > 0
        # Each issue has required keys
        for iss in issues:
            for k in ("type", "text", "message", "severity"):
                assert k in iss, f"missing key {k} in issue {iss}"

        types = {i["type"] for i in issues}
        assert "redundant" in types, f"expected 'redundant' in {types}"
        assert "vague" in types, f"expected 'vague' in {types}"
        # Redundant words
        redundant_texts = {i["text"] for i in issues if i["type"] == "redundant"}
        assert "please" in redundant_texts
        assert "kindly" in redundant_texts
        assert "could you" in redundant_texts
        assert "really" in redundant_texts
        assert "for me" in redundant_texts
        # Vague words
        vague_texts = {i["text"] for i in issues if i["type"] == "vague"}
        assert "something" in vague_texts
        assert "nice" in vague_texts

    def test_long_sentence_high_severity(self, session, auth_headers):
        long_sentence = (
            "Please write me a very detailed and comprehensive python function that takes a list of "
            "integers and returns the sum of all the even numbers while also printing them nicely "
            "one by one to the console for me right now"
        )
        # Ensure over 30 words in one sentence (no period)
        assert len(long_sentence.split()) > 30
        issues = self._analyze(session, auth_headers, long_sentence)
        long_issues = [i for i in issues if i["type"] == "long_sentence"]
        assert len(long_issues) >= 1, f"no long_sentence issue in {issues}"
        assert long_issues[0]["severity"] == "high"

    def test_no_action_verb(self, session, auth_headers):
        issues = self._analyze(session, auth_headers, "the capital of france is very interesting to me")
        no_action = [i for i in issues if i["type"] == "no_action"]
        assert len(no_action) == 1, f"expected 1 no_action issue in {issues}"
        assert no_action[0]["severity"] == "medium"

    def test_all_caps_shouting(self, session, auth_headers):
        issues = self._analyze(session, auth_headers, "WRITE ME CODE NOW")
        shouting = [i for i in issues if i["type"] == "shouting"]
        assert len(shouting) >= 1, f"expected shouting issue in {issues}"
        assert shouting[0]["severity"] == "low"

    def test_clean_prompt_no_or_minimal_issues(self, session, auth_headers):
        issues = self._analyze(session, auth_headers, "Write a Python function to reverse a string.")
        # Should be zero (or at most 1) issues — clean, direct, action-verb prompt
        assert len(issues) <= 1, f"clean prompt has too many issues: {issues}"

    def test_improvements_direct_helper(self):
        """Direct unit test of detect_improvements — no LLM, no HTTP."""
        from ai_service import detect_improvements

        # Empty
        assert detect_improvements("") == []
        assert detect_improvements("   ") == []
        # Filler
        iss = detect_improvements("please kindly write something nice for me")
        types = {i["type"] for i in iss}
        assert "redundant" in types
        assert "vague" in types
        # Shouting
        iss2 = detect_improvements("SHOUT LOUDER HERE")
        assert any(i["type"] == "shouting" for i in iss2)
        # No action verb
        iss3 = detect_improvements("the capital of france is paris and it is nice")
        # 'nice' will fire vague, but no_action should also fire
        assert any(i["type"] == "no_action" for i in iss3)
        # Cap at 8 issues
        heavy = "please kindly really actually basically simply literally just very " "something maybe perhaps stuff things nice good somehow somewhere"
        assert len(detect_improvements(heavy)) <= 8


# -------------------- Admin --------------------
class TestAdmin:
    def test_non_admin_forbidden(self, session, auth_headers):
        r = session.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 403

    def test_admin_stats_after_promote(self, session, auth_headers, auth):
        """Promote user via mongosh, then check admin endpoints."""
        _, user = auth
        import subprocess

        db_name = os.environ.get("DB_NAME", "test_database")
        cmd = f"mongosh --quiet --eval \"db.getSiblingDB('{db_name}').users.updateOne({{user_id:'{user['user_id']}'}},{{\\$set:{{role:'admin'}}}})\""
        subprocess.run(cmd, shell=True, capture_output=True, timeout=15)

        # Now admin endpoints should work
        r = session.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 200, f"admin stats: {r.status_code} {r.text}"
        d = r.json()
        for f in ("total_users", "total_chats", "total_prompts", "total_tokens_saved", "total_carbon_saved"):
            assert f in d

        # Users list
        r2 = session.get(f"{API}/admin/users", headers=auth_headers)
        assert r2.status_code == 200
        users = r2.json()
        assert any(u["user_id"] == user["user_id"] for u in users)

        # Role toggle: promote a fake user? Just test 400 for invalid role
        r3 = session.patch(f"{API}/admin/users/{user['user_id']}/role", headers=auth_headers, json={"role": "invalid"})
        assert r3.status_code == 400
