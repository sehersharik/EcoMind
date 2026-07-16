"""EcoMind FastAPI server."""

import os
import logging
from pathlib import Path
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Mongo
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "ecomind")]

app = FastAPI(title="EcoMind API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "EcoMind API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# Import & mount routers
from auth import router as auth_router  # noqa: E402
from routes import router as feature_router  # noqa: E402

api_router.include_router(auth_router)
api_router.include_router(feature_router)

app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ecomind")


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.chat_sessions.create_index([("user_id", 1), ("updated_at", -1)])
    await db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])
    await db.prompts.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("EcoMind API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
