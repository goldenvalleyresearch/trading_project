# core/db.py
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_db():
    global client, db

    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        uuidRepresentation="standard",
        serverSelectionTimeoutMS=5000,
    )


    await client.admin.command("ping")

    db = client[settings.MONGO_DB]

    print("✅ MongoDB connected")


async def close_db():
    global client
    if client:
        client.close()
        print("🛑 MongoDB connection closed")


def get_db():
    if db is None:
        raise RuntimeError("Database not initialized")
    return db