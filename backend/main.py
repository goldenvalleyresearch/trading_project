from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from core.config import settings
from core.db import connect_db, close_db, get_db

from routers import (
    health,
    ingest,
    portfolio,
    history,
    newsletter,
    research,
    auth,
)
from routers.closed_trades import router as closed_trades_router  # ✅ move here
from routers.activity import router as activity_router


load_dotenv()

app = FastAPI(title="ObviousTrades API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await connect_db()
    db = get_db()
    users = db["users"]
    await users.create_index("email", unique=True)
    await users.create_index("username", unique=True)
    await db["activity_thesis"].create_index("trade_id", unique=True)


@app.on_event("shutdown")
async def shutdown():
    await close_db()

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ingest.router)
app.include_router(portfolio.router)
app.include_router(history.router)
app.include_router(newsletter.router)
app.include_router(newsletter.admin_router)
app.include_router(research.router)
app.include_router(closed_trades_router)  # ✅
app.include_router(activity_router)


@app.get("/")
async def root():
    return {"ok": True}
