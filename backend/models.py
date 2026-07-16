"""MongoDB models and helpers."""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
import uuid


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# --------- User ---------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"  # 'email' | 'google'
    password_hash: Optional[str] = None
    role: str = "user"  # 'user' | 'admin'
    eco_score: int = 0
    green_coins: int = 0
    xp: int = 0
    level: int = 1
    total_prompts: int = 0
    total_tokens_saved: int = 0
    total_carbon_saved: float = 0.0
    total_cost_saved: float = 0.0
    total_water_saved: float = 0.0
    total_energy_saved: float = 0.0
    badges: List[str] = Field(default_factory=list)
    eco_mode: bool = True
    preferred_model: str = "claude"
    created_at: datetime = Field(default_factory=now_utc)


class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "user"
    eco_score: int = 0
    green_coins: int = 0
    xp: int = 0
    level: int = 1
    badges: List[str] = []
    eco_mode: bool = True
    preferred_model: str = "claude"


# --------- Chat ---------
class ChatSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    title: str = "New Chat"
    model: str = "claude-sonnet-4-5-20250929"
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str
    session_id: str
    user_id: str
    role: str  # 'user' | 'assistant'
    content: str
    tokens: int = 0
    model: Optional[str] = None
    carbon_g: float = 0.0
    created_at: datetime = Field(default_factory=now_utc)


# --------- Prompts / Analytics ---------
class PromptRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prompt_id: str
    user_id: str
    original: str
    optimized: Optional[str] = None
    tokens_before: int = 0
    tokens_after: int = 0
    tokens_saved: int = 0
    carbon_saved: float = 0.0
    cost_saved: float = 0.0
    water_saved: float = 0.0
    energy_saved: float = 0.0
    accepted: bool = False
    created_at: datetime = Field(default_factory=now_utc)


# --------- Session (Google Auth) ---------
class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=now_utc)


def serialize(doc: BaseModel) -> dict:
    """Convert model to Mongo-safe dict (ISO strings for datetime)."""
    d = doc.model_dump()
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def deserialize_dt(doc: dict, fields: List[str]) -> dict:
    """Parse ISO datetime strings back to datetime objects."""
    for f in fields:
        if f in doc and isinstance(doc[f], str):
            try:
                doc[f] = datetime.fromisoformat(doc[f])
            except Exception:
                pass
    return doc
