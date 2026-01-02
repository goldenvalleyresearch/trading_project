# routers/health.py
from fastapi import APIRouter
from core.db import get_db

router = APIRouter(prefix="/health")

@router.get("/db")
async def health_db():
  db = get_db()
  await db.command("ping")
  return {"ok": True, "db": db.name}