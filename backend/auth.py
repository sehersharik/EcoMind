"""Authentication: JWT email/password + Emergent Google Auth."""

import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr

from models import User, UserPublic, serialize

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 7

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


# ---------- Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_jwt(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None


async def get_current_user(request: Request) -> User:
    """Resolve current user from session_token cookie (Google) OR JWT bearer (email)."""
    from server import db

    # 1) Session cookie (Emergent Google Auth)
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
            # Try JWT first
            uid = decode_jwt(token)
            if uid:
                user_doc = await db.users.find_one({"user_id": uid}, {"_id": 0})
                if user_doc:
                    return User(**user_doc)
            # Fallback: treat as session_token
            session_token = token

    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            expires_at = sess["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
                if user_doc:
                    return User(**user_doc)

    raise HTTPException(status_code=401, detail="Not authenticated")


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------- Email / password ----------
@router.post("/register")
async def register(req: RegisterReq):
    from server import db

    existing = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        user_id=f"user_{uuid.uuid4().hex[:12]}",
        email=req.email.lower(),
        name=req.name,
        auth_provider="email",
        password_hash=hash_password(req.password),
    )
    await db.users.insert_one(serialize(user))
    token = create_jwt(user.user_id)
    return {"token": token, "user": UserPublic(**user.model_dump()).model_dump()}


@router.post("/login")
async def login(req: LoginReq):
    from server import db

    user_doc = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = User(**user_doc)
    token = create_jwt(user.user_id)
    return {"token": token, "user": UserPublic(**user.model_dump()).model_dump()}


# ---------- Google OAuth (Emergent) ----------
class SessionReq(BaseModel):
    session_id: str


@router.post("/session")
async def create_session_from_google(req: SessionReq, response: Response):
    """Exchange Emergent session_id for a session_token cookie and create/update user."""
    from server import db

    # Google Auth needs to be re-implemented with Firebase or standard OAuth2
    raise HTTPException(status_code=501, detail="Google OAuth is disabled. Please configure a standard OAuth provider.")

    email = "mock@example.com"
    name = "Mock User"
    picture = ""
    session_token = req.session_id

    # Upsert user
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if user_doc:
        await db.users.update_one(
            {"email": email},
            {"$set": {"picture": picture, "name": name, "auth_provider": "google"}},
        )
        user = User(**user_doc)
    else:
        user = User(
            user_id=f"user_{uuid.uuid4().hex[:12]}",
            email=email,
            name=name,
            picture=picture,
            auth_provider="google",
        )
        await db.users.insert_one(serialize(user))

    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "user_id": user.user_id,
                "session_token": session_token,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user": UserPublic(**user.model_dump()).model_dump(), "session_token": session_token}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return UserPublic(**user.model_dump()).model_dump()


@router.post("/logout")
async def logout(request: Request, response: Response):
    from server import db

    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
